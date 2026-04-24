import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedProfile, requireAdmin, requireClient, requireSupplier } from "./lib";

const attachmentInput = v.object({
  document_type: v.union(
    v.literal("SPECIFICATION"),
    v.literal("PURCHASE_POLICY"),
    v.literal("SUPPORTING_DOCUMENT"),
    v.literal("SUPPLIER_QUOTATION"),
    v.literal("COMMERCIAL_TERMS"),
    v.literal("OTHER"),
  ),
  name: v.string(),
  url: v.optional(v.string()),
  storage_id: v.optional(v.id("_storage")),
  content_type: v.optional(v.string()),
  size: v.optional(v.number()),
  notes: v.optional(v.string()),
});

const resolveAttachments = async (ctx: any, attachments: any[]) =>
  Promise.all(
    attachments.map(async (attachment) => {
      const storageUrl = attachment.storage_id ? await ctx.storage.getUrl(attachment.storage_id) : null;
      return { ...attachment, url: storageUrl ?? attachment.url ?? "" };
    }),
  );

export const generateAttachmentUploadUrl = mutation({
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new Error("Not authenticated");
    return ctx.storage.generateUploadUrl();
  },
});

export const listMine = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    const rfqs = await ctx.db
      .query("rfqs")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("desc")
      .collect();
    return Promise.all(
      rfqs.map(async (rfq) => {
        const items = await ctx.db
          .query("rfq_items")
          .withIndex("by_rfq", (q) => q.eq("rfq_id", rfq._id))
          .collect();
        const attachments = await ctx.db
          .query("procurement_attachments")
          .withIndex("by_rfq", (q) => q.eq("rfq_id", rfq._id))
          .collect();
        const quotes = await ctx.db
          .query("quotes")
          .withIndex("by_rfq", (q) => q.eq("rfq_id", rfq._id))
          .filter((q) => q.neq(q.field("status"), "PENDING_ADMIN"))
          .collect();
        return {
          ...rfq,
          items_count: items.length,
          attachments_count: attachments.length,
          quotes_count: quotes.length,
        };
      }),
    );
  },
});

export const getById = query({
  args: { id: v.id("rfqs") },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) return null;
    const rfq = await ctx.db.get(args.id);
    if (!rfq) return null;
    if (profile.role === "CLIENT" && rfq.client_id !== profile._id) return null;
    if (profile.role === "SUPPLIER") {
      const assignment = await ctx.db
        .query("rfq_supplier_assignments")
        .withIndex("by_rfq", (q) => q.eq("rfq_id", args.id))
        .filter((q) => q.eq(q.field("supplier_id"), profile._id))
        .unique();
      if (!assignment) return null;
    }
    const items = await ctx.db
      .query("rfq_items")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.id))
      .collect();
    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = item.product_id ? await ctx.db.get(item.product_id) : null;
        return { ...item, product };
      }),
    );
    const attachments = await ctx.db
      .query("procurement_attachments")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.id))
      .collect();
    const quotesQuery = ctx.db.query("quotes").withIndex("by_rfq", (q) => q.eq("rfq_id", args.id));
    const quotes =
      profile.role === "ADMIN"
        ? await quotesQuery.collect()
        : await quotesQuery.filter((q) => q.neq(q.field("status"), "PENDING_ADMIN")).collect();
    return { ...rfq, items: itemsWithProducts, attachments: await resolveAttachments(ctx, attachments), quotes_count: quotes.length };
  },
});

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rfqs = await ctx.db.query("rfqs").order("desc").collect();
    return Promise.all(
      rfqs.map(async (rfq) => {
        const client = await ctx.db.get(rfq.client_id);
        const items = await ctx.db
          .query("rfq_items")
          .withIndex("by_rfq", (q) => q.eq("rfq_id", rfq._id))
          .collect();
        const attachments = await ctx.db
          .query("procurement_attachments")
          .withIndex("by_rfq", (q) => q.eq("rfq_id", rfq._id))
          .collect();
        const quotes = await ctx.db
          .query("quotes")
          .withIndex("by_rfq", (q) => q.eq("rfq_id", rfq._id))
          .collect();
        return {
          ...rfq,
          client_public_id: client?.public_id ?? "Unknown",
          items_count: items.length,
          attachments_count: attachments.length,
          quotes_count: quotes.length,
        };
      }),
    );
  },
});

export const listAssigned = query({
  handler: async (ctx) => {
    const profile = await requireSupplier(ctx);
    const assignments = await ctx.db
      .query("rfq_supplier_assignments")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .order("desc")
      .collect();
    const results = await Promise.all(
      assignments.map(async (a) => {
        const rfq = await ctx.db.get(a.rfq_id);
        if (!rfq) return null;
        const client = await ctx.db.get(rfq.client_id);
        const items = await ctx.db
          .query("rfq_items")
          .withIndex("by_rfq", (q) => q.eq("rfq_id", rfq._id))
          .collect();
        const existingQuote = await ctx.db
          .query("quotes")
          .withIndex("by_rfq", (q) => q.eq("rfq_id", rfq._id))
          .filter((q) => q.eq(q.field("supplier_id"), profile._id))
          .unique();
        return {
          ...a,
          rfq: {
            ...rfq,
            client_public_id: client?.public_id ?? "Unknown",
            items_count: items.length,
          },
          has_quote: !!existingQuote,
        };
      }),
    );
    return results.filter(Boolean);
  },
});

export const getAssigned = query({
  args: { rfq_id: v.id("rfqs") },
  handler: async (ctx, args) => {
    const profile = await requireSupplier(ctx);
    const assignment = await ctx.db
      .query("rfq_supplier_assignments")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.rfq_id))
      .filter((q) => q.eq(q.field("supplier_id"), profile._id))
      .unique();
    if (!assignment) return null;
    const rfq = await ctx.db.get(args.rfq_id);
    if (!rfq) return null;
    const items = await ctx.db
      .query("rfq_items")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.rfq_id))
      .collect();
    const attachments = await ctx.db
      .query("procurement_attachments")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.rfq_id))
      .collect();
    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = item.product_id ? await ctx.db.get(item.product_id) : null;
        return { ...item, product };
      }),
    );
    const existingQuote = await ctx.db
      .query("quotes")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.rfq_id))
      .filter((q) => q.eq(q.field("supplier_id"), profile._id))
      .unique();
    // Get supplier's own approved products for the quote form
    const myProducts = await ctx.db
      .query("products")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .filter((q) => q.eq(q.field("approval_status"), "APPROVED"))
      .collect();
    return { ...rfq, items: itemsWithProducts, attachments: await resolveAttachments(ctx, attachments), existingQuote, myProducts };
  },
});

export const create = mutation({
  args: {
    category: v.optional(v.string()),
    template_key: v.optional(v.string()),
    notes: v.optional(v.string()),
    expiry_date: v.optional(v.string()),
    required_by: v.optional(v.string()),
    delivery_location: v.optional(v.string()),
    attachments: v.optional(v.array(attachmentInput)),
    items: v.array(
      v.object({
        product_id: v.optional(v.id("products")),
        custom_item_description: v.optional(v.string()),
        quantity: v.number(),
        flexibility: v.union(
          v.literal("EXACT_MATCH"),
          v.literal("OPEN_TO_EQUIVALENT"),
          v.literal("OPEN_TO_ALTERNATIVES"),
        ),
        special_notes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    if (profile.status === "FROZEN") throw new Error("Account is frozen");

    const rfqId = await ctx.db.insert("rfqs", {
      client_id: profile._id,
      status: "OPEN",
      category: args.category,
      template_key: args.template_key,
      notes: args.notes,
      expiry_date: args.expiry_date,
      required_by: args.required_by,
      delivery_location: args.delivery_location,
    });

    await Promise.all(args.items.map((item) => ctx.db.insert("rfq_items", { ...item, rfq_id: rfqId })));
    await Promise.all(
      (args.attachments ?? []).map((attachment) =>
        ctx.db.insert("procurement_attachments", {
          ...attachment,
          rfq_id: rfqId,
          uploaded_by: profile._id,
          created_at: Date.now(),
        }),
      ),
    );

    // Auto-assign suppliers who own selected products
    const productIds = args.items.flatMap((i) => (i.product_id ? [i.product_id] : []));
    if (productIds.length > 0) {
      const products = await Promise.all(productIds.map((id) => ctx.db.get(id)));
      const supplierIds = [...new Set(products.filter(Boolean).map((p) => p!.supplier_id))];
      await Promise.all(
        supplierIds.map((supplierId) =>
          ctx.db.insert("rfq_supplier_assignments", {
            rfq_id: rfqId,
            supplier_id: supplierId,
            assigned_at: Date.now(),
          }),
        ),
      );
    }

    return rfqId;
  },
});

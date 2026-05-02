import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedProfile, getClientOrgId, requireAdminRead, requireClient, requireSupplier } from "./lib";
import { generateDraftsForRfq } from "./autoQuote";

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
    const orgId = await getClientOrgId(ctx);
    const rfqs = await ctx.db
      .query("rfqs")
      .withIndex("by_client", (q) => q.eq("client_id", orgId))
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
          .filter((q) =>
            q.and(
              q.neq(q.field("status"), "PENDING_ADMIN"),
              q.neq(q.field("status"), "AUTO_DRAFT"),
            ),
          )
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
    if (profile.role === "CLIENT") {
      const orgId = profile.parent_client_id ?? profile._id;
      if (rfq.client_id !== orgId) return null;
    }
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
        const master = item.master_product_id ? await ctx.db.get(item.master_product_id) : null;
        return { ...item, product, master };
      }),
    );
    const attachments = await ctx.db
      .query("procurement_attachments")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.id))
      .collect();
    const quotesQuery = ctx.db.query("quotes").withIndex("by_rfq", (q) => q.eq("rfq_id", args.id));
    // ADMIN + AUDITOR (PRD §13.4) see in-flight quotes; clients/suppliers
    // are filtered to released ones (PENDING_ADMIN is admin-internal staging
    // and AUTO_DRAFT is supplier-internal review window).
    const quotes =
      profile.role === "ADMIN" || profile.role === "AUDITOR"
        ? await quotesQuery.collect()
        : await quotesQuery
            .filter((q) =>
              q.and(
                q.neq(q.field("status"), "PENDING_ADMIN"),
                q.neq(q.field("status"), "AUTO_DRAFT"),
              ),
            )
            .collect();
    const [costCenter, branch, department] = await Promise.all([
      rfq.cost_center_id ? ctx.db.get(rfq.cost_center_id) : null,
      rfq.branch_id ? ctx.db.get(rfq.branch_id) : null,
      rfq.department_id ? ctx.db.get(rfq.department_id) : null,
    ]);
    return {
      ...rfq,
      items: itemsWithProducts,
      attachments: await resolveAttachments(ctx, attachments),
      quotes_count: quotes.length,
      cost_center: costCenter,
      branch,
      department,
    };
  },
});

export const listAll = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
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
        const revisionEvents = existingQuote
          ? await ctx.db
              .query("quote_revision_events")
              .withIndex("by_quote", (q) => q.eq("quote_id", existingQuote._id))
              .order("asc")
              .collect()
          : [];
        return {
          ...a,
          rfq: {
            ...rfq,
            client_public_id: client?.public_id ?? "Unknown",
            items_count: items.length,
          },
          has_quote: !!existingQuote,
          quote_id: existingQuote?._id,
          existing_quote_status: existingQuote?.status,
          latest_revision_event: revisionEvents[revisionEvents.length - 1] ?? null,
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
        const master = item.master_product_id ? await ctx.db.get(item.master_product_id) : null;
        return { ...item, product, master };
      }),
    );
    const existingQuote = await ctx.db
      .query("quotes")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.rfq_id))
      .filter((q) => q.eq(q.field("supplier_id"), profile._id))
      .unique();
    let existingQuoteWithDetails = null;
    if (existingQuote) {
      const quoteItems = await ctx.db
        .query("quote_items")
        .withIndex("by_quote", (q) => q.eq("quote_id", existingQuote._id))
        .collect();
      const quoteAttachments = await ctx.db
        .query("procurement_attachments")
        .withIndex("by_quote", (q) => q.eq("quote_id", existingQuote._id))
        .collect();
      const revisionEvents = await ctx.db
        .query("quote_revision_events")
        .withIndex("by_quote", (q) => q.eq("quote_id", existingQuote._id))
        .order("asc")
        .collect();
      existingQuoteWithDetails = {
        ...existingQuote,
        items: quoteItems,
        attachments: await resolveAttachments(ctx, quoteAttachments),
        revision_events: revisionEvents,
      };
    }
    // Get supplier's own approved products for the quote form
    const myProducts = await ctx.db
      .query("products")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .filter((q) => q.eq(q.field("approval_status"), "APPROVED"))
      .collect();
    return {
      ...rfq,
      items: itemsWithProducts,
      attachments: await resolveAttachments(ctx, attachments),
      existingQuote: existingQuoteWithDetails,
      myProducts,
    };
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
    cost_center_id: v.optional(v.id("cost_centers")),
    branch_id: v.optional(v.id("branches")),
    department_id: v.optional(v.id("departments")),
    attachments: v.optional(v.array(attachmentInput)),
    items: v.array(
      v.object({
        product_id: v.optional(v.id("products")),
        // Two-tier catalog: clients shop the master catalog, so RFQ lines can
        // target a master_product_id + pack_type_code instead of a specific
        // supplier offer. Either form is accepted; new flows should prefer
        // master + pack.
        master_product_id: v.optional(v.id("master_products")),
        pack_type_code: v.optional(v.string()),
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
    // VIEWER team members can only read; APPROVERs sit in the tree but don't
    // create RFQs. OWNER/ADMIN/BUYER are the writers.
    if (profile.team_role === "VIEWER") {
      throw new Error("Viewer accounts cannot create RFQs");
    }
    const orgId = profile.parent_client_id ?? profile._id;

    const verifyOwnership = async (table: "cost_centers" | "branches" | "departments", id: any) => {
      const doc = (await ctx.db.get(id)) as { client_id?: any } | null;
      if (!doc || doc.client_id !== orgId) {
        throw new Error(`Invalid ${table} reference`);
      }
    };
    if (args.cost_center_id) await verifyOwnership("cost_centers", args.cost_center_id);
    if (args.branch_id) await verifyOwnership("branches", args.branch_id);
    if (args.department_id) await verifyOwnership("departments", args.department_id);

    const rfqId = await ctx.db.insert("rfqs", {
      client_id: orgId,
      status: "OPEN",
      category: args.category,
      template_key: args.template_key,
      notes: args.notes,
      expiry_date: args.expiry_date,
      required_by: args.required_by,
      delivery_location: args.delivery_location,
      cost_center_id: args.cost_center_id,
      branch_id: args.branch_id,
      department_id: args.department_id,
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

    // Auto-assign suppliers. Two paths:
    //   1. Legacy/direct: item references a specific supplier offer (product_id)
    //      → that offer's supplier is added.
    //   2. Master-catalog: item references a master_product_id (+ pack_type_code)
    //      → every approved offer on that master (matching the pack if set) is
    //      pulled in, and each unique supplier is added.
    const supplierSet = new Set<string>();

    const directProductIds = args.items.flatMap((i) => (i.product_id ? [i.product_id] : []));
    if (directProductIds.length > 0) {
      const directProducts = await Promise.all(directProductIds.map((id) => ctx.db.get(id)));
      for (const p of directProducts) {
        if (p?.supplier_id) supplierSet.add(p.supplier_id);
      }
    }

    for (const item of args.items) {
      if (!item.master_product_id) continue;
      const offers = await ctx.db
        .query("products")
        .withIndex("by_master_product", (q) =>
          q.eq("master_product_id", item.master_product_id!),
        )
        .filter((q) => q.eq(q.field("approval_status"), "APPROVED"))
        .collect();
      for (const o of offers) {
        if (item.pack_type_code && o.pack_type_code !== item.pack_type_code) continue;
        supplierSet.add(o.supplier_id);
      }
    }

    await Promise.all(
      [...supplierSet].map((supplierId) =>
        ctx.db.insert("rfq_supplier_assignments", {
          rfq_id: rfqId,
          supplier_id: supplierId as any,
          assigned_at: Date.now(),
        }),
      ),
    );

    // Auto-quote engine (Phase 2). Generate AUTO_DRAFT quotes for every
    // supplier whose offer has auto_quote=true on a master_product_id
    // referenced by this RFQ. INSTANT-window drafts flip to PENDING_ADMIN
    // immediately; longer windows are scheduled.
    await generateDraftsForRfq(ctx, rfqId);

    return rfqId;
  },
});

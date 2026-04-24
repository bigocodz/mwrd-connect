import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireClient, requireSupplier } from "./lib";

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
  url: v.string(),
  notes: v.optional(v.string()),
});

const getQuoteItemsWithDetails = async (ctx: any, quoteId: any) => {
  const items = await ctx.db
    .query("quote_items")
    .withIndex("by_quote", (q: any) => q.eq("quote_id", quoteId))
    .collect();
  return Promise.all(
    items.map(async (item: any) => {
      const rfqItem = item.rfq_item_id ? await ctx.db.get(item.rfq_item_id) : null;
      const rfqProduct = rfqItem?.product_id ? await ctx.db.get(rfqItem.product_id) : null;
      const supplierProduct = item.supplier_product_id ? await ctx.db.get(item.supplier_product_id) : null;
      const alternativeProduct = item.alternative_product_id ? await ctx.db.get(item.alternative_product_id) : null;
      return {
        ...item,
        rfq_item: rfqItem ? { ...rfqItem, product: rfqProduct } : null,
        supplier_product: supplierProduct,
        alternative_product: alternativeProduct,
      };
    }),
  );
};

const getQuoteAttachments = async (ctx: any, quoteId: any) =>
  ctx.db
    .query("procurement_attachments")
    .withIndex("by_quote", (q: any) => q.eq("quote_id", quoteId))
    .collect();

const calculateQuoteMetrics = (rfqItems: any[], quoteItems: any[]) => {
  const quotedItems = quoteItems.filter((item) => item.is_quoted);
  const totalWithVat = quotedItems.reduce((sum, item) => {
    const quantity = item.rfq_item?.quantity || 1;
    const unitPrice = item.final_price_with_vat ?? item.cost_price ?? 0;
    return sum + unitPrice * quantity;
  }, 0);
  const totalCost = quotedItems.reduce((sum, item) => {
    const quantity = item.rfq_item?.quantity || 1;
    return sum + (item.cost_price ?? 0) * quantity;
  }, 0);
  const leadTimes = quotedItems
    .map((item) => item.lead_time_days)
    .filter((leadTime) => typeof leadTime === "number" && leadTime > 0);
  const avgLeadTime =
    leadTimes.length > 0 ? Math.round(leadTimes.reduce((sum, days) => sum + days, 0) / leadTimes.length) : null;
  const coverage = rfqItems.length > 0 ? Math.round((quotedItems.length / rfqItems.length) * 100) : 0;

  return { quotedCount: quotedItems.length, totalWithVat, totalCost, avgLeadTime, coverage };
};

const buildComparison = async (ctx: any, rfq: any, quotes: any[]) => {
  const client = await ctx.db.get(rfq.client_id);
  const rfqItems = await ctx.db
    .query("rfq_items")
    .withIndex("by_rfq", (q: any) => q.eq("rfq_id", rfq._id))
    .collect();
  const rfqItemsWithProducts = await Promise.all(
    rfqItems.map(async (item: any) => {
      const product = item.product_id ? await ctx.db.get(item.product_id) : null;
      return { ...item, product };
    }),
  );
  const rfqAttachments = await ctx.db
    .query("procurement_attachments")
    .withIndex("by_rfq", (q: any) => q.eq("rfq_id", rfq._id))
    .collect();

  const comparableQuotes = await Promise.all(
    quotes.map(async (quote) => {
      const supplier = await ctx.db.get(quote.supplier_id);
      const items = await getQuoteItemsWithDetails(ctx, quote._id);
      const attachments = await getQuoteAttachments(ctx, quote._id);
      const metrics = calculateQuoteMetrics(rfqItemsWithProducts, items);
      return {
        ...quote,
        supplier_public_id: supplier?.public_id ?? "Unknown supplier",
        supplier_company_name: supplier?.company_name,
        attachments,
        items,
        ...metrics,
      };
    }),
  );

  const pricedQuotes = comparableQuotes.filter((quote) => quote.totalWithVat > 0 || quote.totalCost > 0);
  const lowestTotal = pricedQuotes.length
    ? Math.min(...pricedQuotes.map((quote) => quote.totalWithVat || quote.totalCost))
    : 0;
  const leadTimes = comparableQuotes
    .map((quote) => quote.avgLeadTime)
    .filter((leadTime) => typeof leadTime === "number" && leadTime > 0);
  const fastestLeadTime = leadTimes.length ? Math.min(...leadTimes) : null;

  const quotesWithScore = comparableQuotes
    .map((quote) => {
      const comparisonTotal = quote.totalWithVat || quote.totalCost;
      const priceScore = comparisonTotal > 0 && lowestTotal > 0 ? (lowestTotal / comparisonTotal) * 50 : 0;
      const coverageScore = quote.coverage * 0.3;
      const speedScore =
        quote.avgLeadTime && fastestLeadTime ? Math.min(20, (fastestLeadTime / quote.avgLeadTime) * 20) : 0;
      return {
        ...quote,
        score: Math.round(Math.min(100, priceScore + coverageScore + speedScore)),
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    rfq: {
      ...rfq,
      client_public_id: client?.public_id ?? "Unknown",
      client_company_name: client?.company_name,
    },
    items: rfqItemsWithProducts,
    attachments: rfqAttachments,
    quotes: quotesWithScore,
    best_quote_id: quotesWithScore[0]?._id,
  };
};

export const listPending = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const quotes = await ctx.db
      .query("quotes")
      .withIndex("by_status", (q) => q.eq("status", "PENDING_ADMIN"))
      .order("desc")
      .collect();
    return Promise.all(
      quotes.map(async (q) => {
        const supplier = await ctx.db.get(q.supplier_id);
        const items = await ctx.db
          .query("quote_items")
          .withIndex("by_quote", (q2) => q2.eq("quote_id", q._id))
          .collect();
        return {
          ...q,
          supplier_public_id: supplier?.public_id ?? "—",
          supplier_company_name: supplier?.company_name,
          items_count: items.length,
        };
      }),
    );
  },
});

export const getForReview = query({
  args: { id: v.id("quotes") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const quote = await ctx.db.get(args.id);
    if (!quote) return null;
    const supplier = await ctx.db.get(quote.supplier_id);
    const rfq = await ctx.db.get(quote.rfq_id);
    const client = rfq ? await ctx.db.get(rfq.client_id) : null;
    const itemsWithDetails = await getQuoteItemsWithDetails(ctx, args.id);
    const attachments = await getQuoteAttachments(ctx, args.id);
    const marginSettings = await ctx.db.query("margin_settings").collect();
    return {
      ...quote,
      supplier_public_id: supplier?.public_id ?? "—",
      supplier_company_name: supplier?.company_name,
      rfq: rfq
        ? {
            ...rfq,
            client_public_id: client?.public_id ?? "—",
            client_margin: client?.client_margin,
          }
        : null,
      items: itemsWithDetails,
      attachments,
      marginSettings,
    };
  },
});

export const listMine = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    const rfqs = await ctx.db
      .query("rfqs")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .collect();
    const rfqIds = rfqs.map((r) => r._id);
    const allQuoteArrays = await Promise.all(
      rfqIds.map((rfqId) =>
        ctx.db
          .query("quotes")
          .withIndex("by_rfq", (q) => q.eq("rfq_id", rfqId))
          .filter((q) => q.neq(q.field("status"), "PENDING_ADMIN"))
          .collect(),
      ),
    );
    const allQuotes = allQuoteArrays.flat();
    return Promise.all(
      allQuotes.map(async (q) => {
        const items = await ctx.db
          .query("quote_items")
          .withIndex("by_quote", (q2) => q2.eq("quote_id", q._id))
          .collect();
        return { ...q, items_count: items.length };
      }),
    );
  },
});

export const getById = query({
  args: { id: v.id("quotes") },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const quote = await ctx.db.get(args.id);
    if (!quote) return null;
    const rfq = await ctx.db.get(quote.rfq_id);
    if (!rfq || rfq.client_id !== profile._id) return null;
    const itemsWithDetails = await getQuoteItemsWithDetails(ctx, args.id);
    const attachments = await getQuoteAttachments(ctx, args.id);
    return { ...quote, items: itemsWithDetails, attachments };
  },
});

export const compareForClient = query({
  args: { rfq_id: v.id("rfqs") },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const rfq = await ctx.db.get(args.rfq_id);
    if (!rfq || rfq.client_id !== profile._id) return null;
    const quotes = await ctx.db
      .query("quotes")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.rfq_id))
      .filter((q) => q.neq(q.field("status"), "PENDING_ADMIN"))
      .collect();
    return buildComparison(ctx, rfq, quotes);
  },
});

export const compareForAdmin = query({
  args: { rfq_id: v.id("rfqs") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rfq = await ctx.db.get(args.rfq_id);
    if (!rfq) return null;
    const quotes = await ctx.db
      .query("quotes")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.rfq_id))
      .collect();
    return buildComparison(ctx, rfq, quotes);
  },
});

export const submit = mutation({
  args: {
    rfq_id: v.id("rfqs"),
    supplier_notes: v.optional(v.string()),
    attachments: v.optional(v.array(attachmentInput)),
    items: v.array(
      v.object({
        rfq_item_id: v.id("rfq_items"),
        is_quoted: v.boolean(),
        cost_price: v.optional(v.number()),
        lead_time_days: v.optional(v.number()),
        supplier_product_id: v.optional(v.id("products")),
        alternative_product_id: v.optional(v.id("products")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const profile = await requireSupplier(ctx);
    const assignment = await ctx.db
      .query("rfq_supplier_assignments")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.rfq_id))
      .filter((q) => q.eq(q.field("supplier_id"), profile._id))
      .unique();
    if (!assignment) throw new Error("Not assigned to this RFQ");
    const existing = await ctx.db
      .query("quotes")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.rfq_id))
      .filter((q) => q.eq(q.field("supplier_id"), profile._id))
      .unique();
    if (existing) throw new Error("Already submitted a quote for this RFQ");

    const quoteId = await ctx.db.insert("quotes", {
      rfq_id: args.rfq_id,
      supplier_id: profile._id,
      status: "PENDING_ADMIN",
      supplier_notes: args.supplier_notes,
    });
    await Promise.all(args.items.map((item) => ctx.db.insert("quote_items", { ...item, quote_id: quoteId })));
    await Promise.all(
      (args.attachments ?? []).map((attachment) =>
        ctx.db.insert("procurement_attachments", {
          ...attachment,
          quote_id: quoteId,
          uploaded_by: profile._id,
          created_at: Date.now(),
        }),
      ),
    );
    return quoteId;
  },
});

export const sendToClient = mutation({
  args: {
    id: v.id("quotes"),
    items: v.array(
      v.object({
        id: v.id("quote_items"),
        margin_percent: v.number(),
        final_price_before_vat: v.number(),
        final_price_with_vat: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const quote = await ctx.db.get(args.id);
    if (!quote) throw new Error("Quote not found");

    await Promise.all(
      args.items.map((item) =>
        ctx.db.patch(item.id, {
          margin_percent: item.margin_percent,
          final_price_before_vat: item.final_price_before_vat,
          final_price_with_vat: item.final_price_with_vat,
        }),
      ),
    );
    await ctx.db.patch(args.id, {
      status: "SENT_TO_CLIENT",
      reviewed_by: admin._id,
      reviewed_at: Date.now(),
    });

    const rfq = await ctx.db.get(quote.rfq_id);
    if (rfq) {
      await ctx.db.patch(rfq._id, { status: "QUOTED" });
      await ctx.db.insert("notifications", {
        user_id: rfq.client_id,
        title: "New Quote Available",
        message: "A quote for your request is ready for review.",
        link: "/client/quotes",
        read: false,
      });
    }
  },
});

export const respond = mutation({
  args: {
    id: v.id("quotes"),
    status: v.union(v.literal("ACCEPTED"), v.literal("REJECTED")),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const quote = await ctx.db.get(args.id);
    if (!quote) throw new Error("Quote not found");
    const rfq = await ctx.db.get(quote.rfq_id);
    if (!rfq || rfq.client_id !== profile._id) throw new Error("Not authorized");
    await ctx.db.patch(args.id, { status: args.status });
    if (args.status === "ACCEPTED") {
      await ctx.db.patch(rfq._id, { status: "CLOSED" });
    }
  },
});

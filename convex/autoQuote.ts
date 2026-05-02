import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
} from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getAuthenticatedProfile, requireSupplier } from "./lib";
import { logAction } from "./audit";

// Margin + VAT helpers — duplicated from src/lib/margin.ts because convex/
// cannot import from src/. Keep the formulas in sync.
const VAT_RATE = 0.15;

const REVIEW_WINDOW_MS = {
  INSTANT: 0,
  MIN_30: 30 * 60 * 1000,
  HR_2: 2 * 60 * 60 * 1000,
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve the effective margin for a (client, category) pair using the
 * existing margin_settings table. Priority: CLIENT > CATEGORY > GLOBAL.
 * `category` here is the legacy plain-text category string stored on offers
 * (and on margin_settings.category for the CATEGORY tier).
 */
async function resolveMarginPercent(
  ctx: { db: MutationCtx["db"] },
  args: {
    clientProfileId: Id<"profiles">;
    categoryString?: string;
    clientMargin?: number | null;
  },
): Promise<number> {
  if (args.clientMargin != null && args.clientMargin >= 0) {
    return args.clientMargin;
  }
  const settings = await ctx.db.query("margin_settings").collect();
  const clientRow = settings.find(
    (s) => s.type === "CLIENT" && s.client_id === args.clientProfileId,
  );
  if (clientRow) return clientRow.margin_percent;
  if (args.categoryString) {
    const catRow = settings.find(
      (s) => s.type === "CATEGORY" && s.category === args.categoryString,
    );
    if (catRow) return catRow.margin_percent;
  }
  const globalRow = settings.find((s) => s.type === "GLOBAL");
  return globalRow?.margin_percent ?? 0;
}

function computeLinePricing(costPrice: number, marginPercent: number) {
  const finalBeforeVat = costPrice * (1 + marginPercent / 100);
  const finalWithVat = finalBeforeVat * (1 + VAT_RATE);
  return {
    final_price_before_vat: round2(finalBeforeVat),
    final_price_with_vat: round2(finalWithVat),
  };
}

/**
 * Pull every auto-quote-eligible offer for an RFQ's items, group them by
 * supplier, and create one AUTO_DRAFT quote per supplier with priced lines.
 *
 * Called from rfqs.create after the RFQ + items are inserted. Idempotent
 * per (rfq, supplier): skips if a quote already exists.
 *
 * Returns the count of drafts generated and how many were instant-flipped.
 */
export async function generateDraftsForRfq(
  ctx: MutationCtx,
  rfqId: Id<"rfqs">,
): Promise<{ created: number; instant_sent: number }> {
  const rfq = await ctx.db.get(rfqId);
  if (!rfq) return { created: 0, instant_sent: 0 };
  const client = await ctx.db.get(rfq.client_id);
  if (!client) return { created: 0, instant_sent: 0 };

  const items = await ctx.db
    .query("rfq_items")
    .withIndex("by_rfq", (q) => q.eq("rfq_id", rfqId))
    .collect();

  // Group eligible offers by supplier_id. Each entry collects { rfq_item, offer, qty }.
  type Match = {
    rfq_item_id: Id<"rfq_items">;
    offer: Awaited<ReturnType<typeof ctx.db.get<"products">>>;
    quantity: number;
  };
  const bySupplier = new Map<string, Match[]>();

  for (const item of items) {
    if (!item.master_product_id) continue;
    const offers = await ctx.db
      .query("products")
      .withIndex("by_master_product", (q) =>
        q.eq("master_product_id", item.master_product_id!),
      )
      .filter((q) => q.eq(q.field("approval_status"), "APPROVED"))
      .collect();
    for (const o of offers) {
      if (!o.auto_quote) continue;
      if (item.pack_type_code && o.pack_type_code !== item.pack_type_code) continue;
      if (o.availability_status === "OUT_OF_STOCK") continue;
      const arr = bySupplier.get(o.supplier_id) ?? [];
      arr.push({ rfq_item_id: item._id, offer: o, quantity: item.quantity });
      bySupplier.set(o.supplier_id, arr);
    }
  }

  let created = 0;
  let instantSent = 0;

  for (const [supplierIdStr, matches] of bySupplier.entries()) {
    const supplierId = supplierIdStr as Id<"profiles">;
    // Skip if a quote already exists for this (rfq, supplier).
    const existing = await ctx.db
      .query("quotes")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", rfqId))
      .filter((q) => q.eq(q.field("supplier_id"), supplierId))
      .unique();
    if (existing) continue;

    // Pick the longest review window across the matched offers — the most
    // conservative supplier preference wins. Default INSTANT if any offer
    // didn't set one.
    const windows = matches.map((m) => m.offer?.review_window ?? "INSTANT");
    const window = windows.includes("HR_2")
      ? "HR_2"
      : windows.includes("MIN_30")
      ? "MIN_30"
      : "INSTANT";
    const reviewMs = REVIEW_WINDOW_MS[window];
    const reviewUntil = Date.now() + reviewMs;

    const quoteId = await ctx.db.insert("quotes", {
      rfq_id: rfqId,
      supplier_id: supplierId,
      status: "AUTO_DRAFT",
      source: "AUTO_DRAFT",
      review_until: reviewUntil,
      supplier_notes: undefined,
      revision_count: 0,
    });

    for (const m of matches) {
      const offer = m.offer!;
      const cost = offer.cost_price;
      const marginPercent = await resolveMarginPercent(ctx, {
        clientProfileId: rfq.client_id,
        categoryString: offer.category || undefined,
        clientMargin: client.client_margin ?? null,
      });
      const pricing = computeLinePricing(cost, marginPercent);
      await ctx.db.insert("quote_items", {
        quote_id: quoteId,
        rfq_item_id: m.rfq_item_id,
        is_quoted: true,
        supplier_product_id: offer._id,
        master_product_id: offer.master_product_id ?? undefined,
        pack_type_code: offer.pack_type_code ?? undefined,
        cost_price: cost,
        lead_time_days: offer.lead_time_days,
        margin_percent: marginPercent,
        final_price_before_vat: pricing.final_price_before_vat,
        final_price_with_vat: pricing.final_price_with_vat,
      });
    }

    await logAction(ctx, {
      action: "auto_quote.draft.create",
      target_type: "quote",
      target_id: quoteId,
      details: {
        rfq_id: rfqId,
        supplier_id: supplierId,
        review_window: window,
        review_until: reviewUntil,
        line_count: matches.length,
      },
    });

    created++;

    if (reviewMs === 0) {
      // Send immediately — bypasses supplier review entirely.
      await sendAutoDraft(ctx, quoteId);
      instantSent++;
    } else {
      // Schedule the flip when the window expires.
      await ctx.scheduler.runAt(
        reviewUntil,
        internal.autoQuote.releaseDraftIfStillPending,
        { quote_id: quoteId },
      );
    }
  }

  return { created, instant_sent: instantSent };
}

/**
 * Internal: flip an AUTO_DRAFT to AUTO_SENT (status PENDING_ADMIN) so the
 * existing approval-rules + threshold logic in approvals.ts kicks in. We do
 * NOT bypass admin review for above-threshold totals — that gate already
 * exists at submitToAdmin time on the manual path.
 */
async function sendAutoDraft(ctx: MutationCtx, quoteId: Id<"quotes">) {
  const quote = await ctx.db.get(quoteId);
  if (!quote || quote.status !== "AUTO_DRAFT") return;
  await ctx.db.patch(quoteId, {
    status: "PENDING_ADMIN",
    source: "AUTO_SENT",
    review_until: undefined,
  });
  await logAction(ctx, {
    action: "auto_quote.draft.send",
    target_type: "quote",
    target_id: quoteId,
    before: { status: "AUTO_DRAFT" },
    after: { status: "PENDING_ADMIN", source: "AUTO_SENT" },
  });
}

export const releaseDraftIfStillPending = internalMutation({
  args: { quote_id: v.id("quotes") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quote_id);
    if (!quote) return;
    if (quote.status !== "AUTO_DRAFT") return;
    await sendAutoDraft(ctx, args.quote_id);
  },
});

/**
 * Sweeper for any AUTO_DRAFT whose review_until has passed but didn't get
 * released (e.g. dev resets, scheduler hiccups). Cron-callable.
 */
export const sweepExpiredDrafts = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const drafts = await ctx.db
      .query("quotes")
      .withIndex("by_status", (q) => q.eq("status", "AUTO_DRAFT"))
      .collect();
    let released = 0;
    for (const q of drafts) {
      if ((q.review_until ?? 0) <= now) {
        await sendAutoDraft(ctx, q._id);
        released++;
      }
    }
    return { released };
  },
});

/**
 * Supplier-facing review queue. Lists every AUTO_DRAFT quote belonging to
 * the calling supplier, with the line items and a countdown.
 */
export const myAutoDraftQueue = query({
  handler: async (ctx) => {
    const supplier = await requireSupplier(ctx);
    const drafts = await ctx.db
      .query("quotes")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", supplier._id))
      .filter((q) => q.eq(q.field("status"), "AUTO_DRAFT"))
      .collect();
    return Promise.all(
      drafts.map(async (q) => {
        const rfq = await ctx.db.get(q.rfq_id);
        const client = rfq ? await ctx.db.get(rfq.client_id) : null;
        const items = await ctx.db
          .query("quote_items")
          .withIndex("by_quote", (qi) => qi.eq("quote_id", q._id))
          .collect();
        const itemsWithMaster = await Promise.all(
          items.map(async (it) => {
            const master = it.master_product_id
              ? await ctx.db.get(it.master_product_id)
              : null;
            const rfqItem = await ctx.db.get(it.rfq_item_id);
            return { ...it, master, rfq_item: rfqItem };
          }),
        );
        return {
          ...q,
          rfq_client_public_id: client?.public_id ?? "—",
          rfq_required_by: rfq?.required_by,
          items: itemsWithMaster,
        };
      }),
    );
  },
});

/**
 * Supplier action: edit a single line on an AUTO_DRAFT before sending. The
 * supplier can adjust cost (which retriggers margin), lead time, or mark a
 * line as not-quoted. Margin is recomputed server-side; final prices are
 * never set client-side.
 */
export const editDraftLine = mutation({
  args: {
    quote_id: v.id("quotes"),
    item_id: v.id("quote_items"),
    cost_price: v.optional(v.number()),
    lead_time_days: v.optional(v.number()),
    is_quoted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const supplier = await requireSupplier(ctx);
    const quote = await ctx.db.get(args.quote_id);
    if (!quote) throw new ConvexError("Not found");
    if (quote.supplier_id !== supplier._id) throw new ConvexError("Forbidden");
    if (quote.status !== "AUTO_DRAFT") {
      throw new ConvexError("Quote is no longer in review window");
    }
    const item = await ctx.db.get(args.item_id);
    if (!item || item.quote_id !== args.quote_id) {
      throw new ConvexError("Line not found");
    }
    const newCost = args.cost_price ?? item.cost_price ?? 0;
    const newLead = args.lead_time_days ?? item.lead_time_days ?? 0;
    const newIsQuoted = args.is_quoted ?? item.is_quoted;
    if (!newIsQuoted) {
      await ctx.db.patch(args.item_id, {
        is_quoted: false,
        cost_price: undefined,
        lead_time_days: undefined,
        margin_percent: undefined,
        final_price_before_vat: undefined,
        final_price_with_vat: undefined,
      });
      return;
    }
    // Recompute margin from settings — never trust supplier-side prices.
    const rfq = await ctx.db.get(quote.rfq_id);
    const client = rfq ? await ctx.db.get(rfq.client_id) : null;
    const offer = item.supplier_product_id
      ? await ctx.db.get(item.supplier_product_id)
      : null;
    const marginPercent = await resolveMarginPercent(ctx, {
      clientProfileId: rfq!.client_id,
      categoryString: offer?.category || undefined,
      clientMargin: client?.client_margin ?? null,
    });
    const pricing = computeLinePricing(newCost, marginPercent);
    await ctx.db.patch(args.item_id, {
      is_quoted: true,
      cost_price: newCost,
      lead_time_days: newLead,
      margin_percent: marginPercent,
      final_price_before_vat: pricing.final_price_before_vat,
      final_price_with_vat: pricing.final_price_with_vat,
    });
  },
});

/**
 * Supplier action: send the AUTO_DRAFT now (skip remaining review window).
 * Equivalent to releaseDraftIfStillPending but supplier-initiated.
 */
export const sendDraftNow = mutation({
  args: { quote_id: v.id("quotes") },
  handler: async (ctx, args) => {
    const supplier = await requireSupplier(ctx);
    const quote = await ctx.db.get(args.quote_id);
    if (!quote) throw new ConvexError("Not found");
    if (quote.supplier_id !== supplier._id) throw new ConvexError("Forbidden");
    if (quote.status !== "AUTO_DRAFT") {
      throw new ConvexError("Quote is no longer a draft");
    }
    await sendAutoDraft(ctx, args.quote_id);
  },
});

/**
 * Supplier action: decline the entire auto-draft. Equivalent to a manual
 * REJECTED quote — client never sees it, RFQ continues with other suppliers.
 */
export const declineDraft = mutation({
  args: {
    quote_id: v.id("quotes"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const supplier = await requireSupplier(ctx);
    const quote = await ctx.db.get(args.quote_id);
    if (!quote) throw new ConvexError("Not found");
    if (quote.supplier_id !== supplier._id) throw new ConvexError("Forbidden");
    if (quote.status !== "AUTO_DRAFT") {
      throw new ConvexError("Quote is no longer a draft");
    }
    await ctx.db.patch(args.quote_id, {
      status: "REJECTED",
      review_until: undefined,
      supplier_notes: args.reason,
    });
    await logAction(ctx, {
      action: "auto_quote.draft.decline",
      target_type: "quote",
      target_id: args.quote_id,
      details: { reason: args.reason },
    });
  },
});

/**
 * Convenience query for clients/admins who need to know how many AUTO_DRAFT
 * quotes are still in flight on an RFQ — they're invisible to the client
 * until released.
 */
export const draftCountForRfq = internalQuery({
  args: { rfq_id: v.id("rfqs") },
  handler: async (ctx, args) => {
    const drafts = await ctx.db
      .query("quotes")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.rfq_id))
      .filter((q) => q.eq(q.field("status"), "AUTO_DRAFT"))
      .collect();
    return drafts.length;
  },
});

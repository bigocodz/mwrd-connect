/**
 * Three-way match: PO ↔ GRN ↔ Invoice (PRD §6.11).
 *
 * Reconciles a client_invoice against the underlying order's quote items
 * and any confirmed GRN lines. Surfaces drift to admin AP so nothing is
 * paid against an undelivered or short-shipped order.
 *
 * Trigger points (called from elsewhere as a non-mutation helper):
 *   - clientInvoices.createForOrder / createManual → after insert
 *   - grn.create → on every receipt
 *   - grn.resolveDiscrepancy → after admin closes a dispute
 *   - admin "Recompute match" button (manual)
 */
import { internalMutation, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib";
import { logAction } from "./audit";

type MatchStatus =
  | "MATCHED"
  | "MISMATCH"
  | "NO_GRN"
  | "DISPUTED_GRN"
  | "NOT_APPLICABLE";

interface MatchResult {
  status: MatchStatus;
  summary: string;
  matched_grn_ids: Id<"goods_receipt_notes">[];
}

const fmtMoney = (n: number) => n.toFixed(2);

/**
 * Internal logic. Reads order + GRNs + quote items and computes the match
 * verdict for an invoice. Pure-ish — only DB reads, no writes.
 */
async function computeMatchInternal(
  ctx: any,
  invoiceId: Id<"client_invoices">,
): Promise<MatchResult | null> {
  const invoice = await ctx.db.get(invoiceId);
  if (!invoice) return null;

  if (!invoice.order_id) {
    return {
      status: "NOT_APPLICABLE",
      summary: "Manual invoice with no underlying order",
      matched_grn_ids: [],
    };
  }

  const order = await ctx.db.get(invoice.order_id);
  if (!order) {
    return {
      status: "MISMATCH",
      summary: "Underlying order not found",
      matched_grn_ids: [],
    };
  }

  // All GRNs on this order
  const grns = await ctx.db
    .query("goods_receipt_notes")
    .withIndex("by_order", (q: any) => q.eq("order_id", invoice.order_id))
    .collect();

  const consideredGrns = grns.filter(
    (g: any) => g.status === "CONFIRMED" || g.status === "CLOSED",
  );
  const disputedGrns = grns.filter((g: any) => g.status === "DISPUTED");

  if (grns.length === 0) {
    return {
      status: "NO_GRN",
      summary: "No goods receipt has been recorded for this order yet",
      matched_grn_ids: [],
    };
  }
  if (disputedGrns.length > 0) {
    return {
      status: "DISPUTED_GRN",
      summary: `${disputedGrns.length} receipt(s) flagged with discrepancy — resolve before paying`,
      matched_grn_ids: consideredGrns.map((g: any) => g._id),
    };
  }

  // Aggregate received quantities by quote_item_id across all confirmed GRNs
  const receivedByQuoteItem = new Map<string, number>();
  for (const g of consideredGrns) {
    const lines = await ctx.db
      .query("grn_lines")
      .withIndex("by_grn", (q: any) => q.eq("grn_id", g._id))
      .collect();
    for (const ln of lines) {
      if (!ln.quote_item_id) continue;
      receivedByQuoteItem.set(
        String(ln.quote_item_id),
        (receivedByQuoteItem.get(String(ln.quote_item_id)) ?? 0) + ln.received_qty,
      );
    }
  }

  // Order's quoted items — what was supposed to ship
  const orderItems = await ctx.db
    .query("quote_items")
    .withIndex("by_quote", (q: any) => q.eq("quote_id", order.quote_id))
    .collect();

  const issues: string[] = [];
  let totalOrdered = 0;
  let totalShortReceived = 0;
  for (const it of orderItems) {
    if (!it.is_quoted) continue;
    const rfqItem = await ctx.db.get(it.rfq_item_id);
    const orderedQty = rfqItem?.quantity ?? 1;
    totalOrdered += orderedQty;
    const received = receivedByQuoteItem.get(String(it._id)) ?? 0;
    if (received < orderedQty) {
      totalShortReceived += orderedQty - received;
      issues.push(`Line short: received ${received} of ${orderedQty}`);
    }
  }

  // Amount drift: invoice total_amount vs order total_with_vat — small
  // tolerance for rounding.
  const orderTotal = order.total_with_vat ?? 0;
  const invoiceTotal = invoice.total_amount ?? 0;
  if (Math.abs(invoiceTotal - orderTotal) > 0.01) {
    issues.push(
      `Invoice total ${fmtMoney(invoiceTotal)} differs from order total ${fmtMoney(orderTotal)}`,
    );
  }

  if (issues.length > 0) {
    return {
      status: "MISMATCH",
      summary: issues.slice(0, 3).join(" · "),
      matched_grn_ids: consideredGrns.map((g: any) => g._id),
    };
  }
  return {
    status: "MATCHED",
    summary: `${consideredGrns.length} receipt(s), ${totalOrdered - totalShortReceived}/${totalOrdered} units`,
    matched_grn_ids: consideredGrns.map((g: any) => g._id),
  };
}

/**
 * Single-write helper. Computes the match and patches the invoice with the
 * result. Safe to call from inside other mutations (no auth check; caller
 * is expected to have already authorized).
 */
export async function recomputeMatchInternal(
  ctx: any,
  invoiceId: Id<"client_invoices">,
) {
  const result = await computeMatchInternal(ctx, invoiceId);
  if (!result) return null;
  await ctx.db.patch(invoiceId, {
    match_status: result.status,
    match_summary: result.summary,
    match_computed_at: Date.now(),
    matched_grn_ids: result.matched_grn_ids,
  });
  return result;
}

/**
 * Cascade helper: when a GRN lands or is resolved, recompute every invoice
 * tied to that order. Catches the common case where the receipt arrives
 * after the invoice was issued.
 */
export async function recomputeMatchForOrder(
  ctx: any,
  orderId: Id<"orders">,
) {
  const invoices = await ctx.db
    .query("client_invoices")
    .withIndex("by_order", (q: any) => q.eq("order_id", orderId))
    .collect();
  for (const inv of invoices) {
    if (inv.status === "VOID") continue;
    await recomputeMatchInternal(ctx, inv._id);
  }
}

// ==================== Public mutations ====================

export const recomputeForInvoice = mutation({
  // Admin manual trigger from the invoices list.
  args: { invoice_id: v.id("client_invoices") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const before = await ctx.db.get(args.invoice_id);
    if (!before) throw new ConvexError("Invoice not found");
    const result = await recomputeMatchInternal(ctx, args.invoice_id);
    if (!result) throw new ConvexError("Failed to compute match");
    await logAction(ctx, {
      action: "client_invoice.match.recompute",
      target_type: "client_invoice",
      target_id: args.invoice_id,
      before: { match_status: before.match_status },
      after: { match_status: result.status },
      details: { summary: result.summary },
    });
    return result;
  },
});

export const recomputeAll = internalMutation({
  // Backfill helper (e.g., after schema deploy or as a one-shot from the
  // Convex dashboard). Walks every non-void invoice and refreshes the
  // match cache.
  handler: async (ctx) => {
    const invoices = await ctx.db.query("client_invoices").collect();
    let processed = 0;
    for (const inv of invoices) {
      if (inv.status === "VOID") continue;
      await recomputeMatchInternal(ctx, inv._id);
      processed++;
    }
    return { processed };
  },
});

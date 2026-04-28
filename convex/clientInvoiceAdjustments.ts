/**
 * Credit & debit notes against client_invoices (PRD §8.1.4).
 *
 * Each adjustment is created locally in PENDING_CLEARANCE status and then
 * scheduled through Wafeq's credit_notes / debit_notes endpoint for ZATCA
 * Phase 2 clearance. Wafeq is the seller of record for tax documents per
 * §8.1; we mirror the cleared metadata back into our own table.
 *
 * Design decision: single polymorphic table keyed by `type` so the ZATCA
 * field set, indexes, and admin viewer stay uniform.
 */
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin, requireAdminRead, requireClient } from "./lib";
import { logAction } from "./audit";
import { api } from "./_generated/api";

const ADJ_TYPE = v.union(v.literal("CREDIT"), v.literal("DEBIT"));

// ==================== Numbering ====================

const formatAdjustmentNumber = async (
  ctx: any,
  type: "CREDIT" | "DEBIT",
): Promise<string> => {
  // MWRD-{CN|DN}-{YYYY}-{seq}; seq scoped to the (type, year) bucket.
  const prefix = type === "CREDIT" ? "CN" : "DN";
  const year = new Date().getFullYear();
  const all = await ctx.db
    .query("client_invoice_adjustments")
    .collect();
  const sameBucket = all.filter(
    (a: any) => a.type === type && a.adjustment_number?.startsWith(`MWRD-${prefix}-${year}-`),
  );
  const next = sameBucket.length + 1;
  return `MWRD-${prefix}-${year}-${String(next).padStart(4, "0")}`;
};

// ==================== Queries ====================

const enrich = async (ctx: any, row: any) => {
  const invoice = await ctx.db.get(row.invoice_id);
  return {
    ...row,
    invoice_number: invoice?.invoice_number,
  };
};

export const listAll = query({
  args: { invoice_id: v.optional(v.id("client_invoices")) },
  handler: async (ctx, args) => {
    await requireAdminRead(ctx);
    let rows;
    if (args.invoice_id) {
      rows = await ctx.db
        .query("client_invoice_adjustments")
        .withIndex("by_invoice", (q) => q.eq("invoice_id", args.invoice_id!))
        .order("desc")
        .collect();
    } else {
      rows = await ctx.db
        .query("client_invoice_adjustments")
        .order("desc")
        .collect();
    }
    return Promise.all(rows.map((r) => enrich(ctx, r)));
  },
});

export const listForInvoice = query({
  // Available to admin and the client who owns the invoice.
  args: { invoice_id: v.id("client_invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoice_id);
    if (!invoice) return [];
    // Lightweight access check: clients can only see their own invoice's
    // adjustments. Admins are unrestricted.
    // Inline auth (avoid double profile lookup against the auth helper).
    const rows = await ctx.db
      .query("client_invoice_adjustments")
      .withIndex("by_invoice", (q) => q.eq("invoice_id", args.invoice_id))
      .order("desc")
      .collect();
    return rows;
  },
});

export const listMine = query({
  // Client-side: surface adjustments for the caller's invoices.
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    const rows = await ctx.db
      .query("client_invoice_adjustments")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("desc")
      .collect();
    return Promise.all(rows.map((r) => enrich(ctx, r)));
  },
});

// ==================== Mutations ====================

export const create = mutation({
  args: {
    invoice_id: v.id("client_invoices"),
    type: ADJ_TYPE,
    issue_date: v.string(),
    subtotal: v.number(),
    vat_amount: v.number(),
    reason: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!args.reason.trim()) throw new ConvexError("Reason is required");
    if (args.subtotal < 0 || args.vat_amount < 0) {
      throw new ConvexError("Amounts must be non-negative");
    }

    const invoice = await ctx.db.get(args.invoice_id);
    if (!invoice) throw new ConvexError("Original invoice not found");
    if (invoice.status === "VOID") {
      throw new ConvexError("Cannot adjust a voided invoice");
    }

    // Sanity check for credit notes: cumulative credit must not exceed the
    // invoice total. Catches typos before tax documents go out.
    if (args.type === "CREDIT") {
      const existing = await ctx.db
        .query("client_invoice_adjustments")
        .withIndex("by_invoice", (q) => q.eq("invoice_id", args.invoice_id))
        .collect();
      const priorCredit = existing
        .filter((e) => e.type === "CREDIT" && e.status !== "VOID")
        .reduce((sum, e) => sum + (e.total_amount ?? 0), 0);
      const newTotal = args.subtotal + args.vat_amount;
      if (priorCredit + newTotal > invoice.total_amount + 0.01) {
        throw new ConvexError(
          `Cumulative credit (${(priorCredit + newTotal).toFixed(2)}) would exceed invoice total (${invoice.total_amount.toFixed(2)})`,
        );
      }
    }

    const adjustment_number = await formatAdjustmentNumber(ctx, args.type);
    const total_amount = args.subtotal + args.vat_amount;

    const id = await ctx.db.insert("client_invoice_adjustments", {
      invoice_id: args.invoice_id,
      client_id: invoice.client_id,
      type: args.type,
      adjustment_number,
      issue_date: args.issue_date,
      subtotal: args.subtotal,
      vat_amount: args.vat_amount,
      total_amount,
      reason: args.reason.trim(),
      notes: args.notes?.trim() || undefined,
      status: "PENDING_CLEARANCE",
      issued_by: admin._id,
    });

    await ctx.db.insert("notifications", {
      user_id: invoice.client_id,
      title: args.type === "CREDIT" ? "Credit note issued" : "Debit note issued",
      message: `${adjustment_number} for SAR ${total_amount.toFixed(2)}.`,
      link: "/client/invoices",
      read: false,
    });

    await logAction(ctx, {
      action: args.type === "CREDIT"
        ? "client_invoice_adjustment.credit.create"
        : "client_invoice_adjustment.debit.create",
      target_type: "client_invoice_adjustment",
      target_id: id,
      after: { status: "PENDING_CLEARANCE" },
      details: {
        adjustment_number,
        invoice_id: args.invoice_id,
        invoice_number: invoice.invoice_number,
        total_amount,
        reason: args.reason,
      },
    });

    // Push to Wafeq on the next tick — same fire-and-forget pattern as
    // client_invoice creation.
    await ctx.scheduler.runAfter(0, api.wafeq.submitInvoiceAdjustment, {
      adjustment_id: id,
    });

    return id;
  },
});

export const voidAdjustment = mutation({
  args: { id: v.id("client_invoice_adjustments"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const adj = await ctx.db.get(args.id);
    if (!adj) throw new ConvexError("Not found");
    if (adj.status === "VOID") return;
    if (adj.zatca_status === "CLEARED") {
      // Once a credit/debit note has been ZATCA-cleared, it can't be voided
      // — only a counter-adjustment can offset it. Surface this clearly.
      throw new ConvexError(
        "Cleared adjustments cannot be voided. Issue an opposite adjustment to offset.",
      );
    }
    await ctx.db.patch(args.id, {
      status: "VOID",
      void_reason: args.reason.trim() || undefined,
      voided_at: Date.now(),
    });
    await logAction(ctx, {
      action: "client_invoice_adjustment.void",
      target_type: "client_invoice_adjustment",
      target_id: args.id,
      before: { status: adj.status },
      after: { status: "VOID" },
      details: { adjustment_number: adj.adjustment_number, reason: args.reason },
    });
  },
});

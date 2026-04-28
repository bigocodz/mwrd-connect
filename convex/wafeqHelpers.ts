/**
 * V8-runtime helpers for convex/wafeq.ts.
 *
 * These live here (V8 runtime) because their parent wafeq.ts is `"use node";`
 * and Convex forbids `internalQuery` / `internalMutation` exports in Node
 * modules. The dispatch action runs them via `ctx.runQuery` / `ctx.runMutation`.
 */

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const _getProfile = internalQuery({
  args: { id: v.id("profiles") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const _getClientInvoice = internalQuery({
  args: { id: v.id("client_invoices") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const _getSupplierInvoice = internalQuery({
  args: { id: v.id("supplier_invoices") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const _persistContact = internalMutation({
  args: {
    profile_id: v.id("profiles"),
    wafeq_contact_id: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profile_id, {
      wafeq_contact_id: args.wafeq_contact_id,
      wafeq_contact_synced_at: Date.now(),
    });
  },
});

export const _persistClientInvoiceClearance = internalMutation({
  args: {
    invoice_id: v.id("client_invoices"),
    wafeq_invoice_id: v.string(),
    environment: v.union(
      v.literal("simulation"),
      v.literal("production"),
      v.literal("mock"),
    ),
    zatca_uuid: v.optional(v.string()),
    zatca_status: v.optional(v.string()),
    zatca_hash: v.optional(v.string()),
    zatca_qr: v.optional(v.string()),
    zatca_pdf_url: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoice_id, {
      wafeq_invoice_id: args.wafeq_invoice_id,
      wafeq_environment: args.environment,
      zatca_uuid: args.zatca_uuid,
      zatca_status: args.zatca_status,
      zatca_hash: args.zatca_hash,
      zatca_qr: args.zatca_qr,
      zatca_pdf_url: args.zatca_pdf_url,
      zatca_cleared_at: args.zatca_status === "CLEARED" ? Date.now() : undefined,
      zatca_last_error: args.error,
    });
  },
});

export const _persistClientInvoiceError = internalMutation({
  args: {
    invoice_id: v.id("client_invoices"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoice_id, { zatca_last_error: args.error });
  },
});

export const _listSyncableInvoices = internalQuery({
  // Returns the client_invoices we should poll Wafeq for: anything that has
  // been pushed to Wafeq but isn't terminal in our local books yet.
  handler: async (ctx) => {
    const all = await ctx.db.query("client_invoices").collect();
    return all
      .filter((inv) => !!inv.wafeq_invoice_id)
      .filter((inv) => inv.status !== "VOID")
      .map((inv) => ({
        _id: inv._id,
        wafeq_invoice_id: inv.wafeq_invoice_id!,
        wafeq_environment: inv.wafeq_environment,
        local_status: inv.status,
        zatca_status: inv.zatca_status,
      }));
  },
});

export const _findInvoiceByWafeqId = internalQuery({
  args: { wafeq_invoice_id: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("client_invoices").collect();
    return all.find((i) => i.wafeq_invoice_id === args.wafeq_invoice_id) ?? null;
  },
});

export const _applyRemoteState = internalMutation({
  // Single-write reconciliation: stamps zatca_status / pdf url / paid status
  // from a remote (Wafeq) snapshot. Used by both the cron and the webhook.
  args: {
    invoice_id: v.id("client_invoices"),
    zatca_status: v.optional(v.string()),
    zatca_pdf_url: v.optional(v.string()),
    paid: v.optional(v.boolean()),
    paid_reference: v.optional(v.string()),
    voided: v.optional(v.boolean()),
    void_reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.invoice_id);
    if (!existing) return;
    const patch: Record<string, unknown> = {};
    if (args.zatca_status && args.zatca_status !== existing.zatca_status) {
      patch.zatca_status = args.zatca_status;
      if (args.zatca_status === "CLEARED" && !existing.zatca_cleared_at) {
        patch.zatca_cleared_at = Date.now();
      }
    }
    if (args.zatca_pdf_url && args.zatca_pdf_url !== existing.zatca_pdf_url) {
      patch.zatca_pdf_url = args.zatca_pdf_url;
    }
    if (args.paid && existing.status !== "PAID" && existing.status !== "VOID") {
      patch.status = "PAID";
      patch.paid_at = Date.now();
      if (args.paid_reference) patch.paid_reference = args.paid_reference;
    }
    if (args.voided && existing.status !== "VOID" && existing.status !== "PAID") {
      patch.status = "VOID";
      patch.voided_at = Date.now();
      if (args.void_reason) patch.void_reason = args.void_reason;
    }
    if (Object.keys(patch).length === 0) return;
    await ctx.db.patch(args.invoice_id, patch);
  },
});

export const _getInvoiceAdjustment = internalQuery({
  args: { id: v.id("client_invoice_adjustments") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const _persistAdjustmentClearance = internalMutation({
  args: {
    adjustment_id: v.id("client_invoice_adjustments"),
    wafeq_adjustment_id: v.string(),
    environment: v.union(
      v.literal("simulation"),
      v.literal("production"),
      v.literal("mock"),
    ),
    zatca_uuid: v.optional(v.string()),
    zatca_status: v.optional(v.string()),
    zatca_hash: v.optional(v.string()),
    zatca_qr: v.optional(v.string()),
    zatca_pdf_url: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const status =
      args.zatca_status === "CLEARED" ? "CLEARED" : args.error ? "FAILED" : "PENDING_CLEARANCE";
    await ctx.db.patch(args.adjustment_id, {
      wafeq_adjustment_id: args.wafeq_adjustment_id,
      wafeq_environment: args.environment,
      zatca_uuid: args.zatca_uuid,
      zatca_status: args.zatca_status,
      zatca_hash: args.zatca_hash,
      zatca_qr: args.zatca_qr,
      zatca_pdf_url: args.zatca_pdf_url,
      zatca_cleared_at: status === "CLEARED" ? Date.now() : undefined,
      zatca_last_error: args.error,
      status,
    });
  },
});

export const _persistAdjustmentError = internalMutation({
  args: {
    adjustment_id: v.id("client_invoice_adjustments"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.adjustment_id, {
      zatca_last_error: args.error,
      status: "FAILED",
    });
  },
});

export const _persistSupplierBill = internalMutation({
  args: {
    supplier_invoice_id: v.id("supplier_invoices"),
    wafeq_bill_id: v.string(),
    environment: v.union(
      v.literal("simulation"),
      v.literal("production"),
      v.literal("mock"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.supplier_invoice_id, {
      wafeq_bill_id: args.wafeq_bill_id,
      wafeq_environment: args.environment,
    });
  },
});

export const _writeSyncLog = internalMutation({
  args: {
    operation: v.string(),
    idempotency_key: v.string(),
    environment: v.union(
      v.literal("simulation"),
      v.literal("production"),
      v.literal("mock"),
    ),
    target_type: v.string(),
    target_id: v.string(),
    status: v.union(
      v.literal("SUCCESS"),
      v.literal("API_ERROR"),
      v.literal("ZATCA_ERROR"),
      v.literal("NETWORK_ERROR"),
      v.literal("CONFIG_ERROR"),
    ),
    http_status: v.optional(v.number()),
    error_code: v.optional(v.string()),
    error_message: v.optional(v.string()),
    request_summary: v.optional(v.any()),
    response_summary: v.optional(v.any()),
    duration_ms: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("wafeq_sync_log", args);
  },
});

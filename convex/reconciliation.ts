import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib";

const sumAllocations = (allocations: { amount: number }[]) =>
  allocations.reduce((s, a) => s + a.amount, 0);

export const listOpenInvoicesForClient = query({
  args: { client_id: v.id("profiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const invoices = await ctx.db
      .query("client_invoices")
      .withIndex("by_client", (q) => q.eq("client_id", args.client_id))
      .collect();
    return invoices.filter(
      (inv) => inv.status === "PENDING_PAYMENT" || inv.status === "OVERDUE",
    );
  },
});

export const listPaymentAllocations = query({
  args: { payment_id: v.id("payments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("payment_allocations")
      .withIndex("by_payment", (q) => q.eq("payment_id", args.payment_id))
      .collect();
    return Promise.all(
      rows.map(async (a) => {
        const invoice = await ctx.db.get(a.invoice_id);
        return { ...a, invoice };
      }),
    );
  },
});

export const allocatePayment = mutation({
  args: {
    payment_id: v.id("payments"),
    allocations: v.array(
      v.object({
        invoice_id: v.id("client_invoices"),
        amount: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const payment = await ctx.db.get(args.payment_id);
    if (!payment) throw new ConvexError("Payment not found");
    if (payment.status !== "PAID") throw new ConvexError("Payment must be confirmed PAID before reconciling");
    if (args.allocations.length === 0) throw new ConvexError("Pick at least one invoice");

    const existing = await ctx.db
      .query("payment_allocations")
      .withIndex("by_payment", (q) => q.eq("payment_id", args.payment_id))
      .collect();
    const alreadyApplied = sumAllocations(existing);
    const newApplied = sumAllocations(args.allocations);
    if (alreadyApplied + newApplied > payment.amount + 0.01) {
      throw new ConvexError(
        `Allocations (SAR ${(alreadyApplied + newApplied).toFixed(2)}) exceed payment amount (SAR ${payment.amount.toFixed(2)})`,
      );
    }

    for (const allocation of args.allocations) {
      const invoice = await ctx.db.get(allocation.invoice_id);
      if (!invoice) throw new ConvexError("Invoice not found");
      if (invoice.client_id !== payment.client_id) {
        throw new ConvexError("Invoice belongs to a different client than this payment");
      }
      if (invoice.status === "PAID" || invoice.status === "VOID") {
        throw new ConvexError(`Invoice ${invoice.invoice_number} is ${invoice.status}`);
      }
      if (allocation.amount <= 0) throw new ConvexError("Allocation must be positive");
      if (Math.abs(allocation.amount - invoice.total_amount) > 0.01) {
        throw new ConvexError(
          `Partial allocations not supported yet — full invoice amount (${invoice.total_amount.toFixed(2)}) required for ${invoice.invoice_number}`,
        );
      }
      await ctx.db.insert("payment_allocations", {
        payment_id: args.payment_id,
        invoice_id: allocation.invoice_id,
        amount: allocation.amount,
        allocated_by: admin._id,
      });
      await ctx.db.patch(allocation.invoice_id, {
        status: "PAID",
        paid_at: Date.now(),
        paid_reference: payment.bank_reference ?? undefined,
        matched_payment_id: args.payment_id,
      });
      await ctx.db.insert("notifications", {
        user_id: invoice.client_id,
        title: "Invoice paid",
        message: `Invoice ${invoice.invoice_number} reconciled with payment ${payment.bank_reference ?? args.payment_id}.`,
        link: "/client/invoices",
        read: false,
      });
    }
  },
});

export const unallocatedTotalForPayment = query({
  args: { payment_id: v.id("payments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const payment = await ctx.db.get(args.payment_id);
    if (!payment) return 0;
    const allocs = await ctx.db
      .query("payment_allocations")
      .withIndex("by_payment", (q) => q.eq("payment_id", args.payment_id))
      .collect();
    return payment.amount - sumAllocations(allocs);
  },
});

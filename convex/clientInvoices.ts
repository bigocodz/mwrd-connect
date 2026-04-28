import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin, requireAdminRead, requireClient } from "./lib";
import { logAction } from "./audit";
import { api } from "./_generated/api";
import { recomputeMatchInternal } from "./threeWayMatch";
import { enqueueNotification } from "./notifyHelpers";

const enrich = async (ctx: any, invoice: any) => {
  const [client, order] = await Promise.all([
    ctx.db.get(invoice.client_id),
    invoice.order_id ? ctx.db.get(invoice.order_id) : null,
  ]);
  return {
    ...invoice,
    client_public_id: client?.public_id ?? "—",
    client_company_name: (client as any)?.company_name,
    order_status: order?.status,
    order_total: order?.total_with_vat,
  };
};

const formatInvoiceNumber = async (ctx: any) => {
  const all = await ctx.db.query("client_invoices").collect();
  const next = all.length + 1;
  const year = new Date().getFullYear();
  return `MWRD-${year}-${String(next).padStart(5, "0")}`;
};

export const listAll = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const invoices = await ctx.db.query("client_invoices").order("desc").collect();
    return Promise.all(invoices.map((inv) => enrich(ctx, inv)));
  },
});

export const listMine = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    const invoices = await ctx.db
      .query("client_invoices")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("desc")
      .collect();
    return Promise.all(invoices.map((inv) => enrich(ctx, inv)));
  },
});

export const listOrdersAvailableForInvoice = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const orders = await ctx.db.query("orders").collect();
    const eligible = orders.filter((o) =>
      ["DELIVERED", "COMPLETED"].includes(o.status),
    );
    const existing = await ctx.db.query("client_invoices").collect();
    const invoiced = new Set(
      existing
        .filter((i) => i.status !== "VOID" && i.order_id)
        .map((i) => i.order_id as Id<"orders">),
    );
    const remaining = eligible.filter((o) => !invoiced.has(o._id));
    return Promise.all(
      remaining.map(async (o) => {
        const client = await ctx.db.get(o.client_id);
        return {
          _id: o._id,
          status: o.status,
          total_before_vat: o.total_before_vat,
          total_with_vat: o.total_with_vat,
          completed_at: o.completed_at,
          delivered_at: o.delivered_at,
          client_id: o.client_id,
          client_public_id: client?.public_id ?? "—",
          client_company_name: (client as any)?.company_name,
        };
      }),
    );
  },
});

export const createForOrder = mutation({
  args: {
    order_id: v.id("orders"),
    issue_date: v.string(),
    due_date: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(args.order_id);
    if (!order) throw new ConvexError("Order not found");
    if (!["DELIVERED", "COMPLETED"].includes(order.status)) {
      throw new ConvexError("Only delivered or completed orders can be invoiced.");
    }
    const existing = await ctx.db
      .query("client_invoices")
      .withIndex("by_order", (q) => q.eq("order_id", args.order_id))
      .collect();
    if (existing.some((inv) => inv.status !== "VOID")) {
      throw new ConvexError("This order already has an active invoice.");
    }
    const invoice_number = await formatInvoiceNumber(ctx);
    const subtotal = order.total_before_vat ?? 0;
    const vat = (order.total_with_vat ?? 0) - subtotal;
    const id = await ctx.db.insert("client_invoices", {
      client_id: order.client_id,
      order_id: args.order_id,
      invoice_number,
      issue_date: args.issue_date,
      due_date: args.due_date,
      subtotal,
      vat_amount: vat,
      total_amount: order.total_with_vat ?? 0,
      notes: args.notes?.trim() || undefined,
      status: "PENDING_PAYMENT",
      issued_by: admin._id,
    });
    await enqueueNotification(ctx, {
      user_id: order.client_id,
      event_type: "invoice.issued",
      title: "New invoice issued",
      message: `Invoice ${invoice_number} for SAR ${(order.total_with_vat ?? 0).toFixed(2)}.`,
      link: "/client/invoices",
    });
    await logAction(ctx, {
      action: "client_invoice.create",
      target_type: "client_invoice",
      target_id: id,
      after: { status: "PENDING_PAYMENT" },
      details: {
        invoice_number,
        order_id: args.order_id,
        client_id: order.client_id,
        total_amount: order.total_with_vat ?? 0,
      },
    });
    // Three-way match on creation (PRD §6.11) — likely "NO_GRN" on the
    // first run, but stamps a baseline so admin sees the status badge.
    await recomputeMatchInternal(ctx, id);
    // Fire-and-forget Wafeq submission (PRD §8.1). Mutations can't call
    // actions synchronously; the scheduler runs it on the next tick. Mock
    // mode kicks in automatically when WAFEQ_API_KEY is unset.
    await ctx.scheduler.runAfter(0, api.wafeq.submitClientInvoice, { invoice_id: id });
    return id;
  },
});

export const createManual = mutation({
  args: {
    client_id: v.id("profiles"),
    issue_date: v.string(),
    due_date: v.string(),
    subtotal: v.number(),
    vat_amount: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const client = await ctx.db.get(args.client_id);
    if (!client || (client as any).role !== "CLIENT") throw new ConvexError("Invalid client");
    if (args.subtotal < 0 || args.vat_amount < 0) throw new ConvexError("Amounts must be non-negative");
    const invoice_number = await formatInvoiceNumber(ctx);
    const id = await ctx.db.insert("client_invoices", {
      client_id: args.client_id,
      order_id: undefined,
      invoice_number,
      issue_date: args.issue_date,
      due_date: args.due_date,
      subtotal: args.subtotal,
      vat_amount: args.vat_amount,
      total_amount: args.subtotal + args.vat_amount,
      notes: args.notes?.trim() || undefined,
      status: "PENDING_PAYMENT",
      issued_by: admin._id,
    });
    await enqueueNotification(ctx, {
      user_id: args.client_id,
      event_type: "invoice.issued",
      title: "New invoice issued",
      message: `Invoice ${invoice_number} for SAR ${(args.subtotal + args.vat_amount).toFixed(2)}.`,
      link: "/client/invoices",
    });
    await logAction(ctx, {
      action: "client_invoice.create_manual",
      target_type: "client_invoice",
      target_id: id,
      after: { status: "PENDING_PAYMENT" },
      details: {
        invoice_number,
        client_id: args.client_id,
        total_amount: args.subtotal + args.vat_amount,
      },
    });
    await recomputeMatchInternal(ctx, id);
    await ctx.scheduler.runAfter(0, api.wafeq.submitClientInvoice, { invoice_id: id });
    return id;
  },
});

export const markPaid = mutation({
  args: { id: v.id("client_invoices"), reference: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new ConvexError("Not found");
    if (invoice.status === "PAID") throw new ConvexError("Already paid");
    if (invoice.status === "VOID") throw new ConvexError("Invoice is void");
    await ctx.db.patch(args.id, {
      status: "PAID",
      paid_at: Date.now(),
      paid_reference: args.reference?.trim() || undefined,
    });
    await enqueueNotification(ctx, {
      user_id: invoice.client_id,
      event_type: "invoice.paid",
      title: "Payment received",
      message: `Invoice ${invoice.invoice_number} marked paid.`,
      link: "/client/invoices",
    });
    await logAction(ctx, {
      action: "client_invoice.mark_paid",
      target_type: "client_invoice",
      target_id: args.id,
      before: { status: invoice.status },
      after: { status: "PAID" },
      details: { invoice_number: invoice.invoice_number, reference: args.reference },
    });
  },
});

export const markOverdue = mutation({
  args: { id: v.id("client_invoices") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new ConvexError("Not found");
    if (invoice.status !== "PENDING_PAYMENT") throw new ConvexError("Only pending invoices can be flagged");
    await ctx.db.patch(args.id, { status: "OVERDUE" });
    await logAction(ctx, {
      action: "client_invoice.mark_overdue",
      target_type: "client_invoice",
      target_id: args.id,
      before: { status: "PENDING_PAYMENT" },
      after: { status: "OVERDUE" },
      details: { invoice_number: invoice.invoice_number },
    });
    await ctx.db.insert("notifications", {
      user_id: invoice.client_id,
      title: "Invoice overdue",
      message: `Invoice ${invoice.invoice_number} is past its due date.`,
      link: "/client/invoices",
      read: false,
    });
  },
});

export const sendReminder = mutation({
  args: { id: v.id("client_invoices") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new ConvexError("Not found");
    if (invoice.status !== "PENDING_PAYMENT" && invoice.status !== "OVERDUE") {
      throw new ConvexError("Only pending or overdue invoices can be reminded");
    }
    await ctx.db.patch(args.id, {
      last_reminder_at: Date.now(),
      reminder_count: (invoice.reminder_count ?? 0) + 1,
    });
    await ctx.db.insert("notifications", {
      user_id: invoice.client_id,
      title: "Invoice reminder",
      message: `Invoice ${invoice.invoice_number} for SAR ${invoice.total_amount.toFixed(2)} is due ${invoice.due_date}.`,
      link: "/client/invoices",
      read: false,
    });
  },
});

export const flagOverdueDue = internalMutation({
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    const pending = await ctx.db
      .query("client_invoices")
      .withIndex("by_status", (q) => q.eq("status", "PENDING_PAYMENT"))
      .collect();
    const flipped: Id<"client_invoices">[] = [];
    for (const invoice of pending) {
      if (invoice.due_date < today) {
        await ctx.db.patch(invoice._id, { status: "OVERDUE" });
        await ctx.db.insert("notifications", {
          user_id: invoice.client_id,
          title: "Invoice overdue",
          message: `Invoice ${invoice.invoice_number} (SAR ${invoice.total_amount.toFixed(2)}) is past due.`,
          link: "/client/invoices",
          read: false,
        });
        flipped.push(invoice._id);
      }
    }
    return { count: flipped.length };
  },
});

export const voidInvoice = mutation({
  args: { id: v.id("client_invoices"), reason: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new ConvexError("Not found");
    if (invoice.status === "PAID") throw new ConvexError("Cannot void a paid invoice");
    if (invoice.status === "VOID") return;
    await ctx.db.patch(args.id, {
      status: "VOID",
      void_reason: args.reason.trim(),
      voided_at: Date.now(),
    });
    await ctx.db.insert("notifications", {
      user_id: invoice.client_id,
      title: "Invoice voided",
      message: `${invoice.invoice_number} has been voided.`,
      link: "/client/invoices",
      read: false,
    });
    await logAction(ctx, {
      action: "client_invoice.void",
      target_type: "client_invoice",
      target_id: args.id,
      before: { status: invoice.status },
      after: { status: "VOID" },
      details: { invoice_number: invoice.invoice_number, reason: args.reason },
    });
  },
});

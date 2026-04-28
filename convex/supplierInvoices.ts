import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin, requireAdminRead, requireSupplier, getAuthenticatedProfile } from "./lib";
import { logAction } from "./audit";
import { enqueueNotification } from "./notifyHelpers";

const notify = async (
  ctx: any,
  userId: Id<"profiles">,
  title: string,
  message: string,
  link: string,
  event_type?: string,
) => {
  await enqueueNotification(ctx, { user_id: userId, event_type, title, message, link });
};

const notifyAdmins = async (
  ctx: any,
  title: string,
  message: string,
  link: string,
  event_type?: string,
) => {
  const admins = await ctx.db
    .query("profiles")
    .withIndex("by_role", (q: any) => q.eq("role", "ADMIN"))
    .collect();
  await Promise.all(
    admins.map((admin: any) => notify(ctx, admin._id, title, message, link, event_type)),
  );
};

const enrich = async (ctx: any, invoice: any) => {
  const [supplier, order] = await Promise.all([
    ctx.db.get(invoice.supplier_id),
    ctx.db.get(invoice.order_id),
  ]);
  const fileUrl = invoice.storage_id ? await ctx.storage.getUrl(invoice.storage_id) : null;
  return {
    ...invoice,
    supplier_public_id: supplier?.public_id ?? "—",
    supplier_company_name: supplier?.company_name,
    order: order
      ? {
          _id: order._id,
          status: order.status,
          total_with_vat: order.total_with_vat,
          completed_at: order.completed_at,
        }
      : null,
    file_url: fileUrl,
  };
};

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    return ctx.storage.generateUploadUrl();
  },
});

export const listEligibleOrders = query({
  handler: async (ctx) => {
    const profile = await requireSupplier(ctx);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .collect();
    const eligible = orders.filter((o) => ["DELIVERED", "COMPLETED"].includes(o.status));
    const existing = await ctx.db
      .query("supplier_invoices")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .collect();
    const invoiced = new Set(existing.map((inv) => inv.order_id));
    return eligible
      .filter((o) => !invoiced.has(o._id))
      .map((o) => ({
        _id: o._id,
        status: o.status,
        total_with_vat: o.total_with_vat,
        total_before_vat: o.total_before_vat,
        delivered_at: o.delivered_at,
        completed_at: o.completed_at,
      }));
  },
});

export const listMine = query({
  handler: async (ctx) => {
    const profile = await requireSupplier(ctx);
    const invoices = await ctx.db
      .query("supplier_invoices")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .order("desc")
      .collect();
    return Promise.all(invoices.map((inv) => enrich(ctx, inv)));
  },
});

export const listAll = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const invoices = await ctx.db.query("supplier_invoices").order("desc").collect();
    return Promise.all(invoices.map((inv) => enrich(ctx, inv)));
  },
});

export const submit = mutation({
  args: {
    order_id: v.id("orders"),
    invoice_number: v.string(),
    issue_date: v.string(),
    due_date: v.optional(v.string()),
    subtotal: v.number(),
    vat_amount: v.number(),
    total_amount: v.number(),
    notes: v.optional(v.string()),
    storage_id: v.optional(v.id("_storage")),
    file_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireSupplier(ctx);
    const order = await ctx.db.get(args.order_id);
    if (!order) throw new ConvexError("Order not found");
    if (order.supplier_id !== profile._id) throw new ConvexError("Forbidden");
    if (!["DELIVERED", "COMPLETED"].includes(order.status)) {
      throw new ConvexError("Invoices can only be submitted after delivery.");
    }
    const existing = await ctx.db
      .query("supplier_invoices")
      .withIndex("by_order", (q) => q.eq("order_id", args.order_id))
      .unique();
    if (existing) throw new ConvexError("An invoice has already been submitted for this order.");

    const invoiceId = await ctx.db.insert("supplier_invoices", {
      supplier_id: profile._id,
      order_id: args.order_id,
      invoice_number: args.invoice_number,
      issue_date: args.issue_date,
      due_date: args.due_date,
      subtotal: args.subtotal,
      vat_amount: args.vat_amount,
      total_amount: args.total_amount,
      notes: args.notes,
      storage_id: args.storage_id,
      file_name: args.file_name,
      status: "SUBMITTED",
    });
    await notifyAdmins(
      ctx,
      "New supplier invoice",
      `Invoice ${args.invoice_number} submitted for review.`,
      `/admin/supplier-invoices/${invoiceId}`,
    );
    await logAction(ctx, {
      action: "supplier_invoice.submit",
      target_type: "supplier_invoice",
      target_id: invoiceId,
      after: { status: "SUBMITTED" },
      details: {
        invoice_number: args.invoice_number,
        order_id: args.order_id,
        total_amount: args.total_amount,
      },
    });
    return invoiceId;
  },
});

const requireInvoice = async (ctx: any, id: Id<"supplier_invoices">) => {
  const invoice = await ctx.db.get(id);
  if (!invoice) throw new ConvexError("Invoice not found");
  return invoice;
};

export const approve = mutation({
  args: { id: v.id("supplier_invoices") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const invoice = await requireInvoice(ctx, args.id);
    if (invoice.status !== "SUBMITTED") throw new ConvexError("Only submitted invoices can be approved.");
    await ctx.db.patch(args.id, {
      status: "APPROVED",
      reviewed_by: admin._id,
      reviewed_at: Date.now(),
      rejection_reason: undefined,
    });
    await notify(
      ctx,
      invoice.supplier_id,
      "Invoice approved",
      `Invoice ${invoice.invoice_number} was approved.`,
      `/supplier/invoices`,
    );
    await logAction(ctx, {
      action: "supplier_invoice.approve",
      target_type: "supplier_invoice",
      target_id: args.id,
      before: { status: "SUBMITTED" },
      after: { status: "APPROVED" },
      details: { invoice_number: invoice.invoice_number },
    });
  },
});

export const reject = mutation({
  args: { id: v.id("supplier_invoices"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const invoice = await requireInvoice(ctx, args.id);
    if (invoice.status !== "SUBMITTED") throw new ConvexError("Only submitted invoices can be rejected.");
    await ctx.db.patch(args.id, {
      status: "REJECTED",
      reviewed_by: admin._id,
      reviewed_at: Date.now(),
      rejection_reason: args.reason,
    });
    await notify(
      ctx,
      invoice.supplier_id,
      "Invoice rejected",
      args.reason,
      `/supplier/invoices`,
    );
    await logAction(ctx, {
      action: "supplier_invoice.reject",
      target_type: "supplier_invoice",
      target_id: args.id,
      before: { status: "SUBMITTED" },
      after: { status: "REJECTED" },
      details: { invoice_number: invoice.invoice_number, reason: args.reason },
    });
  },
});

export const markPaid = mutation({
  args: { id: v.id("supplier_invoices"), reference: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const invoice = await requireInvoice(ctx, args.id);
    if (invoice.status !== "APPROVED") throw new ConvexError("Only approved invoices can be marked paid.");
    await ctx.db.patch(args.id, {
      status: "PAID",
      paid_at: Date.now(),
      paid_reference: args.reference,
      reviewed_by: admin._id,
    });
    await notify(
      ctx,
      invoice.supplier_id,
      "Invoice paid",
      `Invoice ${invoice.invoice_number} was paid.`,
      `/supplier/invoices`,
    );
    await logAction(ctx, {
      action: "supplier_invoice.mark_paid",
      target_type: "supplier_invoice",
      target_id: args.id,
      before: { status: "APPROVED" },
      after: { status: "PAID" },
      details: { invoice_number: invoice.invoice_number, reference: args.reference },
    });
  },
});

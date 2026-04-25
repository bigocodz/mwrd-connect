import { query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthenticatedProfile } from "./lib";

const isWithinRange = (timestamp: number | undefined, from?: number, to?: number) => {
  if (timestamp === undefined) return false;
  if (from !== undefined && timestamp < from) return false;
  if (to !== undefined && timestamp > to) return false;
  return true;
};

const dateStringToTimestamp = (raw?: string) => {
  if (!raw) return undefined;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : undefined;
};

const buildStatement = async (
  ctx: any,
  clientId: Id<"profiles">,
  fromMs: number | undefined,
  toMs: number | undefined,
) => {
  const client = await ctx.db.get(clientId);
  if (!client) throw new ConvexError("Client not found");

  const invoices = await ctx.db
    .query("client_invoices")
    .withIndex("by_client", (q: any) => q.eq("client_id", clientId))
    .collect();
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_client", (q: any) => q.eq("client_id", clientId))
    .collect();

  const filteredInvoices = invoices.filter((inv: any) =>
    isWithinRange(new Date(inv.issue_date).getTime(), fromMs, toMs),
  );
  const filteredPayments = payments.filter((p: any) =>
    isWithinRange(p.confirmed_at ?? p._creationTime, fromMs, toMs),
  );

  const issuedTotal = filteredInvoices
    .filter((inv: any) => inv.status !== "VOID")
    .reduce((sum: number, inv: any) => sum + (inv.total_amount ?? 0), 0);
  const paidInvoiceTotal = filteredInvoices
    .filter((inv: any) => inv.status === "PAID")
    .reduce((sum: number, inv: any) => sum + (inv.total_amount ?? 0), 0);
  const outstandingTotal = filteredInvoices
    .filter((inv: any) => inv.status === "PENDING_PAYMENT" || inv.status === "OVERDUE")
    .reduce((sum: number, inv: any) => sum + (inv.total_amount ?? 0), 0);
  const paymentsReceived = filteredPayments
    .filter((p: any) => p.status === "PAID")
    .reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);

  const lines = [
    ...filteredInvoices.map((inv: any) => ({
      type: "INVOICE" as const,
      timestamp: new Date(inv.issue_date).getTime(),
      reference: inv.invoice_number,
      description:
        inv.status === "VOID"
          ? `Invoice ${inv.invoice_number} (VOID)`
          : `Invoice ${inv.invoice_number}${inv.order_id ? ` for order ${inv.order_id.slice(0, 8)}` : ""}`,
      debit: inv.status === "VOID" ? 0 : inv.total_amount ?? 0,
      credit: 0,
      status: inv.status,
    })),
    ...filteredPayments.map((p: any) => ({
      type: "PAYMENT" as const,
      timestamp: p.confirmed_at ?? p._creationTime,
      reference: p.bank_reference ?? p._id,
      description: `Payment via ${p.payment_method}${p.order_id ? ` for order ${p.order_id}` : ""}`,
      debit: 0,
      credit: p.status === "PAID" ? p.amount ?? 0 : 0,
      status: p.status,
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  return {
    client: {
      _id: client._id,
      public_id: client.public_id,
      company_name: (client as any).company_name,
      credit_limit: (client as any).credit_limit ?? 0,
      current_balance: (client as any).current_balance ?? 0,
    },
    range: { from: fromMs ?? null, to: toMs ?? null },
    totals: {
      issued: issuedTotal,
      paid_invoices: paidInvoiceTotal,
      outstanding_invoices: outstandingTotal,
      payments_received: paymentsReceived,
      net_balance: issuedTotal - paymentsReceived,
    },
    lines,
  };
};

export const myStatement = query({
  args: { from: v.optional(v.string()), to: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    if (profile.role !== "CLIENT") throw new ConvexError("Clients only");
    const fromMs = dateStringToTimestamp(args.from);
    const toMs = dateStringToTimestamp(args.to);
    return buildStatement(ctx, profile._id, fromMs, toMs);
  },
});

export const adminClientStatement = query({
  args: {
    client_id: v.id("profiles"),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    if (profile.role !== "ADMIN") throw new ConvexError("Admins only");
    const fromMs = dateStringToTimestamp(args.from);
    const toMs = dateStringToTimestamp(args.to);
    return buildStatement(ctx, args.client_id, fromMs, toMs);
  },
});

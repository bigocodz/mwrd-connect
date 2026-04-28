/**
 * Reports & analytics (PRD §6.12 client + §7.9 supplier).
 *
 * Pure read aggregations against existing tables. Each query takes an
 * optional `from` / `to` window in ms; missing bounds default to "all
 * time". Numbers are computed in-memory on the server — fine for v1
 * volumes, can move to denormalized rollups later when 100k+ orders
 * make full-table scans expensive.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdminRead, requireClient, requireSupplier } from "./lib";

const inWindow = (ts: number, from?: number, to?: number) => {
  if (from != null && ts < from) return false;
  if (to != null && ts > to) return false;
  return true;
};

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

// ==================== Client: spend by category ====================

export const clientSpend = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const invoices = await ctx.db
      .query("client_invoices")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .collect();
    const inWindowInvoices = invoices.filter((inv) =>
      inWindow(inv._creationTime, args.from, args.to),
    );

    let totalIssued = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalVoid = 0;
    let totalVat = 0;
    const byCategory: Map<string, { invoiced: number; paid: number; count: number }> = new Map();
    const byBranch: Map<string, { invoiced: number; count: number }> = new Map();
    const byMonth: Map<string, { invoiced: number; paid: number }> = new Map();

    for (const inv of inWindowInvoices) {
      if (inv.status === "VOID") {
        totalVoid += inv.total_amount;
        continue;
      }
      totalIssued += inv.total_amount;
      totalVat += inv.vat_amount ?? 0;
      if (inv.status === "PAID") totalPaid += inv.total_amount;
      else totalOutstanding += inv.total_amount;

      // Category from underlying order's RFQ
      let category = "Manual";
      let branchKey = "—";
      if (inv.order_id) {
        const order = await ctx.db.get(inv.order_id);
        if (order) {
          const rfq = await ctx.db.get(order.rfq_id);
          if (rfq?.category) category = rfq.category;
          if (rfq?.branch_id) {
            const branch = await ctx.db.get(rfq.branch_id);
            if (branch) branchKey = branch.name;
          }
        }
      }
      const cat = byCategory.get(category) ?? { invoiced: 0, paid: 0, count: 0 };
      cat.invoiced += inv.total_amount;
      cat.count += 1;
      if (inv.status === "PAID") cat.paid += inv.total_amount;
      byCategory.set(category, cat);

      const br = byBranch.get(branchKey) ?? { invoiced: 0, count: 0 };
      br.invoiced += inv.total_amount;
      br.count += 1;
      byBranch.set(branchKey, br);

      const month = new Date(inv._creationTime).toISOString().slice(0, 7);
      const m = byMonth.get(month) ?? { invoiced: 0, paid: 0 };
      m.invoiced += inv.total_amount;
      if (inv.status === "PAID") m.paid += inv.total_amount;
      byMonth.set(month, m);
    }

    return {
      window: { from: args.from ?? null, to: args.to ?? null },
      totals: {
        invoiceCount: inWindowInvoices.length,
        issued: totalIssued,
        paid: totalPaid,
        outstanding: totalOutstanding,
        vat: totalVat,
        voided: totalVoid,
      },
      byCategory: [...byCategory.entries()]
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.invoiced - a.invoiced),
      byBranch: [...byBranch.entries()]
        .map(([branch, v]) => ({ branch, ...v }))
        .sort((a, b) => b.invoiced - a.invoiced),
      byMonth: [...byMonth.entries()]
        .map(([month, v]) => ({ month, ...v }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };
  },
});

// ==================== Client: RFQ funnel + cycle time ====================

export const clientRfqFunnel = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const rfqs = await ctx.db
      .query("rfqs")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .collect();
    const windowed = rfqs.filter((r) => inWindow(r._creationTime, args.from, args.to));

    let quoted = 0;
    let awarded = 0;
    let delivered = 0;
    const cycleTimes: number[] = [];
    const onTimeStats: Array<{ onTime: boolean }> = [];

    for (const rfq of windowed) {
      const rfqQuotes = await ctx.db
        .query("quotes")
        .withIndex("by_rfq", (q) => q.eq("rfq_id", rfq._id))
        .collect();
      if (rfqQuotes.some((q: any) => q.status !== "PENDING_ADMIN")) quoted += 1;

      const accepted = rfqQuotes.find((q: any) => q.status === "ACCEPTED");
      if (accepted) {
        awarded += 1;
        // Find the order tied to this accepted quote
        const order = await ctx.db
          .query("orders")
          .withIndex("by_quote", (q) => q.eq("quote_id", accepted._id))
          .unique();
        if (order && (order.status === "DELIVERED" || order.status === "COMPLETED")) {
          delivered += 1;
          if (order.delivered_at) {
            cycleTimes.push((order.delivered_at - rfq._creationTime) / 3600000);
            // On-time check vs required_by
            if (order.required_by) {
              const requiredMs = new Date(order.required_by).getTime();
              if (Number.isFinite(requiredMs)) {
                onTimeStats.push({ onTime: order.delivered_at <= requiredMs });
              }
            }
          }
        }
      }
    }

    const onTimeRate =
      onTimeStats.length === 0
        ? null
        : (100 * onTimeStats.filter((s) => s.onTime).length) / onTimeStats.length;

    return {
      window: { from: args.from ?? null, to: args.to ?? null },
      funnel: {
        rfqs: windowed.length,
        quoted,
        awarded,
        delivered,
      },
      conversion: {
        quoteRate: windowed.length ? (100 * quoted) / windowed.length : null,
        awardRate: quoted ? (100 * awarded) / quoted : null,
        deliveryRate: awarded ? (100 * delivered) / awarded : null,
      },
      cycleTime: {
        medianHours: median(cycleTimes),
        n: cycleTimes.length,
      },
      onTimeRate,
    };
  },
});

// ==================== Supplier: performance scorecard ====================

export const supplierPerformance = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    /** Admin can pass a specific supplier_id; suppliers see their own. */
    supplier_id: v.optional(v.id("profiles")),
  },
  handler: async (ctx, args) => {
    let supplierId: Id<"profiles">;
    if (args.supplier_id) {
      await requireAdminRead(ctx);
      supplierId = args.supplier_id;
    } else {
      const me = await requireSupplier(ctx);
      supplierId = me._id;
    }

    const assignments = await ctx.db
      .query("rfq_supplier_assignments")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", supplierId))
      .collect();
    const inWindowAssignments = assignments.filter((a) =>
      inWindow(a.assigned_at ?? a._creationTime, args.from, args.to),
    );

    let quoted = 0;
    let won = 0;
    let lost = 0;
    let expired = 0;
    const responseHours: number[] = [];

    for (const a of inWindowAssignments) {
      const quote = await ctx.db
        .query("quotes")
        .withIndex("by_rfq", (q) => q.eq("rfq_id", a.rfq_id))
        .filter((q) => q.eq(q.field("supplier_id"), supplierId))
        .unique();
      if (!quote) continue;
      quoted += 1;
      if (quote.status === "ACCEPTED") won += 1;
      else if (quote.status === "REJECTED") lost += 1;
      const assignedAt = a.assigned_at ?? a._creationTime;
      responseHours.push((quote._creationTime - assignedAt) / 3600000);
    }

    // Orders the supplier fulfilled in the window
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", supplierId))
      .collect();
    const windowOrders = orders.filter((o) => inWindow(o._creationTime, args.from, args.to));

    let totalRevenue = 0;
    let onTimeDeliveries = 0;
    let lateDeliveries = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;
    let disputedCount = 0;
    const deliveryHours: number[] = [];
    for (const o of windowOrders) {
      if (o.status === "CANCELLED") {
        cancelledCount += 1;
        continue;
      }
      if (o.dispute_status === "OPEN" || o.dispute_status === "RESOLVED") {
        disputedCount += 1;
      }
      if (o.status === "DELIVERED" || o.status === "COMPLETED") {
        deliveredCount += 1;
        totalRevenue += o.total_with_vat ?? 0;
        if (o.dispatched_at && o.delivered_at) {
          deliveryHours.push((o.delivered_at - o.dispatched_at) / 3600000);
        }
        if (o.required_by && o.delivered_at) {
          const required = new Date(o.required_by).getTime();
          if (Number.isFinite(required)) {
            if (o.delivered_at <= required) onTimeDeliveries += 1;
            else lateDeliveries += 1;
          }
        }
      }
    }

    const responseRate = inWindowAssignments.length
      ? (100 * quoted) / inWindowAssignments.length
      : null;
    const winRate = quoted ? (100 * won) / quoted : null;
    const onTimeRate =
      onTimeDeliveries + lateDeliveries === 0
        ? null
        : (100 * onTimeDeliveries) / (onTimeDeliveries + lateDeliveries);

    return {
      window: { from: args.from ?? null, to: args.to ?? null },
      rfqs: {
        assigned: inWindowAssignments.length,
        quoted,
        won,
        lost,
        expired,
      },
      rates: {
        responseRate,
        winRate,
        avgResponseHours:
          responseHours.length === 0
            ? null
            : responseHours.reduce((a, b) => a + b, 0) / responseHours.length,
      },
      delivery: {
        deliveredCount,
        cancelledCount,
        disputedCount,
        onTimeDeliveries,
        lateDeliveries,
        onTimeRate,
        medianDeliveryHours: median(deliveryHours),
      },
      revenue: {
        total: totalRevenue,
        currency: "SAR",
      },
    };
  },
});

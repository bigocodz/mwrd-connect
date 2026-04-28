import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminRead, requireSupplier } from "./lib";

const DAY = 24 * 60 * 60 * 1000;

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const avg = (values: number[]) => (values.length ? values.reduce((s, n) => s + n, 0) / values.length : null);

export const adminStats = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);

    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const ms = monthStart.getTime();

    // Pending counts
    const [pendingProducts, pendingQuotes, pendingPayouts] = await Promise.all([
      ctx.db
        .query("products")
        .withIndex("by_approval", (q) => q.eq("approval_status", "PENDING"))
        .collect()
        .then((r) => r.length),
      ctx.db
        .query("quotes")
        .withIndex("by_status", (q) => q.eq("status", "PENDING_ADMIN"))
        .collect()
        .then((r) => r.length),
      ctx.db
        .query("supplier_payouts")
        .withIndex("by_status", (q) => q.eq("status", "PENDING"))
        .collect()
        .then((r) => r.length),
    ]);

    // Monthly revenue (confirmed payments this month)
    const paidPayments = await ctx.db
      .query("payments")
      .withIndex("by_status", (q) => q.eq("status", "PAID"))
      .collect();
    const monthlyRevenue = paidPayments
      .filter((p) => p.confirmed_at && p.confirmed_at >= ms && p.confirmed_at <= now)
      .reduce((sum, p) => sum + p.amount, 0);

    // Monthly payouts
    const allPayouts = await ctx.db.query("supplier_payouts").collect();
    const monthlyPayouts = allPayouts
      .filter((p) => p._creationTime >= ms && p._creationTime <= now)
      .reduce((sum, p) => sum + p.amount, 0);

    // Active counts
    const [activeClients, activeSuppliers] = await Promise.all([
      ctx.db
        .query("profiles")
        .withIndex("by_role", (q) => q.eq("role", "CLIENT"))
        .filter((q) => q.eq(q.field("status"), "ACTIVE"))
        .collect()
        .then((r) => r.length),
      ctx.db
        .query("profiles")
        .withIndex("by_role", (q) => q.eq("role", "SUPPLIER"))
        .filter((q) => q.eq(q.field("status"), "ACTIVE"))
        .collect()
        .then((r) => r.length),
    ]);

    // Monthly RFQ counts
    const allRfqs = await ctx.db.query("rfqs").collect();
    const monthlyRfqs = allRfqs.filter((r) => r._creationTime >= ms && r._creationTime <= now).length;
    const monthlyQuotedRfqs = allRfqs.filter(
      (r) =>
        r._creationTime >= ms &&
        r._creationTime <= now &&
        (r.status === "QUOTED" || r.status === "CLOSED"),
    ).length;

    // Top suppliers by rating
    const reviews = await ctx.db.query("reviews").collect();
    const supplierRatings: Record<string, { total: number; count: number }> = {};
    for (const r of reviews) {
      const id = r.supplier_id;
      if (!supplierRatings[id]) supplierRatings[id] = { total: 0, count: 0 };
      supplierRatings[id].total += r.rating;
      supplierRatings[id].count += 1;
    }
    const topSupplierIds = Object.entries(supplierRatings)
      .map(([id, { total, count }]) => ({ id, avg: total / count, count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
      .map((s) => s.id);
    const topSuppliers = await Promise.all(
      topSupplierIds.map(async (id) => {
        const profile = await ctx.db.get(id as any);
        const stats = supplierRatings[id];
        return {
          id,
          company_name: (profile as any)?.company_name ?? "—",
          avg_rating: stats.total / stats.count,
          review_count: stats.count,
        };
      }),
    );

    // Clients with high credit utilization
    const clients = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "CLIENT"))
      .filter((q) => q.eq(q.field("status"), "ACTIVE"))
      .collect();
    const creditAlerts = clients
      .filter((c) => c.credit_limit && c.credit_limit > 0)
      .map((c) => ({
        id: c._id,
        company_name: c.company_name ?? "—",
        credit_limit: c.credit_limit ?? 0,
        current_balance: c.current_balance ?? 0,
        utilization: ((c.current_balance ?? 0) / (c.credit_limit ?? 1)) * 100,
      }))
      .filter((c) => c.utilization >= 80)
      .sort((a, b) => b.utilization - a.utilization)
      .slice(0, 5);

    return {
      pendingProducts,
      pendingQuotes,
      pendingPayouts,
      monthlyRevenue,
      monthlyPayouts,
      activeClients,
      activeSuppliers,
      monthlyRfqs,
      monthlyQuotedRfqs,
      topSuppliers,
      creditAlerts,
    };
  },
});

export const supplierAnalytics = query({
  args: { windowDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const profile = await requireSupplier(ctx);
    const windowDays = args.windowDays ?? 90;
    const since = Date.now() - windowDays * DAY;

    const [assignments, quotes, orders, payouts, reviews, invoices] = await Promise.all([
      ctx.db
        .query("rfq_supplier_assignments")
        .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
        .collect(),
      ctx.db
        .query("quotes")
        .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
        .collect(),
      ctx.db
        .query("orders")
        .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
        .collect(),
      ctx.db
        .query("supplier_payouts")
        .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
        .collect(),
      ctx.db
        .query("reviews")
        .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
        .collect(),
      ctx.db
        .query("supplier_invoices")
        .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
        .collect(),
    ]);

    const recentAssignments = assignments.filter(
      (a) => (a.assigned_at ?? a._creationTime) >= since,
    );
    const recentQuotes = quotes.filter((q) => q._creationTime >= since);
    const recentOrders = orders.filter((o) => o._creationTime >= since);

    // Response: assignments → first quote
    const responseTimes: number[] = [];
    let responded = 0;
    for (const a of recentAssignments) {
      const firstQuote = quotes
        .filter((q) => q.rfq_id === a.rfq_id)
        .sort((q1, q2) => q1._creationTime - q2._creationTime)[0];
      if (firstQuote) {
        responded += 1;
        const start = a.assigned_at ?? a._creationTime;
        const delta = firstQuote._creationTime - start;
        if (delta > 0) responseTimes.push(delta);
      }
    }
    const responseRate = recentAssignments.length
      ? (responded / recentAssignments.length) * 100
      : null;
    const avgResponseHours = avg(responseTimes.map((d) => d / (60 * 60 * 1000)));

    // Win rate: quotes that became ACCEPTED
    const wins = recentQuotes.filter((q) => q.status === "ACCEPTED").length;
    const winRate = recentQuotes.length ? (wins / recentQuotes.length) * 100 : null;

    // Order outcomes
    const completedOrders = recentOrders.filter((o) => o.status === "COMPLETED").length;
    const inFlightOrders = recentOrders.filter((o) =>
      ["PENDING_CONFIRMATION", "CONFIRMED", "PREPARING", "DISPATCHED", "DELIVERED"].includes(
        o.status,
      ),
    ).length;
    const cancelledOrders = recentOrders.filter((o) => o.status === "CANCELLED").length;
    const totalCompletedValue = recentOrders
      .filter((o) => o.status === "COMPLETED")
      .reduce((s, o) => s + (o.total_with_vat ?? 0), 0);

    // Delivery SLA (per supplier)
    const deliveryDurations: number[] = [];
    let lateDeliveries = 0;
    let deliveredWithEta = 0;
    for (const o of recentOrders) {
      if (o.dispatched_at && o.delivered_at) {
        deliveryDurations.push(o.delivered_at - o.dispatched_at);
      }
      if (o.required_by && o.delivered_at) {
        deliveredWithEta += 1;
        if (o.delivered_at > new Date(o.required_by).getTime()) lateDeliveries += 1;
      }
    }
    const medianDeliveryHours = median(deliveryDurations.map((d) => d / (60 * 60 * 1000)));
    const onTimeRate = deliveredWithEta
      ? ((deliveredWithEta - lateDeliveries) / deliveredWithEta) * 100
      : null;

    // Disputes
    const disputed = recentOrders.filter((o) => o.dispute_status).length;
    const deliveredOrCompleted = recentOrders.filter((o) =>
      ["DELIVERED", "COMPLETED"].includes(o.status),
    ).length;
    const disputeRate = deliveredOrCompleted ? (disputed / deliveredOrCompleted) * 100 : null;

    // Ratings
    const ratingsCount = reviews.length;
    const avgRating = avg(reviews.map((r) => r.rating));

    // Payout aging (PENDING by age bucket)
    const now = Date.now();
    const pendingPayouts = payouts.filter((p) => p.status === "PENDING");
    const buckets = { "0-7": 0, "8-14": 0, "15-30": 0, "30+": 0 };
    let pendingTotal = 0;
    for (const p of pendingPayouts) {
      pendingTotal += p.amount;
      const ageDays = (now - p._creationTime) / DAY;
      if (ageDays <= 7) buckets["0-7"] += p.amount;
      else if (ageDays <= 14) buckets["8-14"] += p.amount;
      else if (ageDays <= 30) buckets["15-30"] += p.amount;
      else buckets["30+"] += p.amount;
    }
    const paidLast30 = payouts
      .filter((p) => p.status === "PAID" && (p.paid_at ?? 0) >= now - 30 * DAY)
      .reduce((s, p) => s + p.amount, 0);

    // Invoices summary
    const invoiceSubmitted = invoices.filter((i) => i.status === "SUBMITTED").length;
    const invoiceApproved = invoices.filter((i) => i.status === "APPROVED").length;
    const invoicePaid = invoices.filter((i) => i.status === "PAID").length;
    const invoiceRejected = invoices.filter((i) => i.status === "REJECTED").length;

    return {
      windowDays,
      assignedCount: recentAssignments.length,
      quotedCount: recentQuotes.length,
      responseRate,
      avgResponseHours,
      wins,
      winRate,
      completedOrders,
      inFlightOrders,
      cancelledOrders,
      totalCompletedValue,
      medianDeliveryHours,
      onTimeRate,
      lateDeliveries,
      deliveredWithEta,
      disputeRate,
      disputedCount: disputed,
      avgRating,
      ratingsCount,
      payoutPending: { total: pendingTotal, count: pendingPayouts.length, buckets },
      paidLast30,
      invoiceCounts: {
        submitted: invoiceSubmitted,
        approved: invoiceApproved,
        paid: invoicePaid,
        rejected: invoiceRejected,
      },
    };
  },
});

export const lifecycleMetrics = query({
  args: { windowDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminRead(ctx);
    const windowDays = args.windowDays ?? 90;
    const since = Date.now() - windowDays * DAY;

    const [allRfqs, allQuotes, allOrders, allAssignments, allRevisionEvents] = await Promise.all([
      ctx.db.query("rfqs").collect(),
      ctx.db.query("quotes").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("rfq_supplier_assignments").collect(),
      ctx.db.query("quote_revision_events").collect(),
    ]);

    const recentRfqs = allRfqs.filter((r) => r._creationTime >= since);
    const recentQuotes = allQuotes.filter((q) => q._creationTime >= since);
    const recentOrders = allOrders.filter((o) => o._creationTime >= since);

    // Quote coverage: % of recent RFQs that received at least one client-visible quote
    const rfqIdsWithSentQuote = new Set(
      allQuotes
        .filter((q) => q.status !== "PENDING_ADMIN")
        .map((q) => q.rfq_id),
    );
    const rfqsWithCoverage = recentRfqs.filter((r) => rfqIdsWithSentQuote.has(r._id)).length;
    const quoteCoverage = recentRfqs.length ? (rfqsWithCoverage / recentRfqs.length) * 100 : null;

    // Supplier response rate: assignments that produced a quote
    const recentAssignments = allAssignments.filter((a) => (a.assigned_at ?? a._creationTime) >= since);
    const responseHits = recentAssignments.filter((a) =>
      allQuotes.some((q) => q.rfq_id === a.rfq_id && q.supplier_id === a.supplier_id),
    ).length;
    const supplierResponseRate = recentAssignments.length
      ? (responseHits / recentAssignments.length) * 100
      : null;

    // Average supplier response time (assigned → first quote submission)
    const responseTimes: number[] = [];
    for (const assignment of recentAssignments) {
      const firstQuote = allQuotes
        .filter((q) => q.rfq_id === assignment.rfq_id && q.supplier_id === assignment.supplier_id)
        .sort((a, b) => a._creationTime - b._creationTime)[0];
      if (firstQuote) {
        const start = assignment.assigned_at ?? assignment._creationTime;
        const delta = firstQuote._creationTime - start;
        if (delta > 0) responseTimes.push(delta);
      }
    }
    const avgSupplierResponseHours = avg(responseTimes.map((d) => d / (60 * 60 * 1000)));

    // RFQ cycle time: creation → first ACCEPTED quote
    const acceptedQuotesByRfq = new Map<string, any>();
    for (const q of allQuotes) {
      if (q.status !== "ACCEPTED") continue;
      const existing = acceptedQuotesByRfq.get(q.rfq_id);
      if (!existing || q._creationTime < existing._creationTime) {
        acceptedQuotesByRfq.set(q.rfq_id, q);
      }
    }
    const cycleDurations: number[] = [];
    for (const rfq of recentRfqs) {
      const accepted = acceptedQuotesByRfq.get(rfq._id);
      if (accepted) cycleDurations.push(accepted._creationTime - rfq._creationTime);
    }
    const medianRfqCycleHours = median(cycleDurations.map((d) => d / (60 * 60 * 1000)));

    // Quote turnaround: PENDING_ADMIN -> SENT_TO_CLIENT (uses reviewed_at)
    const adminTurnaround = allQuotes
      .filter((q) => q.reviewed_at && q._creationTime >= since)
      .map((q) => (q.reviewed_at ?? 0) - q._creationTime)
      .filter((d) => d > 0);
    const medianAdminTurnaroundHours = median(adminTurnaround.map((d) => d / (60 * 60 * 1000)));

    // Order delivery SLA: dispatched_at -> delivered_at
    const deliveryTimes: number[] = [];
    let lateDeliveries = 0;
    for (const order of recentOrders) {
      if (order.dispatched_at && order.delivered_at) {
        deliveryTimes.push(order.delivered_at - order.dispatched_at);
      }
      if (order.required_by && order.delivered_at) {
        const requiredBy = new Date(order.required_by).getTime();
        if (!Number.isNaN(requiredBy) && order.delivered_at > requiredBy) lateDeliveries += 1;
      }
    }
    const medianDeliveryHours = median(deliveryTimes.map((d) => d / (60 * 60 * 1000)));
    const deliveredWithRequiredBy = recentOrders.filter(
      (o) => o.required_by && o.delivered_at,
    ).length;
    const onTimeRate = deliveredWithRequiredBy
      ? ((deliveredWithRequiredBy - lateDeliveries) / deliveredWithRequiredBy) * 100
      : null;

    // Dispute rate: % of delivered orders with any dispute
    const deliveredOrCompleted = recentOrders.filter((o) =>
      ["DELIVERED", "COMPLETED"].includes(o.status),
    );
    const disputed = deliveredOrCompleted.filter((o) => o.dispute_status).length;
    const disputeRate = deliveredOrCompleted.length
      ? (disputed / deliveredOrCompleted.length) * 100
      : null;
    const openDisputes = allOrders.filter((o) => o.dispute_status === "OPEN").length;

    // Order cancellation rate
    const cancelled = recentOrders.filter((o) => o.status === "CANCELLED").length;
    const cancellationRate = recentOrders.length ? (cancelled / recentOrders.length) * 100 : null;

    // Revision rate: quotes with revision events
    const quoteIdsWithRevisions = new Set(allRevisionEvents.map((e) => e.quote_id));
    const revisedQuotes = recentQuotes.filter((q) => quoteIdsWithRevisions.has(q._id)).length;
    const revisionRate = recentQuotes.length ? (revisedQuotes / recentQuotes.length) * 100 : null;

    // Funnel counts
    const funnel = {
      rfqs: recentRfqs.length,
      quoted: rfqsWithCoverage,
      accepted: recentRfqs.filter((r) => acceptedQuotesByRfq.has(r._id)).length,
      orders: recentOrders.length,
      delivered: recentOrders.filter((o) =>
        ["DELIVERED", "COMPLETED"].includes(o.status),
      ).length,
      completed: recentOrders.filter((o) => o.status === "COMPLETED").length,
    };

    // Per-supplier response time leaderboard
    const supplierAggregate = new Map<
      string,
      { times: number[]; assigned: number; quoted: number; wins: number }
    >();
    for (const a of recentAssignments) {
      const key = a.supplier_id;
      const entry = supplierAggregate.get(key) ?? { times: [], assigned: 0, quoted: 0, wins: 0 };
      entry.assigned += 1;
      const firstQuote = allQuotes
        .filter((q) => q.rfq_id === a.rfq_id && q.supplier_id === a.supplier_id)
        .sort((q1, q2) => q1._creationTime - q2._creationTime)[0];
      if (firstQuote) {
        entry.quoted += 1;
        const start = a.assigned_at ?? a._creationTime;
        const delta = firstQuote._creationTime - start;
        if (delta > 0) entry.times.push(delta);
        if (firstQuote.status === "ACCEPTED") entry.wins += 1;
      }
      supplierAggregate.set(key, entry);
    }
    const supplierLeaderboard = await Promise.all(
      Array.from(supplierAggregate.entries())
        .filter(([, v]) => v.assigned > 0)
        .map(async ([id, v]) => {
          const profile = await ctx.db.get(id as any);
          const avgHours = avg(v.times.map((d) => d / (60 * 60 * 1000)));
          return {
            id,
            company_name: (profile as any)?.company_name ?? "—",
            public_id: (profile as any)?.public_id ?? "—",
            is_preferred: !!(profile as any)?.is_preferred,
            assigned: v.assigned,
            quoted: v.quoted,
            wins: v.wins,
            response_rate: v.assigned ? (v.quoted / v.assigned) * 100 : 0,
            win_rate: v.quoted ? (v.wins / v.quoted) * 100 : 0,
            avg_response_hours: avgHours,
          };
        }),
    );
    supplierLeaderboard.sort((a, b) => b.win_rate - a.win_rate || b.response_rate - a.response_rate);

    return {
      windowDays,
      funnel,
      quoteCoverage,
      supplierResponseRate,
      avgSupplierResponseHours,
      medianRfqCycleHours,
      medianAdminTurnaroundHours,
      medianDeliveryHours,
      onTimeRate,
      lateDeliveries,
      deliveredWithRequiredBy,
      disputeRate,
      openDisputes,
      cancellationRate,
      revisionRate,
      supplierLeaderboard: supplierLeaderboard.slice(0, 10),
    };
  },
});

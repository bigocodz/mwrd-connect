import { query } from "./_generated/server";
import { requireAdmin } from "./lib";

export const adminStats = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

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

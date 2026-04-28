import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireAdminRead, requireSupplier } from "./lib";

export const listMine = query({
  handler: async (ctx) => {
    const profile = await requireSupplier(ctx);
    return ctx.db
      .query("supplier_payouts")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .order("desc")
      .collect();
  },
});

export const listAll = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const payouts = await ctx.db.query("supplier_payouts").order("desc").collect();
    return Promise.all(
      payouts.map(async (p) => {
        const supplier = await ctx.db.get(p.supplier_id);
        return {
          ...p,
          supplier_public_id: supplier?.public_id ?? "—",
          supplier_company_name: supplier?.company_name ?? "—",
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    supplier_id: v.id("profiles"),
    amount: v.number(),
    payment_method: v.union(v.literal("BANK_TRANSFER"), v.literal("CHECK")),
    bank_reference: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    return ctx.db.insert("supplier_payouts", {
      ...args,
      status: "PENDING",
      recorded_by: admin._id,
    });
  },
});

export const markPaid = mutation({
  args: { id: v.id("supplier_payouts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: "PAID", paid_at: Date.now() });
  },
});

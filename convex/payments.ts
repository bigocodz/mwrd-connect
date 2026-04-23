import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireClient } from "./lib";

export const listMine = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    return ctx.db
      .query("payments")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("desc")
      .collect();
  },
});

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const payments = await ctx.db.query("payments").order("desc").collect();
    return Promise.all(
      payments.map(async (p) => {
        const client = await ctx.db.get(p.client_id);
        return {
          ...p,
          client_public_id: client?.public_id ?? "—",
          client_company_name: client?.company_name ?? "—",
        };
      }),
    );
  },
});

export const confirm = mutation({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.patch(args.id, {
      status: "PAID",
      confirmed_by: admin._id,
      confirmed_at: Date.now(),
    });
    await ctx.db.insert("payment_audit_logs", {
      payment_id: args.id,
      admin_id: admin._id,
      action: "CONFIRMED",
      details: { confirmed_at: Date.now() },
    });
  },
});

export const flagDiscrepancy = mutation({
  args: { id: v.id("payments"), notes: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: "DISCREPANCY", notes: args.notes });
    await ctx.db.insert("payment_audit_logs", {
      payment_id: args.id,
      admin_id: admin._id,
      action: "FLAGGED_DISCREPANCY",
      details: { notes: args.notes },
    });
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireAdminRead } from "./lib";

// Legacy admin-only log (kept for backward compatibility with older entries)
export const listAll = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const logs = await ctx.db.query("admin_audit_log").order("desc").take(200);
    return Promise.all(
      logs.map(async (log) => {
        const admin = await ctx.db.get(log.admin_id);
        return { ...log, admin_public_id: admin?.public_id ?? "—" };
      }),
    );
  },
});

export const insert = mutation({
  args: {
    action: v.string(),
    target_user_id: v.optional(v.id("profiles")),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.insert("admin_audit_log", {
      admin_id: admin._id,
      action: args.action,
      target_user_id: args.target_user_id,
      details: args.details,
    });
  },
});

/**
 * New canonical audit log (PRD §13.4) — written by logAction() across
 * categories / users / products / orders / quotes / invoices / payments /
 * margins / approvals. Read-only admin viewer.
 */
export const listAudit = query({
  args: {
    target_type: v.optional(v.string()),
    target_id: v.optional(v.string()),
    action_prefix: v.optional(v.string()),
    actor_role: v.optional(
      v.union(
        v.literal("CLIENT"),
        v.literal("SUPPLIER"),
        v.literal("ADMIN"),
        v.literal("SYSTEM"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminRead(ctx);
    const limit = Math.min(args.limit ?? 200, 500);
    let q;
    if (args.target_type) {
      q = ctx.db.query("audit_log").withIndex("by_target", (q) =>
        args.target_id
          ? q.eq("target_type", args.target_type!).eq("target_id", args.target_id)
          : q.eq("target_type", args.target_type!),
      );
    } else {
      q = ctx.db.query("audit_log");
    }
    const rows = await q.order("desc").take(limit * 2); // overshoot for in-memory filters
    const filtered = rows.filter((r) => {
      if (args.action_prefix && !r.action.startsWith(args.action_prefix)) return false;
      if (args.actor_role && r.actor_role !== args.actor_role) return false;
      return true;
    });
    return filtered.slice(0, limit);
  },
});

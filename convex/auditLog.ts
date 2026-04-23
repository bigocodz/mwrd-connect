import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib";

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
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

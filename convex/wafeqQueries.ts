/**
 * Read-only queries for the Wafeq integration.
 *
 * Lives in a non-`"use node"` file because Convex queries must run in the
 * default V8 runtime. The Node-only side (HTTP calls, env access) lives in
 * convex/wafeq.ts.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminRead } from "./lib";

export const recentSyncLog = query({
  args: {
    limit: v.optional(v.number()),
    target_type: v.optional(v.string()),
    target_id: v.optional(v.string()),
    operation: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminRead(ctx);
    const limit = Math.min(args.limit ?? 100, 500);
    let q;
    if (args.target_type && args.target_id) {
      q = ctx.db
        .query("wafeq_sync_log")
        .withIndex("by_target", (q) =>
          q.eq("target_type", args.target_type!).eq("target_id", args.target_id!),
        );
    } else if (args.operation) {
      q = ctx.db
        .query("wafeq_sync_log")
        .withIndex("by_operation", (q) => q.eq("operation", args.operation!));
    } else {
      q = ctx.db.query("wafeq_sync_log");
    }
    const rows = await q.order("desc").take(limit * 2);
    return rows
      .filter((r) => !args.status || r.status === args.status)
      .slice(0, limit);
  },
});

export const summary = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const recent = await ctx.db
      .query("wafeq_sync_log")
      .order("desc")
      .take(200);
    const byStatus: Record<string, number> = {};
    for (const r of recent) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    }
    const lastError = recent.find((r) => r.status !== "SUCCESS");
    const lastReconcile = recent.find((r) => r.operation === "reconcile" && r.status === "SUCCESS");
    const lastWebhook = recent.find((r) => r.operation === "webhook");
    return {
      total: recent.length,
      byStatus,
      lastError: lastError
        ? {
            operation: lastError.operation,
            target_type: lastError.target_type,
            target_id: lastError.target_id,
            error_code: lastError.error_code,
            error_message: lastError.error_message,
            at: lastError._creationTime,
          }
        : null,
      lastReconcileAt: lastReconcile?._creationTime ?? null,
      lastWebhookAt: lastWebhook?._creationTime ?? null,
    };
  },
});

/**
 * V8-runtime helpers for convex/wathq.ts.
 *
 * These live here (V8 runtime) because their parent wathq.ts is `"use node";`
 * and Convex forbids `internalQuery` / `internalMutation` exports in Node
 * modules. The dispatch action runs them via `ctx.runQuery` / `ctx.runMutation`.
 */

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const _getProfile = internalQuery({
  args: { id: v.id("profiles") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const _persistVerification = internalMutation({
  args: {
    profile_id: v.id("profiles"),
    wathq_status: v.union(
      v.literal("VERIFIED"),
      v.literal("MISMATCH"),
      v.literal("UNVERIFIED"),
    ),
    legal_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profile_id, {
      wathq_status: args.wathq_status,
      wathq_verified_at: Date.now(),
      wathq_verified_legal_name: args.legal_name,
    });
  },
});

export const _writeSyncLog = internalMutation({
  args: {
    operation: v.string(),
    environment: v.union(v.literal("production"), v.literal("mock")),
    target_type: v.string(),
    target_id: v.string(),
    cr_number: v.optional(v.string()),
    status: v.union(
      v.literal("VERIFIED"),
      v.literal("MISMATCH"),
      v.literal("NOT_FOUND"),
      v.literal("API_ERROR"),
      v.literal("NETWORK_ERROR"),
      v.literal("CONFIG_ERROR"),
    ),
    http_status: v.optional(v.number()),
    error_code: v.optional(v.string()),
    error_message: v.optional(v.string()),
    response_summary: v.optional(v.any()),
    duration_ms: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("wathq_sync_log", args);
  },
});

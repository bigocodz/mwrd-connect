import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedProfile, requireAdmin } from "./lib";

export const getMyProfile = query({
  handler: async (ctx) => {
    return getAuthenticatedProfile(ctx);
  },
});

// Used internally from actions
export const getMyProfileInternal = internalQuery({
  handler: async (ctx) => {
    return getAuthenticatedProfile(ctx);
  },
});

export const listAll = query({
  args: {
    role: v.optional(v.string()),
    status: v.optional(v.string()),
    kyc_status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let profiles = await ctx.db.query("profiles").order("desc").collect();
    if (args.role && args.role !== "ALL") {
      profiles = profiles.filter((p) => p.role === args.role);
    }
    if (args.status && args.status !== "ALL") {
      profiles = profiles.filter((p) => p.status === args.status);
    }
    if (args.kyc_status && args.kyc_status !== "ALL") {
      profiles = profiles.filter((p) => p.kyc_status === args.kyc_status);
    }
    return profiles;
  },
});

export const getById = query({
  args: { id: v.id("profiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db.get(args.id);
  },
});

export const listClients = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "CLIENT"))
      .order("desc")
      .collect();
  },
});

export const listSuppliers = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "SUPPLIER"))
      .order("asc")
      .collect();
  },
});

export const updateProfile = mutation({
  args: {
    id: v.id("profiles"),
    status: v.optional(v.string()),
    kyc_status: v.optional(v.string()),
    credit_limit: v.optional(v.number()),
    payment_terms: v.optional(v.string()),
    client_margin: v.optional(v.union(v.number(), v.null())),
    frozen_at: v.optional(v.union(v.number(), v.null())),
    freeze_reason: v.optional(v.union(v.string(), v.null())),
    frozen_by: v.optional(v.union(v.id("profiles"), v.null())),
  },
  handler: async (ctx, { id, ...updates }) => {
    await requireAdmin(ctx);
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) patch[k] = v === null ? undefined : v;
    }
    await ctx.db.patch(id, patch);
  },
});

export const freezeAccount = mutation({
  args: {
    id: v.id("profiles"),
    freeze_reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.patch(args.id, {
      status: "FROZEN",
      frozen_at: Date.now(),
      freeze_reason: args.freeze_reason,
      frozen_by: admin._id,
    });
  },
});

export const unfreezeAccount = mutation({
  args: { id: v.id("profiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, {
      status: "ACTIVE",
      frozen_at: undefined,
      freeze_reason: undefined,
      frozen_by: undefined,
    });
  },
});

export const updateCreditLimit = mutation({
  args: {
    id: v.id("profiles"),
    credit_limit: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { credit_limit: args.credit_limit });
  },
});

export const adjustBalance = mutation({
  args: {
    id: v.id("profiles"),
    adjustment: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const profile = await ctx.db.get(args.id);
    if (!profile) throw new Error("Profile not found");
    const newBalance = (profile.current_balance ?? 0) + args.adjustment;
    await ctx.db.patch(args.id, { current_balance: newBalance });
    return { newBalance };
  },
});

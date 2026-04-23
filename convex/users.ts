import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { modifyAccountCredentials } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
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

export const activateAndFlagPasswordChange = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) return;
    await ctx.db.patch(profile._id, {
      status: "ACTIVE",
      must_change_password: true,
    });
  },
});

export const clearMustChangePassword = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) return;
    await ctx.db.patch(profile._id, { must_change_password: undefined });
  },
});

export const changePassword = action({
  args: { newPassword: v.string() },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 8) {
      throw new ConvexError("Password must be at least 8 characters");
    }
    const profile = await ctx.runQuery(internal.users.getMyProfileInternal);
    if (!profile) throw new ConvexError("Not authenticated");

    const user = await ctx.runQuery(internal.users.getUserById, { userId: profile.userId });
    if (!user?.email) throw new ConvexError("No email on account");

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: user.email, secret: args.newPassword },
    });

    await ctx.runMutation(internal.users.clearMustChangePassword, { userId: profile.userId });
  },
});

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => ctx.db.get(args.userId),
});

import { action, internalQuery, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";

export const getProfileByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) return null;
    return ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
  },
});

export const storePendingUserRole = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("CLIENT"), v.literal("SUPPLIER"), v.literal("AUDITOR")),
    company_name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("pending_users", {
      email: args.email,
      role: args.role,
      company_name: args.company_name,
      created_at: Date.now(),
    });
  },
});

export const getPendingUserRole = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("pending_users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

export const deletePendingUser = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pending_users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (pending) {
      await ctx.db.delete(pending._id);
    }
  },
});

export const createUser = action({
  args: {
    email: v.string(),
    password: v.string(),
    role: v.union(v.literal("CLIENT"), v.literal("SUPPLIER"), v.literal("AUDITOR")),
    company_name: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const profile = await ctx.runQuery(internal.users.getMyProfileInternal);
    if (!profile || profile.role !== "ADMIN") throw new ConvexError("Forbidden");

    // Store role info before signup so the callback can retrieve it
    await ctx.runMutation(internal.admin.storePendingUserRole, {
      email: args.email,
      role: args.role,
      company_name: args.company_name,
    });

    await ctx.runAction(api.auth.signIn, {
      provider: "password",
      params: {
        email: args.email,
        password: args.password,
        flow: "signUp",
      },
    });

    // Return the newly created profile's public_id
    const newProfile = await ctx.runQuery(internal.admin.getProfileByEmail, { email: args.email });
    return newProfile?.public_id ?? null;
  },
});

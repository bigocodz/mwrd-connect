import { action, internalQuery } from "./_generated/server";
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

export const createUser = action({
  args: {
    email: v.string(),
    password: v.string(),
    role: v.union(v.literal("CLIENT"), v.literal("SUPPLIER")),
    company_name: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const profile = await ctx.runQuery(internal.users.getMyProfileInternal);
    if (!profile || profile.role !== "ADMIN") throw new ConvexError("Forbidden");

    await ctx.runAction(api.auth.signIn, {
      provider: "password",
      params: {
        email: args.email,
        password: args.password,
        flow: "signUp",
        name: JSON.stringify({ role: args.role, company_name: args.company_name }),
      },
    });

    // Return the newly created profile's public_id
    const newProfile = await ctx.runQuery(internal.admin.getProfileByEmail, { email: args.email });
    return newProfile?.public_id ?? null;
  },
});

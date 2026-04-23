import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { createAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/**
 * Temporary seed: promotes a user (by email) to ADMIN role with ACTIVE status.
 * Run with: npx convex run seed:promoteAdmin '{"email":"your@email.com"}'
 * Delete this file once done.
 */
export const promoteAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) throw new Error(`No user found with email: ${args.email}`);

    let profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!profile) {
      // Create profile if it doesn't exist yet
      const id = await ctx.db.insert("profiles", {
        userId: user._id,
        role: "ADMIN",
        status: "ACTIVE",
        kyc_status: "VERIFIED",
        company_name: "MWRD Admin",
        public_id: "Admin-0001",
        credit_limit: 0,
        current_balance: 0,
      });
      return { created: true, profileId: id };
    }

    await ctx.db.patch(profile._id, {
      role: "ADMIN",
      status: "ACTIVE",
      kyc_status: "VERIFIED",
    });
    return { promoted: true, profileId: profile._id };
  },
});

/**
 * Creates a brand new admin account (user + auth + profile) in one shot.
 * Run with: npx convex run seed:createAdmin '{"email":"x@y.com","password":"YourPass123"}'
 */
export const createAdmin = internalAction({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    // Create the auth account (user row + password hash) via the auth provider
    await createAccount(ctx, {
      provider: "password",
      account: { id: args.email, secret: args.password },
      profile: {
        email: args.email,
        name: JSON.stringify({
          role: "ADMIN",
          company_name: "MWRD Admin",
        }),
      },
    });

    // Now promote the freshly-created user to ADMIN
    await ctx.runMutation(internal.seed.promoteAdmin, { email: args.email });
    return { success: true };
  },
});

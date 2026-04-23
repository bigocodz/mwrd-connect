import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib";

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("interest_submissions").order("desc").collect();
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("interest_submissions"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("REVIEWED"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const submit = mutation({
  args: {
    full_name: v.string(),
    company_name: v.optional(v.string()),
    cr_number: v.optional(v.string()),
    vat_number: v.optional(v.string()),
    email: v.string(),
    phone: v.optional(v.string()),
    account_type: v.optional(v.union(v.literal("CLIENT"), v.literal("SUPPLIER"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("interest_submissions", { ...args, status: "PENDING" });
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib";

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("margin_settings").collect();
  },
});

export const upsertGlobal = mutation({
  args: { margin_percent: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("margin_settings")
      .withIndex("by_type", (q) => q.eq("type", "GLOBAL"))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { margin_percent: args.margin_percent });
    } else {
      await ctx.db.insert("margin_settings", { type: "GLOBAL", margin_percent: args.margin_percent });
    }
  },
});

export const upsertCategory = mutation({
  args: { category: v.string(), margin_percent: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("margin_settings")
      .withIndex("by_type", (q) => q.eq("type", "CATEGORY"))
      .filter((q) => q.eq(q.field("category"), args.category))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { margin_percent: args.margin_percent });
    } else {
      await ctx.db.insert("margin_settings", {
        type: "CATEGORY",
        category: args.category,
        margin_percent: args.margin_percent,
      });
    }
  },
});

export const deleteById = mutation({
  args: { id: v.id("margin_settings") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

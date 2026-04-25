import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireClient } from "./lib";

const enrich = async (ctx: any, entry: any) => {
  const product = await ctx.db.get(entry.product_id);
  return { ...entry, product };
};

export const listMine = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    const entries = await ctx.db
      .query("client_catalog_entries")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("desc")
      .collect();
    const enriched = await Promise.all(entries.map((entry) => enrich(ctx, entry)));
    return enriched.filter((e: any) => e.product && e.product.approval_status === "APPROVED");
  },
});

export const addProduct = mutation({
  args: {
    product_id: v.id("products"),
    alias: v.optional(v.string()),
    notes: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const product = await ctx.db.get(args.product_id);
    if (!product || product.approval_status !== "APPROVED") {
      throw new ConvexError("Product not available");
    }
    const existing = await ctx.db
      .query("client_catalog_entries")
      .withIndex("by_client_product", (q) =>
        q.eq("client_id", profile._id).eq("product_id", args.product_id),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        alias: args.alias?.trim() || undefined,
        notes: args.notes?.trim() || undefined,
        pinned: args.pinned ?? existing.pinned,
        hidden: false,
      });
      return existing._id;
    }
    return ctx.db.insert("client_catalog_entries", {
      client_id: profile._id,
      product_id: args.product_id,
      alias: args.alias?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      pinned: args.pinned ?? false,
      hidden: false,
    });
  },
});

export const updateEntry = mutation({
  args: {
    id: v.id("client_catalog_entries"),
    alias: v.optional(v.string()),
    notes: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
    hidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const entry = await ctx.db.get(args.id);
    if (!entry || entry.client_id !== profile._id) throw new ConvexError("Forbidden");
    const patch: Record<string, unknown> = {};
    if (args.alias !== undefined) patch.alias = args.alias.trim() || undefined;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    if (args.pinned !== undefined) patch.pinned = args.pinned;
    if (args.hidden !== undefined) patch.hidden = args.hidden;
    await ctx.db.patch(args.id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("client_catalog_entries") },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const entry = await ctx.db.get(args.id);
    if (!entry || entry.client_id !== profile._id) throw new ConvexError("Forbidden");
    await ctx.db.delete(args.id);
  },
});

export const myProductIds = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    const entries = await ctx.db
      .query("client_catalog_entries")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .collect();
    return entries.map((e) => ({
      product_id: e.product_id,
      hidden: !!e.hidden,
      pinned: !!e.pinned,
      alias: e.alias,
    }));
  },
});

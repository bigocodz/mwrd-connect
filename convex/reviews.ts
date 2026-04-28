import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminRead, requireClient, requireSupplier } from "./lib";

export const listAll = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const reviews = await ctx.db.query("reviews").order("desc").collect();
    return Promise.all(
      reviews.map(async (r) => {
        const client = await ctx.db.get(r.client_id);
        const supplier = await ctx.db.get(r.supplier_id);
        return {
          ...r,
          client_public_id: client?.public_id ?? "—",
          client_company_name: client?.company_name ?? "—",
          supplier_public_id: supplier?.public_id ?? "—",
          supplier_company_name: supplier?.company_name ?? "—",
        };
      }),
    );
  },
});

export const listForSupplier = query({
  handler: async (ctx) => {
    const profile = await requireSupplier(ctx);
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .order("desc")
      .collect();
    return Promise.all(
      reviews.map(async (r) => {
        const client = await ctx.db.get(r.client_id);
        return { ...r, client_public_id: client?.public_id ?? "—" };
      }),
    );
  },
});

export const create = mutation({
  args: {
    supplier_id: v.id("profiles"),
    order_id: v.optional(v.string()),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    return ctx.db.insert("reviews", {
      client_id: profile._id,
      supplier_id: args.supplier_id,
      order_id: args.order_id,
      rating: args.rating,
      comment: args.comment,
    });
  },
});

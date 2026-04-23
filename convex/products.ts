import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedProfile, requireAdmin, requireSupplier } from "./lib";

export const listMine = query({
  handler: async (ctx) => {
    const profile = await requireSupplier(ctx);
    return ctx.db
      .query("products")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const listApproved = query({
  handler: async (ctx) => {
    await getAuthenticatedProfile(ctx);
    const products = await ctx.db
      .query("products")
      .withIndex("by_approval", (q) => q.eq("approval_status", "APPROVED"))
      .collect();
    // Exclude cost_price for clients
    return products
      .filter((p) => p.availability_status !== "OUT_OF_STOCK")
      .map(({ cost_price: _cost, ...rest }) => rest);
  },
});

export const listApprovedWithSupplier = query({
  handler: async (ctx) => {
    await getAuthenticatedProfile(ctx);
    return ctx.db
      .query("products")
      .withIndex("by_approval", (q) => q.eq("approval_status", "APPROVED"))
      .collect();
  },
});

export const listPending = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const products = await ctx.db
      .query("products")
      .withIndex("by_approval", (q) => q.eq("approval_status", "PENDING"))
      .order("asc")
      .collect();
    const supplierIds = [...new Set(products.map((p) => p.supplier_id))];
    const profiles = await Promise.all(supplierIds.map((id) => ctx.db.get(id)));
    const idMap = new Map(profiles.filter(Boolean).map((p) => [p!._id, p!.public_id]));
    return products.map((p) => ({ ...p, supplier_public_id: idMap.get(p.supplier_id) ?? "Unknown" }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    subcategory: v.optional(v.string()),
    sku: v.optional(v.string()),
    brand: v.optional(v.string()),
    images: v.array(v.string()),
    cost_price: v.number(),
    lead_time_days: v.number(),
    availability_status: v.union(
      v.literal("AVAILABLE"),
      v.literal("LIMITED_STOCK"),
      v.literal("OUT_OF_STOCK"),
    ),
  },
  handler: async (ctx, args) => {
    const profile = await requireSupplier(ctx);
    return ctx.db.insert("products", {
      ...args,
      supplier_id: profile._id,
      approval_status: "PENDING",
      updated_at: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    subcategory: v.optional(v.string()),
    sku: v.optional(v.string()),
    brand: v.optional(v.string()),
    images: v.array(v.string()),
    cost_price: v.number(),
    lead_time_days: v.number(),
    availability_status: v.union(
      v.literal("AVAILABLE"),
      v.literal("LIMITED_STOCK"),
      v.literal("OUT_OF_STOCK"),
    ),
  },
  handler: async (ctx, { id, ...args }) => {
    const profile = await requireSupplier(ctx);
    const product = await ctx.db.get(id);
    if (!product || product.supplier_id !== profile._id) throw new Error("Not found");
    await ctx.db.patch(id, {
      ...args,
      approval_status: "PENDING",
      rejection_reason: undefined,
      updated_at: Date.now(),
    });
  },
});

export const approve = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { approval_status: "APPROVED", rejection_reason: undefined });
  },
});

export const reject = mutation({
  args: { id: v.id("products"), rejection_reason: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { approval_status: "REJECTED", rejection_reason: args.rejection_reason });
  },
});

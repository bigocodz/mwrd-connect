import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthenticatedProfile, requireAdmin, requireAdminRead, requireSupplier } from "./lib";
import { logAction } from "./audit";

const deriveAvailability = (
  current: "AVAILABLE" | "LIMITED_STOCK" | "OUT_OF_STOCK",
  stockQuantity: number | undefined,
  lowStockThreshold: number | undefined,
) => {
  if (stockQuantity === undefined) return current;
  if (stockQuantity <= 0) return "OUT_OF_STOCK" as const;
  if (lowStockThreshold !== undefined && stockQuantity <= lowStockThreshold) return "LIMITED_STOCK" as const;
  return "AVAILABLE" as const;
};

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
    await requireAdminRead(ctx);
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
    category_id: v.optional(v.id("categories")),
    subcategory_id: v.optional(v.id("categories")),
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
    stock_quantity: v.optional(v.number()),
    low_stock_threshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profile = await requireSupplier(ctx);
    const availability = deriveAvailability(
      args.availability_status,
      args.stock_quantity,
      args.low_stock_threshold,
    );
    const id = await ctx.db.insert("products", {
      ...args,
      availability_status: availability,
      supplier_id: profile._id,
      approval_status: "PENDING",
      updated_at: Date.now(),
      stock_updated_at: args.stock_quantity !== undefined ? Date.now() : undefined,
    });
    await logAction(ctx, {
      action: "product.create",
      target_type: "product",
      target_id: id,
      details: { name: args.name, sku: args.sku, category: args.category },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    subcategory: v.optional(v.string()),
    category_id: v.optional(v.id("categories")),
    subcategory_id: v.optional(v.id("categories")),
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
    stock_quantity: v.optional(v.number()),
    low_stock_threshold: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...args }) => {
    const profile = await requireSupplier(ctx);
    const product = await ctx.db.get(id);
    if (!product || product.supplier_id !== profile._id) throw new Error("Not found");
    const availability = deriveAvailability(
      args.availability_status,
      args.stock_quantity,
      args.low_stock_threshold,
    );
    await ctx.db.patch(id, {
      ...args,
      availability_status: availability,
      approval_status: "PENDING",
      rejection_reason: undefined,
      updated_at: Date.now(),
      stock_updated_at:
        args.stock_quantity !== undefined && args.stock_quantity !== product.stock_quantity
          ? Date.now()
          : product.stock_updated_at,
    });
    await logAction(ctx, {
      action: "product.update",
      target_type: "product",
      target_id: id,
      details: { name: args.name, requeued_for_review: true },
    });
  },
});

export const approve = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const before = await ctx.db.get(args.id);
    await ctx.db.patch(args.id, { approval_status: "APPROVED", rejection_reason: undefined });
    await logAction(ctx, {
      action: "product.approve",
      target_type: "product",
      target_id: args.id,
      before: { approval_status: before?.approval_status },
      after: { approval_status: "APPROVED" },
      details: { name: before?.name, supplier_id: before?.supplier_id },
    });
  },
});

export const reject = mutation({
  args: { id: v.id("products"), rejection_reason: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const before = await ctx.db.get(args.id);
    await ctx.db.patch(args.id, { approval_status: "REJECTED", rejection_reason: args.rejection_reason });
    await logAction(ctx, {
      action: "product.reject",
      target_type: "product",
      target_id: args.id,
      before: { approval_status: before?.approval_status },
      after: { approval_status: "REJECTED" },
      details: { name: before?.name, reason: args.rejection_reason },
    });
  },
});

export const updateStock = mutation({
  args: {
    id: v.id("products"),
    stock_quantity: v.number(),
    low_stock_threshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profile = await requireSupplier(ctx);
    const product = await ctx.db.get(args.id);
    if (!product || product.supplier_id !== profile._id) throw new ConvexError("Not found");
    if (args.stock_quantity < 0) throw new ConvexError("Stock cannot be negative");
    const threshold = args.low_stock_threshold ?? product.low_stock_threshold;
    const availability = deriveAvailability(product.availability_status, args.stock_quantity, threshold);
    await ctx.db.patch(args.id, {
      stock_quantity: args.stock_quantity,
      low_stock_threshold: threshold,
      availability_status: availability,
      stock_updated_at: Date.now(),
    });
    await logAction(ctx, {
      action: "product.stock.update",
      target_type: "product",
      target_id: args.id,
      before: {
        stock_quantity: product.stock_quantity,
        low_stock_threshold: product.low_stock_threshold,
        availability_status: product.availability_status,
      },
      after: {
        stock_quantity: args.stock_quantity,
        low_stock_threshold: threshold,
        availability_status: availability,
      },
      details: { sku: product.sku },
    });
  },
});

export const stockAlerts = query({
  handler: async (ctx) => {
    const profile = await requireSupplier(ctx);
    const products = await ctx.db
      .query("products")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .collect();
    const alerts = products.filter(
      (p) => p.stock_quantity !== undefined && p.availability_status !== "AVAILABLE",
    );
    return alerts
      .map((p) => ({
        _id: p._id,
        name: p.name,
        sku: p.sku,
        stock_quantity: p.stock_quantity ?? 0,
        low_stock_threshold: p.low_stock_threshold,
        availability_status: p.availability_status,
        approval_status: p.approval_status,
        stock_updated_at: p.stock_updated_at,
      }))
      .sort((a, b) => (a.stock_quantity ?? 0) - (b.stock_quantity ?? 0));
  },
});

export const bulkCreate = mutation({
  args: {
    rows: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        category: v.string(),
        subcategory: v.optional(v.string()),
        sku: v.optional(v.string()),
        brand: v.optional(v.string()),
        cost_price: v.number(),
        lead_time_days: v.number(),
        availability_status: v.union(
          v.literal("AVAILABLE"),
          v.literal("LIMITED_STOCK"),
          v.literal("OUT_OF_STOCK"),
        ),
        stock_quantity: v.optional(v.number()),
        low_stock_threshold: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const profile = await requireSupplier(ctx);
    const ids: string[] = [];
    for (const row of args.rows) {
      const availability = deriveAvailability(
        row.availability_status,
        row.stock_quantity,
        row.low_stock_threshold,
      );
      const id = await ctx.db.insert("products", {
        name: row.name,
        description: row.description,
        category: row.category,
        subcategory: row.subcategory,
        sku: row.sku,
        brand: row.brand,
        images: [],
        cost_price: row.cost_price,
        lead_time_days: row.lead_time_days,
        availability_status: availability,
        stock_quantity: row.stock_quantity,
        low_stock_threshold: row.low_stock_threshold,
        stock_updated_at: row.stock_quantity !== undefined ? Date.now() : undefined,
        supplier_id: profile._id,
        approval_status: "PENDING",
        updated_at: Date.now(),
      });
      ids.push(id);
    }
    await logAction(ctx, {
      action: "product.bulk_create",
      target_type: "product",
      details: { count: ids.length, ids },
    });
    return { count: ids.length };
  },
});

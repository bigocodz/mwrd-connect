import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
  getAuthenticatedProfile,
  requireAdmin,
  requireAdminRead,
} from "./lib";
import { logAction } from "./audit";

const packTypeArg = v.array(
  v.object({
    code: v.string(),
    label_en: v.string(),
    label_ar: v.string(),
    base_qty: v.number(),
    uom: v.optional(v.string()),
  }),
);

const validatePackTypes = (
  packTypes: { code: string; base_qty: number }[],
) => {
  if (packTypes.length === 0) {
    throw new ConvexError("At least one pack type is required");
  }
  const seen = new Set<string>();
  for (const p of packTypes) {
    if (!p.code.trim()) throw new ConvexError("Pack type code cannot be empty");
    if (seen.has(p.code)) {
      throw new ConvexError(`Duplicate pack type code: ${p.code}`);
    }
    if (p.base_qty <= 0) {
      throw new ConvexError(`Pack type ${p.code} must have base_qty > 0`);
    }
    seen.add(p.code);
  }
};

export const create = mutation({
  args: {
    name_en: v.string(),
    name_ar: v.string(),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    category_id: v.id("categories"),
    sku: v.optional(v.string()),
    brand: v.optional(v.string()),
    images: v.array(v.string()),
    specs: v.optional(v.any()),
    pack_types: packTypeArg,
    status: v.optional(
      v.union(v.literal("DRAFT"), v.literal("ACTIVE"), v.literal("DEPRECATED")),
    ),
    display_order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    validatePackTypes(args.pack_types);
    const id = await ctx.db.insert("master_products", {
      name_en: args.name_en,
      name_ar: args.name_ar,
      description_en: args.description_en,
      description_ar: args.description_ar,
      category_id: args.category_id,
      sku: args.sku,
      brand: args.brand,
      images: args.images,
      specs: args.specs,
      pack_types: args.pack_types,
      status: args.status ?? "DRAFT",
      display_order: args.display_order,
      created_by: admin._id,
      updated_at: Date.now(),
    });
    await logAction(ctx, {
      action: "master_product.create",
      target_type: "master_product",
      target_id: id,
      details: { name_en: args.name_en, sku: args.sku },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("master_products"),
    name_en: v.string(),
    name_ar: v.string(),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    category_id: v.id("categories"),
    sku: v.optional(v.string()),
    brand: v.optional(v.string()),
    images: v.array(v.string()),
    specs: v.optional(v.any()),
    pack_types: packTypeArg,
    status: v.union(
      v.literal("DRAFT"),
      v.literal("ACTIVE"),
      v.literal("DEPRECATED"),
    ),
    display_order: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...args }) => {
    await requireAdmin(ctx);
    const before = await ctx.db.get(id);
    if (!before) throw new ConvexError("Not found");
    validatePackTypes(args.pack_types);
    // If pack types change, suppliers may have offers pointing at codes that
    // were removed. Block silent breakage by rejecting the edit when an
    // existing offer references a code that's about to disappear.
    const removedCodes = before.pack_types
      .map((p) => p.code)
      .filter((code) => !args.pack_types.some((p) => p.code === code));
    if (removedCodes.length > 0) {
      const offers = await ctx.db
        .query("products")
        .withIndex("by_master_product", (q) => q.eq("master_product_id", id))
        .collect();
      const blocking = offers.filter(
        (o) => o.pack_type_code && removedCodes.includes(o.pack_type_code),
      );
      if (blocking.length > 0) {
        throw new ConvexError(
          `Cannot remove pack types ${removedCodes.join(", ")} — ${blocking.length} supplier offer(s) depend on them`,
        );
      }
    }
    await ctx.db.patch(id, { ...args, updated_at: Date.now() });
    await logAction(ctx, {
      action: "master_product.update",
      target_type: "master_product",
      target_id: id,
      before: { status: before.status, pack_types: before.pack_types.length },
      after: { status: args.status, pack_types: args.pack_types.length },
    });
  },
});

export const deprecate = mutation({
  args: {
    id: v.id("master_products"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const before = await ctx.db.get(args.id);
    if (!before) throw new ConvexError("Not found");
    await ctx.db.patch(args.id, {
      status: "DEPRECATED",
      deprecated_at: Date.now(),
      deprecation_reason: args.reason,
      updated_at: Date.now(),
    });
    await logAction(ctx, {
      action: "master_product.deprecate",
      target_type: "master_product",
      target_id: args.id,
      before: { status: before.status },
      after: { status: "DEPRECATED" },
      details: { reason: args.reason },
    });
  },
});

export const reactivate = mutation({
  args: { id: v.id("master_products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const before = await ctx.db.get(args.id);
    if (!before) throw new ConvexError("Not found");
    await ctx.db.patch(args.id, {
      status: "ACTIVE",
      deprecated_at: undefined,
      deprecation_reason: undefined,
      updated_at: Date.now(),
    });
    await logAction(ctx, {
      action: "master_product.reactivate",
      target_type: "master_product",
      target_id: args.id,
      before: { status: before.status },
      after: { status: "ACTIVE" },
    });
  },
});

export const getById = query({
  args: { id: v.id("master_products") },
  handler: async (ctx, args) => {
    await getAuthenticatedProfile(ctx);
    return ctx.db.get(args.id);
  },
});

// Admin-facing list — includes DRAFT and DEPRECATED for the catalog manager.
export const listAll = query({
  args: {
    category_id: v.optional(v.id("categories")),
    status: v.optional(
      v.union(
        v.literal("DRAFT"),
        v.literal("ACTIVE"),
        v.literal("DEPRECATED"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdminRead(ctx);
    const all = args.status
      ? await ctx.db
          .query("master_products")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("master_products").collect();
    return args.category_id
      ? all.filter((m) => m.category_id === args.category_id)
      : all;
  },
});

// Public list — only ACTIVE rows. Used by clients (browse catalog) and
// suppliers (browse with "Sell this" CTA).
export const listActive = query({
  args: { category_id: v.optional(v.id("categories")) },
  handler: async (ctx, args) => {
    await getAuthenticatedProfile(ctx);
    const rows = await ctx.db
      .query("master_products")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .collect();
    return args.category_id
      ? rows.filter((m) => m.category_id === args.category_id)
      : rows;
  },
});

// Supplier browse view: master products + a flag indicating whether THIS
// supplier already sells it (so the UI can swap "Sell this" for "Manage offer").
export const listForSupplierBrowse = query({
  args: { category_id: v.optional(v.id("categories")) },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile || profile.role !== "SUPPLIER") {
      throw new ConvexError("Forbidden");
    }
    const masters = await ctx.db
      .query("master_products")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .collect();
    const filtered = args.category_id
      ? masters.filter((m) => m.category_id === args.category_id)
      : masters;
    // Pull this supplier's existing offers in one shot, then map.
    const myOffers = await ctx.db
      .query("products")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .collect();
    const myOffersByMaster = new Map<string, typeof myOffers>();
    for (const o of myOffers) {
      if (!o.master_product_id) continue;
      const arr = myOffersByMaster.get(o.master_product_id) ?? [];
      arr.push(o);
      myOffersByMaster.set(o.master_product_id, arr);
    }
    return filtered.map((m) => ({
      ...m,
      my_offer_count: myOffersByMaster.get(m._id)?.length ?? 0,
    }));
  },
});

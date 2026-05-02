import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  getAuthenticatedProfile,
  requireAdmin,
  requireAdminRead,
  requireClient,
} from "./lib";
import { logAction } from "./audit";

const itemArg = v.object({
  master_product_id: v.id("master_products"),
  pack_type_code: v.string(),
  quantity: v.number(),
  notes: v.optional(v.string()),
});

const validateItems = (
  items: { master_product_id: Id<"master_products">; quantity: number; pack_type_code: string }[],
) => {
  if (items.length === 0) {
    throw new ConvexError("A bundle needs at least one item");
  }
  for (const i of items) {
    if (!(i.quantity > 0)) {
      throw new ConvexError("Bundle item quantity must be > 0");
    }
    if (!i.pack_type_code.trim()) {
      throw new ConvexError("Bundle item pack_type_code required");
    }
  }
};

export const create = mutation({
  args: {
    name_en: v.string(),
    name_ar: v.string(),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    category_id: v.optional(v.id("categories")),
    image_url: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("DRAFT"),
        v.literal("ACTIVE"),
        v.literal("ARCHIVED"),
      ),
    ),
    display_order: v.optional(v.number()),
    items: v.array(itemArg),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    validateItems(args.items);
    // Verify each master + pack pair exists.
    for (const item of args.items) {
      const master = await ctx.db.get(item.master_product_id);
      if (!master) throw new ConvexError("Master product not found");
      if (!master.pack_types.some((p) => p.code === item.pack_type_code)) {
        throw new ConvexError(
          `Pack type ${item.pack_type_code} not on master ${master.name_en}`,
        );
      }
    }
    const id = await ctx.db.insert("bundles", {
      name_en: args.name_en,
      name_ar: args.name_ar,
      description_en: args.description_en,
      description_ar: args.description_ar,
      category_id: args.category_id,
      image_url: args.image_url,
      status: args.status ?? "DRAFT",
      display_order: args.display_order,
      created_by: admin._id,
      updated_at: Date.now(),
    });
    await Promise.all(
      args.items.map((item, idx) =>
        ctx.db.insert("bundle_items", {
          bundle_id: id,
          master_product_id: item.master_product_id,
          pack_type_code: item.pack_type_code,
          quantity: item.quantity,
          notes: item.notes,
          display_order: idx,
        }),
      ),
    );
    await logAction(ctx, {
      action: "bundle.create",
      target_type: "bundle",
      target_id: id,
      details: { name_en: args.name_en, item_count: args.items.length },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("bundles"),
    name_en: v.string(),
    name_ar: v.string(),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    category_id: v.optional(v.id("categories")),
    image_url: v.optional(v.string()),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("ACTIVE"),
      v.literal("ARCHIVED"),
    ),
    display_order: v.optional(v.number()),
    items: v.array(itemArg),
  },
  handler: async (ctx, { id, items, ...rest }) => {
    await requireAdmin(ctx);
    const before = await ctx.db.get(id);
    if (!before) throw new ConvexError("Not found");
    validateItems(items);
    for (const item of items) {
      const master = await ctx.db.get(item.master_product_id);
      if (!master) throw new ConvexError("Master product not found");
      if (!master.pack_types.some((p) => p.code === item.pack_type_code)) {
        throw new ConvexError(
          `Pack type ${item.pack_type_code} not on master ${master.name_en}`,
        );
      }
    }
    await ctx.db.patch(id, { ...rest, updated_at: Date.now() });
    // Replace bundle_items wholesale — simpler than diffing.
    const existing = await ctx.db
      .query("bundle_items")
      .withIndex("by_bundle", (q) => q.eq("bundle_id", id))
      .collect();
    for (const e of existing) await ctx.db.delete(e._id);
    await Promise.all(
      items.map((item, idx) =>
        ctx.db.insert("bundle_items", {
          bundle_id: id,
          master_product_id: item.master_product_id,
          pack_type_code: item.pack_type_code,
          quantity: item.quantity,
          notes: item.notes,
          display_order: idx,
        }),
      ),
    );
    await logAction(ctx, {
      action: "bundle.update",
      target_type: "bundle",
      target_id: id,
      details: { item_count: items.length, status: rest.status },
    });
  },
});

export const archive = mutation({
  args: { id: v.id("bundles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const before = await ctx.db.get(args.id);
    if (!before) throw new ConvexError("Not found");
    await ctx.db.patch(args.id, { status: "ARCHIVED", updated_at: Date.now() });
    await logAction(ctx, {
      action: "bundle.archive",
      target_type: "bundle",
      target_id: args.id,
      before: { status: before.status },
      after: { status: "ARCHIVED" },
    });
  },
});

const hydrateBundle = async (
  ctx: { db: any },
  bundle: any,
) => {
  const items = await ctx.db
    .query("bundle_items")
    .withIndex("by_bundle", (q: any) => q.eq("bundle_id", bundle._id))
    .collect();
  const itemsWithMaster = await Promise.all(
    items.map(async (item: any) => {
      const master = await ctx.db.get(item.master_product_id);
      return { ...item, master };
    }),
  );
  itemsWithMaster.sort(
    (a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  return { ...bundle, items: itemsWithMaster };
};

export const listActive = query({
  args: { category_id: v.optional(v.id("categories")) },
  handler: async (ctx, args) => {
    await getAuthenticatedProfile(ctx);
    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .collect();
    const filtered = args.category_id
      ? bundles.filter((b) => b.category_id === args.category_id)
      : bundles;
    return Promise.all(filtered.map((b) => hydrateBundle(ctx, b)));
  },
});

export const listAll = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("DRAFT"),
        v.literal("ACTIVE"),
        v.literal("ARCHIVED"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdminRead(ctx);
    const bundles = args.status
      ? await ctx.db
          .query("bundles")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("bundles").collect();
    return Promise.all(bundles.map((b) => hydrateBundle(ctx, b)));
  },
});

export const getById = query({
  args: { id: v.id("bundles") },
  handler: async (ctx, args) => {
    await getAuthenticatedProfile(ctx);
    const bundle = await ctx.db.get(args.id);
    if (!bundle) return null;
    return hydrateBundle(ctx, bundle);
  },
});

/**
 * Helper for the client RFQ builder: returns the lines a bundle would expand
 * into. Caller decides whether to merge with existing draft items or replace.
 */
export const expandToRfqLines = query({
  args: { id: v.id("bundles") },
  handler: async (ctx, args) => {
    await requireClient(ctx);
    const bundle = await ctx.db.get(args.id);
    if (!bundle || bundle.status !== "ACTIVE") return [];
    const items = await ctx.db
      .query("bundle_items")
      .withIndex("by_bundle", (q) => q.eq("bundle_id", args.id))
      .collect();
    items.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    return items.map((i) => ({
      master_product_id: i.master_product_id,
      pack_type_code: i.pack_type_code,
      quantity: i.quantity,
      notes: i.notes,
    }));
  },
});

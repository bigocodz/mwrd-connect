import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getClientOrgId, requireClient } from "./lib";

const enrich = async (ctx: any, entry: any) => {
  const product = await ctx.db.get(entry.product_id);
  return { ...entry, product };
};

export const listMine = query({
  handler: async (ctx) => {
    const orgId = await getClientOrgId(ctx);
    const entries = await ctx.db
      .query("client_catalog_entries")
      .withIndex("by_client", (q) => q.eq("client_id", orgId))
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
    const orgId = await getClientOrgId(ctx);
    const product = await ctx.db.get(args.product_id);
    if (!product || product.approval_status !== "APPROVED") {
      throw new ConvexError("Product not available");
    }
    const existing = await ctx.db
      .query("client_catalog_entries")
      .withIndex("by_client_product", (q) =>
        q.eq("client_id", orgId).eq("product_id", args.product_id),
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
      client_id: orgId,
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
    const orgId = await getClientOrgId(ctx);
    const entry = await ctx.db.get(args.id);
    if (!entry || entry.client_id !== orgId) throw new ConvexError("Forbidden");
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
    const orgId = await getClientOrgId(ctx);
    const entry = await ctx.db.get(args.id);
    if (!entry || entry.client_id !== orgId) throw new ConvexError("Forbidden");
    await ctx.db.delete(args.id);
  },
});

export const myProductIds = query({
  handler: async (ctx) => {
    const orgId = await getClientOrgId(ctx);
    const entries = await ctx.db
      .query("client_catalog_entries")
      .withIndex("by_client", (q) => q.eq("client_id", orgId))
      .collect();
    return entries.map((e) => ({
      product_id: e.product_id,
      hidden: !!e.hidden,
      pinned: !!e.pinned,
      alias: e.alias,
      cart_quantity: e.cart_quantity ?? 0,
    }));
  },
});

// ==================== Cart ====================

export const listMyCart = query({
  handler: async (ctx) => {
    const orgId = await getClientOrgId(ctx);
    const entries = await ctx.db
      .query("client_catalog_entries")
      .withIndex("by_client", (q) => q.eq("client_id", orgId))
      .collect();
    const inCart = entries.filter((e) => (e.cart_quantity ?? 0) > 0);
    const enriched = await Promise.all(
      inCart.map(async (entry) => {
        const product = await ctx.db.get(entry.product_id);
        return { ...entry, product };
      }),
    );
    return enriched.filter(
      (e: any) => e.product && e.product.approval_status === "APPROVED",
    );
  },
});

// Saved Cart 7-day TTL — every cart-touch stamps a fresh expiry.
const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const cartExpiry = () => Date.now() + CART_TTL_MS;

export const addToCart = mutation({
  args: {
    product_id: v.id("products"),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const orgId = await getClientOrgId(ctx);
    const product = await ctx.db.get(args.product_id);
    if (!product || product.approval_status !== "APPROVED") {
      throw new ConvexError("Product not available");
    }
    const qty = Math.max(1, Math.floor(args.quantity ?? 1));
    const existing = await ctx.db
      .query("client_catalog_entries")
      .withIndex("by_client_product", (q) =>
        q.eq("client_id", orgId).eq("product_id", args.product_id),
      )
      .unique();
    if (existing) {
      const next = (existing.cart_quantity ?? 0) + qty;
      await ctx.db.patch(existing._id, {
        cart_quantity: next,
        hidden: false,
        cart_expires_at: cartExpiry(),
      });
      return existing._id;
    }
    return ctx.db.insert("client_catalog_entries", {
      client_id: orgId,
      product_id: args.product_id,
      pinned: false,
      hidden: false,
      cart_quantity: qty,
      cart_expires_at: cartExpiry(),
    });
  },
});

export const setCartQuantity = mutation({
  args: {
    product_id: v.id("products"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const orgId = await getClientOrgId(ctx);
    const qty = Math.max(0, Math.floor(args.quantity));
    const existing = await ctx.db
      .query("client_catalog_entries")
      .withIndex("by_client_product", (q) =>
        q.eq("client_id", orgId).eq("product_id", args.product_id),
      )
      .unique();
    if (!existing) {
      if (qty === 0) return null;
      const product = await ctx.db.get(args.product_id);
      if (!product || product.approval_status !== "APPROVED") {
        throw new ConvexError("Product not available");
      }
      return ctx.db.insert("client_catalog_entries", {
        client_id: orgId,
        product_id: args.product_id,
        pinned: false,
        hidden: false,
        cart_quantity: qty,
        cart_expires_at: qty > 0 ? cartExpiry() : undefined,
      });
    }
    await ctx.db.patch(existing._id, {
      cart_quantity: qty,
      cart_expires_at: qty > 0 ? cartExpiry() : undefined,
    });
    return existing._id;
  },
});

export const removeFromCart = mutation({
  args: { product_id: v.id("products") },
  handler: async (ctx, args) => {
    const orgId = await getClientOrgId(ctx);
    const existing = await ctx.db
      .query("client_catalog_entries")
      .withIndex("by_client_product", (q) =>
        q.eq("client_id", orgId).eq("product_id", args.product_id),
      )
      .unique();
    if (!existing) return;
    await ctx.db.patch(existing._id, { cart_quantity: 0, cart_expires_at: undefined });
  },
});

export const clearCart = mutation({
  handler: async (ctx) => {
    const orgId = await getClientOrgId(ctx);
    const entries = await ctx.db
      .query("client_catalog_entries")
      .withIndex("by_client", (q) => q.eq("client_id", orgId))
      .collect();
    for (const entry of entries) {
      if ((entry.cart_quantity ?? 0) > 0) {
        await ctx.db.patch(entry._id, { cart_quantity: 0, cart_expires_at: undefined });
      }
    }
  },
});

/**
 * Cron-driven cart expiry sweeper. Zeroes cart_quantity on entries whose
 * cart_expires_at has passed. The catalog row itself stays — favorites,
 * aliases, and notes are preserved.
 */
export const sweepExpiredCarts = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    // Pull every entry that has a cart_expires_at set; the index is sparse.
    const candidates = await ctx.db
      .query("client_catalog_entries")
      .withIndex("by_cart_expires")
      .collect();
    let cleared = 0;
    for (const entry of candidates) {
      if (!entry.cart_expires_at) continue;
      if (entry.cart_expires_at > now) continue;
      if ((entry.cart_quantity ?? 0) === 0) {
        // Already empty — just clear the expiry so it stops appearing.
        await ctx.db.patch(entry._id, { cart_expires_at: undefined });
        continue;
      }
      await ctx.db.patch(entry._id, {
        cart_quantity: 0,
        cart_expires_at: undefined,
      });
      cleared++;
    }
    return { cleared };
  },
});

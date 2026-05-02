import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
  getAuthenticatedProfile,
  requireAdmin,
  requireAdminRead,
  requireSupplier,
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

export const submit = mutation({
  args: {
    proposed_name_en: v.string(),
    proposed_name_ar: v.string(),
    proposed_description_en: v.optional(v.string()),
    proposed_description_ar: v.optional(v.string()),
    category_id: v.id("categories"),
    proposed_sku: v.optional(v.string()),
    proposed_brand: v.optional(v.string()),
    images: v.array(v.string()),
    specs: v.optional(v.any()),
    proposed_pack_types: packTypeArg,
    justification: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const supplier = await requireSupplier(ctx);
    if (args.proposed_pack_types.length === 0) {
      throw new ConvexError("At least one pack type is required");
    }
    const id = await ctx.db.insert("product_addition_requests", {
      supplier_id: supplier._id,
      ...args,
      status: "PENDING",
    });
    await logAction(ctx, {
      action: "product_addition_request.submit",
      target_type: "product_addition_request",
      target_id: id,
      details: {
        name_en: args.proposed_name_en,
        category_id: args.category_id,
      },
    });
    return id;
  },
});

export const listMine = query({
  handler: async (ctx) => {
    const supplier = await requireSupplier(ctx);
    return ctx.db
      .query("product_addition_requests")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", supplier._id))
      .order("desc")
      .collect();
  },
});

export const listPending = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const rows = await ctx.db
      .query("product_addition_requests")
      .withIndex("by_status", (q) => q.eq("status", "PENDING"))
      .order("asc")
      .collect();
    const supplierIds = [...new Set(rows.map((r) => r.supplier_id))];
    const profiles = await Promise.all(supplierIds.map((id) => ctx.db.get(id)));
    const idMap = new Map(
      profiles.filter(Boolean).map((p) => [p!._id, p!.public_id ?? "Unknown"]),
    );
    return rows.map((r) => ({
      ...r,
      supplier_public_id: idMap.get(r.supplier_id) ?? "Unknown",
    }));
  },
});

export const getById = query({
  args: { id: v.id("product_addition_requests") },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    // Suppliers can read their own; admin/auditor can read all.
    if (
      profile.role !== "ADMIN" &&
      profile.role !== "AUDITOR" &&
      row.supplier_id !== profile._id
    ) {
      throw new ConvexError("Forbidden");
    }
    return row;
  },
});

export const approve = mutation({
  args: {
    id: v.id("product_addition_requests"),
    // Admin can adjust the master product fields before creation
    name_en: v.optional(v.string()),
    name_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    category_id: v.optional(v.id("categories")),
    sku: v.optional(v.string()),
    brand: v.optional(v.string()),
    pack_types: v.optional(packTypeArg),
    publish: v.optional(v.boolean()), // true → ACTIVE, false → DRAFT
    admin_notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const req = await ctx.db.get(args.id);
    if (!req) throw new ConvexError("Not found");
    if (req.status !== "PENDING") {
      throw new ConvexError(`Request is already ${req.status}`);
    }
    const masterId = await ctx.db.insert("master_products", {
      name_en: args.name_en ?? req.proposed_name_en,
      name_ar: args.name_ar ?? req.proposed_name_ar,
      description_en: args.description_en ?? req.proposed_description_en,
      description_ar: args.description_ar ?? req.proposed_description_ar,
      category_id: args.category_id ?? req.category_id,
      sku: args.sku ?? req.proposed_sku,
      brand: args.brand ?? req.proposed_brand,
      images: req.images,
      specs: req.specs,
      pack_types: args.pack_types ?? req.proposed_pack_types,
      status: args.publish ? "ACTIVE" : "DRAFT",
      created_by: admin._id,
      updated_at: Date.now(),
    });
    await ctx.db.patch(args.id, {
      status: "APPROVED",
      decided_by: admin._id,
      decided_at: Date.now(),
      admin_notes: args.admin_notes,
      created_master_product_id: masterId,
    });
    await logAction(ctx, {
      action: "product_addition_request.approve",
      target_type: "product_addition_request",
      target_id: args.id,
      after: { master_product_id: masterId, publish: args.publish ?? false },
      details: { supplier_id: req.supplier_id },
    });
    return masterId;
  },
});

export const reject = mutation({
  args: {
    id: v.id("product_addition_requests"),
    rejection_reason: v.string(),
    admin_notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const req = await ctx.db.get(args.id);
    if (!req) throw new ConvexError("Not found");
    if (req.status !== "PENDING") {
      throw new ConvexError(`Request is already ${req.status}`);
    }
    await ctx.db.patch(args.id, {
      status: "REJECTED",
      decided_by: admin._id,
      decided_at: Date.now(),
      rejection_reason: args.rejection_reason,
      admin_notes: args.admin_notes,
    });
    await logAction(ctx, {
      action: "product_addition_request.reject",
      target_type: "product_addition_request",
      target_id: args.id,
      details: {
        reason: args.rejection_reason,
        supplier_id: req.supplier_id,
      },
    });
  },
});

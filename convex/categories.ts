import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  getAuthenticatedProfile,
  requireAdmin,
  requireSupplier,
} from "./lib";
import { logAction, diffShallow } from "./audit";

const MAX_LEVEL = 3; // 0=Category, 1=Subcategory, 2=Family, 3=Item-class

const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "category";

async function ensureUniqueSlug(
  ctx: { db: any },
  base: string,
  ignoreId?: Id<"categories">,
) {
  let slug = base;
  let i = 2;
  // small loop; collisions are rare
  while (true) {
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .unique();
    if (!existing || existing._id === ignoreId) return slug;
    slug = `${base}-${i++}`;
  }
}

async function resolveLevel(
  ctx: { db: any },
  parent_id: Id<"categories"> | undefined,
): Promise<number> {
  if (!parent_id) return 0;
  const parent = await ctx.db.get(parent_id);
  if (!parent) throw new ConvexError("Parent category not found");
  if (parent.status !== "ACTIVE")
    throw new ConvexError("Parent category is not active");
  const next = (parent.level ?? 0) + 1;
  if (next > MAX_LEVEL)
    throw new ConvexError(
      `Cannot nest deeper than ${MAX_LEVEL + 1} levels`,
    );
  return next;
}

// ==================== Queries ====================

export const listAll = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("ACTIVE"),
        v.literal("PROPOSED"),
        v.literal("REJECTED"),
        v.literal("ARCHIVED"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    const q = args.status
      ? ctx.db.query("categories").withIndex("by_status", (q) => q.eq("status", args.status!))
      : ctx.db.query("categories");
    const rows = await q.collect();
    return rows.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      const ao = a.display_order ?? 0;
      const bo = b.display_order ?? 0;
      if (ao !== bo) return ao - bo;
      return a.name_en.localeCompare(b.name_en);
    });
  },
});

// Tree of ACTIVE categories with children pre-bundled.
export const tree = query({
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    const all = await ctx.db
      .query("categories")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .collect();
    type Node = (typeof all)[number] & { children: Node[] };
    const byId = new Map<string, Node>();
    all.forEach((c) => byId.set(c._id, { ...c, children: [] as Node[] }));
    const roots: Node[] = [];
    for (const c of byId.values()) {
      if (c.parent_id && byId.has(c.parent_id)) {
        byId.get(c.parent_id)!.children.push(c);
      } else {
        roots.push(c);
      }
    }
    const sortNodes = (nodes: Node[]) => {
      nodes.sort((a, b) => {
        const ao = a.display_order ?? 0;
        const bo = b.display_order ?? 0;
        if (ao !== bo) return ao - bo;
        return a.name_en.localeCompare(b.name_en);
      });
      nodes.forEach((n) => sortNodes(n.children));
    };
    sortNodes(roots);
    return roots;
  },
});

export const listProposals = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const proposals = await ctx.db
      .query("categories")
      .withIndex("by_status", (q) => q.eq("status", "PROPOSED"))
      .collect();
    const supplierIds = [
      ...new Set(proposals.map((p) => p.proposed_by).filter(Boolean) as Id<"profiles">[]),
    ];
    const suppliers = await Promise.all(supplierIds.map((id) => ctx.db.get(id)));
    const map = new Map(
      suppliers.filter(Boolean).map((s) => [s!._id, s!]),
    );
    return proposals
      .map((p) => ({
        ...p,
        proposer_public_id: p.proposed_by ? map.get(p.proposed_by)?.public_id : undefined,
        proposer_company_name: p.proposed_by ? map.get(p.proposed_by)?.company_name : undefined,
      }))
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getById = query({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    await getAuthenticatedProfile(ctx);
    return ctx.db.get(args.id);
  },
});

// Suppliers see their own proposals across all statuses to track approval.
export const myProposals = query({
  handler: async (ctx) => {
    const supplier = await requireSupplier(ctx);
    const rows = await ctx.db.query("categories").collect();
    const mine = rows.filter((r) => r.proposed_by === supplier._id);
    // Most recent first; resolve parent name for display.
    const byId = new Map(rows.map((r) => [r._id, r]));
    return mine
      .map((r) => {
        const parent = r.parent_id ? byId.get(r.parent_id) : undefined;
        return {
          ...r,
          parent_name_en: parent?.name_en,
          parent_name_ar: parent?.name_ar,
        };
      })
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

// ==================== Mutations ====================

export const create = mutation({
  args: {
    parent_id: v.optional(v.id("categories")),
    name_ar: v.string(),
    name_en: v.string(),
    description_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    default_uom: v.optional(v.string()),
    tax_class: v.optional(
      v.union(
        v.literal("STANDARD"),
        v.literal("ZERO_RATED"),
        v.literal("EXEMPT"),
      ),
    ),
    attribute_schema: v.optional(v.string()),
    display_order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!args.name_ar.trim() || !args.name_en.trim())
      throw new ConvexError("Both Arabic and English names are required");
    const level = await resolveLevel(ctx, args.parent_id);
    const slug = await ensureUniqueSlug(ctx, slugify(args.name_en));
    const id = await ctx.db.insert("categories", {
      parent_id: args.parent_id,
      level,
      slug,
      name_ar: args.name_ar.trim(),
      name_en: args.name_en.trim(),
      description_ar: args.description_ar?.trim() || undefined,
      description_en: args.description_en?.trim() || undefined,
      default_uom: args.default_uom?.trim() || undefined,
      tax_class: args.tax_class,
      attribute_schema: args.attribute_schema,
      display_order: args.display_order ?? 0,
      is_active: true,
      status: "ACTIVE",
      created_by: admin._id,
    });
    const after = await ctx.db.get(id);
    await logAction(ctx, {
      action: "category.create",
      target_type: "category",
      target_id: id,
      after,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    name_ar: v.optional(v.string()),
    name_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    default_uom: v.optional(v.string()),
    tax_class: v.optional(
      v.union(
        v.literal("STANDARD"),
        v.literal("ZERO_RATED"),
        v.literal("EXEMPT"),
      ),
    ),
    attribute_schema: v.optional(v.string()),
    display_order: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Category not found");

    const patch: Record<string, unknown> = {};
    if (args.name_ar !== undefined) patch.name_ar = args.name_ar.trim();
    if (args.name_en !== undefined) {
      const trimmed = args.name_en.trim();
      patch.name_en = trimmed;
      // re-slug if EN name changed
      if (trimmed && trimmed !== existing.name_en) {
        patch.slug = await ensureUniqueSlug(ctx, slugify(trimmed), existing._id);
      }
    }
    if (args.description_ar !== undefined)
      patch.description_ar = args.description_ar.trim() || undefined;
    if (args.description_en !== undefined)
      patch.description_en = args.description_en.trim() || undefined;
    if (args.default_uom !== undefined)
      patch.default_uom = args.default_uom.trim() || undefined;
    if (args.tax_class !== undefined) patch.tax_class = args.tax_class;
    if (args.attribute_schema !== undefined)
      patch.attribute_schema = args.attribute_schema;
    if (args.display_order !== undefined) patch.display_order = args.display_order;
    if (args.is_active !== undefined) patch.is_active = args.is_active;

    await ctx.db.patch(args.id, patch);
    const after = await ctx.db.get(args.id);
    const diff = diffShallow(existing as any, after as any);
    await logAction(ctx, {
      action: "category.update",
      target_type: "category",
      target_id: args.id,
      before: diff?.before,
      after: diff?.after,
    });
  },
});

export const archive = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Category not found");
    // Archive subtree to keep tree consistent
    const queue: Id<"categories">[] = [args.id];
    const archived: Id<"categories">[] = [];
    while (queue.length) {
      const cur = queue.shift()!;
      const node = await ctx.db.get(cur);
      if (!node) continue;
      await ctx.db.patch(cur, { status: "ARCHIVED", is_active: false });
      archived.push(cur);
      const children = await ctx.db
        .query("categories")
        .withIndex("by_parent", (q) => q.eq("parent_id", cur))
        .collect();
      queue.push(...children.map((c) => c._id));
    }
    await logAction(ctx, {
      action: "category.archive",
      target_type: "category",
      target_id: args.id,
      details: { archived_count: archived.length, ids: archived },
    });
  },
});

// Suppliers propose a new category (PRD §5.4.2)
export const propose = mutation({
  args: {
    parent_id: v.optional(v.id("categories")),
    name_ar: v.string(),
    name_en: v.string(),
    description_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    default_uom: v.optional(v.string()),
    justification: v.string(),
  },
  handler: async (ctx, args) => {
    const supplier = await requireSupplier(ctx);
    if (!args.name_ar.trim() || !args.name_en.trim())
      throw new ConvexError("Both Arabic and English names are required");
    if (!args.justification.trim())
      throw new ConvexError("Justification is required for category proposals");
    const level = await resolveLevel(ctx, args.parent_id);
    const slug = await ensureUniqueSlug(
      ctx,
      `proposed-${slugify(args.name_en)}`,
    );
    const id = await ctx.db.insert("categories", {
      parent_id: args.parent_id,
      level,
      slug,
      name_ar: args.name_ar.trim(),
      name_en: args.name_en.trim(),
      description_ar: args.description_ar?.trim() || undefined,
      description_en: args.description_en?.trim() || undefined,
      default_uom: args.default_uom?.trim() || undefined,
      is_active: false,
      status: "PROPOSED",
      proposed_by: supplier._id,
      proposed_justification: args.justification.trim(),
    });
    await logAction(ctx, {
      action: "category.propose",
      target_type: "category",
      target_id: id,
      details: {
        name_en: args.name_en,
        parent_id: args.parent_id,
        justification: args.justification,
      },
    });
    return id;
  },
});

export const approveProposal = mutation({
  args: {
    id: v.id("categories"),
    decision_note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const cat = await ctx.db.get(args.id);
    if (!cat) throw new ConvexError("Category not found");
    if (cat.status !== "PROPOSED")
      throw new ConvexError("Only proposed categories can be approved");
    // Promote to ACTIVE and re-slug to drop the "proposed-" prefix
    const newSlug = await ensureUniqueSlug(ctx, slugify(cat.name_en), cat._id);
    await ctx.db.patch(args.id, {
      status: "ACTIVE",
      is_active: true,
      slug: newSlug,
      decided_by: admin._id,
      decided_at: Date.now(),
      decision_note: args.decision_note?.trim() || undefined,
    });
    await logAction(ctx, {
      action: "category.proposal.approve",
      target_type: "category",
      target_id: args.id,
      details: { name_en: cat.name_en, proposed_by: cat.proposed_by },
    });
  },
});

export const rejectProposal = mutation({
  args: {
    id: v.id("categories"),
    decision_note: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const cat = await ctx.db.get(args.id);
    if (!cat) throw new ConvexError("Category not found");
    if (cat.status !== "PROPOSED")
      throw new ConvexError("Only proposed categories can be rejected");
    if (!args.decision_note.trim())
      throw new ConvexError("A reason is required to reject a proposal");
    await ctx.db.patch(args.id, {
      status: "REJECTED",
      is_active: false,
      decided_by: admin._id,
      decided_at: Date.now(),
      decision_note: args.decision_note.trim(),
    });
    await logAction(ctx, {
      action: "category.proposal.reject",
      target_type: "category",
      target_id: args.id,
      details: { reason: args.decision_note, proposed_by: cat.proposed_by },
    });
  },
});

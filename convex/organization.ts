import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireClient } from "./lib";

type OrgTable = "cost_centers" | "branches" | "departments";

const ensureOwnership = async (ctx: any, table: OrgTable, id: Id<any>, clientId: Id<"profiles">) => {
  const doc = await ctx.db.get(id);
  if (!doc) throw new ConvexError("Not found");
  if (doc.client_id !== clientId) throw new ConvexError("Forbidden");
  return doc;
};

const listForClient = async (ctx: any, table: OrgTable, clientId: Id<"profiles">) => {
  const rows = await ctx.db
    .query(table)
    .withIndex("by_client", (q: any) => q.eq("client_id", clientId))
    .order("asc")
    .collect();
  return rows.filter((r: any) => !r.archived);
};

export const listMyCostCenters = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    return listForClient(ctx, "cost_centers", profile._id);
  },
});

export const listMyBranches = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    return listForClient(ctx, "branches", profile._id);
  },
});

export const listMyDepartments = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    return listForClient(ctx, "departments", profile._id);
  },
});

export const createCostCenter = mutation({
  args: { code: v.string(), name: v.string(), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    if (!args.code.trim() || !args.name.trim()) throw new ConvexError("Code and name are required");
    return ctx.db.insert("cost_centers", {
      client_id: profile._id,
      code: args.code.trim(),
      name: args.name.trim(),
      notes: args.notes?.trim() || undefined,
    });
  },
});

export const updateCostCenter = mutation({
  args: {
    id: v.id("cost_centers"),
    code: v.string(),
    name: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    await ensureOwnership(ctx, "cost_centers", args.id, profile._id);
    await ctx.db.patch(args.id, {
      code: args.code.trim(),
      name: args.name.trim(),
      notes: args.notes?.trim() || undefined,
    });
  },
});

export const archiveCostCenter = mutation({
  args: { id: v.id("cost_centers") },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    await ensureOwnership(ctx, "cost_centers", args.id, profile._id);
    await ctx.db.patch(args.id, { archived: true });
  },
});

export const createBranch = mutation({
  args: { name: v.string(), location: v.optional(v.string()), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    if (!args.name.trim()) throw new ConvexError("Name is required");
    return ctx.db.insert("branches", {
      client_id: profile._id,
      name: args.name.trim(),
      location: args.location?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
    });
  },
});

export const updateBranch = mutation({
  args: {
    id: v.id("branches"),
    name: v.string(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    await ensureOwnership(ctx, "branches", args.id, profile._id);
    await ctx.db.patch(args.id, {
      name: args.name.trim(),
      location: args.location?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
    });
  },
});

export const archiveBranch = mutation({
  args: { id: v.id("branches") },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    await ensureOwnership(ctx, "branches", args.id, profile._id);
    await ctx.db.patch(args.id, { archived: true });
  },
});

export const createDepartment = mutation({
  args: { name: v.string(), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    if (!args.name.trim()) throw new ConvexError("Name is required");
    return ctx.db.insert("departments", {
      client_id: profile._id,
      name: args.name.trim(),
      notes: args.notes?.trim() || undefined,
    });
  },
});

export const updateDepartment = mutation({
  args: { id: v.id("departments"), name: v.string(), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    await ensureOwnership(ctx, "departments", args.id, profile._id);
    await ctx.db.patch(args.id, {
      name: args.name.trim(),
      notes: args.notes?.trim() || undefined,
    });
  },
});

export const archiveDepartment = mutation({
  args: { id: v.id("departments") },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    await ensureOwnership(ctx, "departments", args.id, profile._id);
    await ctx.db.patch(args.id, { archived: true });
  },
});

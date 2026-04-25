import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin, getAuthenticatedProfile } from "./lib";

const enrichContract = async (ctx: any, contract: any) => {
  const [client, supplier, lines] = await Promise.all([
    contract.client_id ? ctx.db.get(contract.client_id) : null,
    ctx.db.get(contract.supplier_id),
    ctx.db
      .query("contract_lines")
      .withIndex("by_contract", (q: any) => q.eq("contract_id", contract._id))
      .collect(),
  ]);
  return {
    ...contract,
    client_public_id: (client as any)?.public_id ?? null,
    client_company_name: (client as any)?.company_name ?? null,
    supplier_public_id: (supplier as any)?.public_id ?? "—",
    supplier_company_name: (supplier as any)?.company_name ?? null,
    lines,
  };
};

const isActiveOnDate = (contract: any, today: string) => {
  if (contract.status !== "ACTIVE") return false;
  if (contract.start_date > today) return false;
  if (contract.end_date && contract.end_date < today) return false;
  return true;
};

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const contracts = await ctx.db.query("contracts").order("desc").collect();
    return Promise.all(contracts.map((c) => enrichContract(ctx, c)));
  },
});

export const getById = query({
  args: { id: v.id("contracts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const contract = await ctx.db.get(args.id);
    if (!contract) return null;
    return enrichContract(ctx, contract);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    client_id: v.optional(v.id("profiles")),
    supplier_id: v.id("profiles"),
    start_date: v.string(),
    end_date: v.optional(v.string()),
    payment_terms: v.optional(v.string()),
    discount_percent: v.optional(v.number()),
    terms: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!args.name.trim()) throw new ConvexError("Name required");
    const supplier = await ctx.db.get(args.supplier_id);
    if (!supplier || (supplier as any).role !== "SUPPLIER") throw new ConvexError("Invalid supplier");
    if (args.client_id) {
      const client = await ctx.db.get(args.client_id);
      if (!client || (client as any).role !== "CLIENT") throw new ConvexError("Invalid client");
    }
    if (args.end_date && args.end_date < args.start_date) {
      throw new ConvexError("End date must be on or after start date");
    }
    return ctx.db.insert("contracts", {
      name: args.name.trim(),
      client_id: args.client_id,
      supplier_id: args.supplier_id,
      status: "DRAFT",
      start_date: args.start_date,
      end_date: args.end_date,
      payment_terms: args.payment_terms?.trim() || undefined,
      discount_percent: args.discount_percent,
      terms: args.terms?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      created_by: admin._id,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("contracts"),
    name: v.string(),
    client_id: v.optional(v.id("profiles")),
    supplier_id: v.id("profiles"),
    start_date: v.string(),
    end_date: v.optional(v.string()),
    payment_terms: v.optional(v.string()),
    discount_percent: v.optional(v.number()),
    terms: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const contract = await ctx.db.get(args.id);
    if (!contract) throw new ConvexError("Not found");
    if (contract.status === "TERMINATED") throw new ConvexError("Cannot edit terminated contract");
    if (args.end_date && args.end_date < args.start_date) {
      throw new ConvexError("End date must be on or after start date");
    }
    const { id, ...rest } = args;
    await ctx.db.patch(id, {
      ...rest,
      payment_terms: rest.payment_terms?.trim() || undefined,
      terms: rest.terms?.trim() || undefined,
      notes: rest.notes?.trim() || undefined,
      name: rest.name.trim(),
    });
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("contracts"),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("ACTIVE"),
      v.literal("EXPIRED"),
      v.literal("TERMINATED"),
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const contract = await ctx.db.get(args.id);
    if (!contract) throw new ConvexError("Not found");
    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "TERMINATED") {
      patch.terminated_at = Date.now();
      patch.terminated_reason = args.reason?.trim() || undefined;
    } else {
      patch.terminated_at = undefined;
      patch.terminated_reason = undefined;
    }
    await ctx.db.patch(args.id, patch);
  },
});

export const addLine = mutation({
  args: {
    contract_id: v.id("contracts"),
    product_id: v.optional(v.id("products")),
    description: v.string(),
    unit_price: v.number(),
    min_quantity: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!args.description.trim()) throw new ConvexError("Description required");
    if (args.unit_price < 0) throw new ConvexError("Unit price must be non-negative");
    return ctx.db.insert("contract_lines", {
      contract_id: args.contract_id,
      product_id: args.product_id,
      description: args.description.trim(),
      unit_price: args.unit_price,
      min_quantity: args.min_quantity,
      notes: args.notes?.trim() || undefined,
    });
  },
});

export const updateLine = mutation({
  args: {
    id: v.id("contract_lines"),
    product_id: v.optional(v.id("products")),
    description: v.string(),
    unit_price: v.number(),
    min_quantity: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...rest } = args;
    await ctx.db.patch(id, {
      ...rest,
      description: rest.description.trim(),
      notes: rest.notes?.trim() || undefined,
    });
  },
});

export const removeLine = mutation({
  args: { id: v.id("contract_lines") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

export const findApplicable = query({
  args: {
    client_id: v.id("profiles"),
    supplier_id: v.id("profiles"),
    product_ids: v.array(v.id("products")),
  },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    if (profile.role !== "ADMIN") throw new ConvexError("Forbidden");
    const today = new Date().toISOString().slice(0, 10);
    const supplierContracts = await ctx.db
      .query("contracts")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", args.supplier_id))
      .collect();
    const eligible = supplierContracts.filter((c) => {
      if (!isActiveOnDate(c, today)) return false;
      if (c.client_id && c.client_id !== args.client_id) return false;
      return true;
    });
    if (eligible.length === 0) {
      return { contracts: [], pricing: {} };
    }
    const enriched = await Promise.all(eligible.map((c) => enrichContract(ctx, c)));
    const pricing: Record<string, { price: number; contract_id: Id<"contracts">; contract_name: string; description: string }> = {};
    for (const contract of enriched) {
      for (const line of contract.lines) {
        if (line.product_id && args.product_ids.includes(line.product_id)) {
          const key = String(line.product_id);
          const existing = pricing[key];
          if (!existing || line.unit_price < existing.price) {
            pricing[key] = {
              price: line.unit_price,
              contract_id: contract._id,
              contract_name: contract.name,
              description: line.description,
            };
          }
        }
      }
    }
    return { contracts: enriched, pricing };
  },
});

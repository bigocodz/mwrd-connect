import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireClient } from "./lib";

const DAY = 24 * 60 * 60 * 1000;

const cadenceDays = (cadence: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY") => {
  switch (cadence) {
    case "WEEKLY": return 7;
    case "BIWEEKLY": return 14;
    case "MONTHLY": return 30;
    case "QUARTERLY": return 91;
  }
};

const templateInput = v.object({
  category: v.optional(v.string()),
  template_key: v.optional(v.string()),
  notes: v.optional(v.string()),
  delivery_location: v.optional(v.string()),
  lead_time_days: v.number(),
  cost_center_id: v.optional(v.id("cost_centers")),
  branch_id: v.optional(v.id("branches")),
  department_id: v.optional(v.id("departments")),
  items: v.array(
    v.object({
      product_id: v.optional(v.id("products")),
      custom_item_description: v.optional(v.string()),
      quantity: v.number(),
      flexibility: v.union(
        v.literal("EXACT_MATCH"),
        v.literal("OPEN_TO_EQUIVALENT"),
        v.literal("OPEN_TO_ALTERNATIVES"),
      ),
      special_notes: v.optional(v.string()),
    }),
  ),
});

export const listMine = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    return ctx.db
      .query("rfq_schedules")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    cadence: v.union(
      v.literal("WEEKLY"),
      v.literal("BIWEEKLY"),
      v.literal("MONTHLY"),
      v.literal("QUARTERLY"),
    ),
    start_at: v.number(),
    template: templateInput,
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    if (!args.name.trim()) throw new ConvexError("Name required");
    if (!args.template.items.length) throw new ConvexError("At least one item required");
    return ctx.db.insert("rfq_schedules", {
      client_id: profile._id,
      name: args.name.trim(),
      cadence: args.cadence,
      next_run_at: args.start_at,
      active: true,
      template: args.template,
    });
  },
});

export const setActive = mutation({
  args: { id: v.id("rfq_schedules"), active: v.boolean() },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const schedule = await ctx.db.get(args.id);
    if (!schedule || schedule.client_id !== profile._id) throw new ConvexError("Forbidden");
    await ctx.db.patch(args.id, { active: args.active });
  },
});

export const remove = mutation({
  args: { id: v.id("rfq_schedules") },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const schedule = await ctx.db.get(args.id);
    if (!schedule || schedule.client_id !== profile._id) throw new ConvexError("Forbidden");
    await ctx.db.delete(args.id);
  },
});

const materialize = async (
  ctx: any,
  schedule: any,
): Promise<Id<"rfqs">> => {
  const tpl = schedule.template;
  const requiredBy = new Date(Date.now() + (tpl.lead_time_days ?? 7) * DAY).toISOString().slice(0, 10);
  const rfqId = await ctx.db.insert("rfqs", {
    client_id: schedule.client_id,
    status: "OPEN",
    category: tpl.category,
    template_key: tpl.template_key,
    notes: tpl.notes,
    required_by: requiredBy,
    delivery_location: tpl.delivery_location,
    cost_center_id: tpl.cost_center_id,
    branch_id: tpl.branch_id,
    department_id: tpl.department_id,
  });
  await Promise.all(
    tpl.items.map((item: any) => ctx.db.insert("rfq_items", { ...item, rfq_id: rfqId })),
  );
  // Auto-assign suppliers based on selected products
  const productIds: Id<"products">[] = tpl.items.flatMap((i: any) => (i.product_id ? [i.product_id] : []));
  if (productIds.length > 0) {
    const products = await Promise.all(productIds.map((id) => ctx.db.get(id)));
    const supplierIds = [...new Set(products.filter(Boolean).map((p: any) => p.supplier_id))];
    await Promise.all(
      supplierIds.map((supplierId) =>
        ctx.db.insert("rfq_supplier_assignments", {
          rfq_id: rfqId,
          supplier_id: supplierId,
          assigned_at: Date.now(),
        }),
      ),
    );
  }
  await ctx.db.insert("notifications", {
    user_id: schedule.client_id,
    title: "Scheduled RFQ created",
    message: `Your "${schedule.name}" schedule generated a new RFQ.`,
    link: `/client/rfqs/${rfqId}`,
    read: false,
  });
  return rfqId;
};

export const runNow = mutation({
  args: { id: v.id("rfq_schedules") },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const schedule = await ctx.db.get(args.id);
    if (!schedule || schedule.client_id !== profile._id) throw new ConvexError("Forbidden");
    const rfqId = await materialize(ctx, schedule);
    const interval = cadenceDays(schedule.cadence) * DAY;
    await ctx.db.patch(args.id, {
      last_run_at: Date.now(),
      next_run_at: Date.now() + interval,
    });
    return rfqId;
  },
});

export const runDue = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const schedules = await ctx.db
      .query("rfq_schedules")
      .withIndex("by_active_next", (q) => q.eq("active", true))
      .collect();
    const due = schedules.filter((s) => s.next_run_at <= now);
    for (const schedule of due) {
      await materialize(ctx, schedule);
      const interval = cadenceDays(schedule.cadence) * DAY;
      await ctx.db.patch(schedule._id, {
        last_run_at: now,
        next_run_at: now + interval,
      });
    }
    return { count: due.length };
  },
});

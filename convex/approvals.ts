import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin, requireClient } from "./lib";
import { createFromQuote as createOrderFromQuote } from "./orders";

const computeQuoteTotal = async (ctx: any, quoteId: Id<"quotes">) => {
  const items = await ctx.db
    .query("quote_items")
    .withIndex("by_quote", (q: any) => q.eq("quote_id", quoteId))
    .collect();
  let total = 0;
  for (const item of items) {
    if (!item.is_quoted) continue;
    const rfqItem = await ctx.db.get(item.rfq_item_id);
    const qty = rfqItem?.quantity ?? 1;
    total += (item.final_price_with_vat ?? 0) * qty;
  }
  return total;
};

const findMatchingRule = async (
  ctx: any,
  clientId: Id<"profiles">,
  rfq: any,
  total: number,
) => {
  const rules = await ctx.db
    .query("approval_rules")
    .withIndex("by_client", (q: any) => q.eq("client_id", clientId))
    .collect();
  return rules.find((rule: any) => {
    if (!rule.enabled) return false;
    if (total < rule.min_amount) return false;
    if (rule.max_amount != null && total > rule.max_amount) return false;
    if (rule.category && rule.category !== rfq.category) return false;
    if (rule.cost_center_id && rule.cost_center_id !== rfq.cost_center_id) return false;
    if (rule.branch_id && rule.branch_id !== rfq.branch_id) return false;
    if (rule.department_id && rule.department_id !== rfq.department_id) return false;
    return true;
  });
};

export const checkApprovalForQuote = async (
  ctx: any,
  quoteId: Id<"quotes">,
  clientId: Id<"profiles">,
) => {
  const quote = await ctx.db.get(quoteId);
  if (!quote) return null;
  const rfq = await ctx.db.get(quote.rfq_id);
  if (!rfq) return null;
  const total = await computeQuoteTotal(ctx, quoteId);
  const rule = await findMatchingRule(ctx, clientId, rfq, total);
  if (!rule) return null;
  const requestId = await ctx.db.insert("approval_requests", {
    quote_id: quoteId,
    rfq_id: quote.rfq_id,
    client_id: clientId,
    rule_id: rule._id,
    rule_name: rule.name,
    quote_total: total,
    status: "PENDING",
    requested_at: Date.now(),
  });
  const admins = await ctx.db
    .query("profiles")
    .withIndex("by_role", (q: any) => q.eq("role", "ADMIN"))
    .collect();
  await Promise.all(
    admins.map((admin: any) =>
      ctx.db.insert("notifications", {
        user_id: admin._id,
        title: "Approval required",
        message: `${rule.name} triggered for SAR ${total.toFixed(2)}`,
        link: `/admin/approvals`,
        read: false,
      }),
    ),
  );
  return requestId;
};

export const listMyRules = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    return ctx.db
      .query("approval_rules")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("asc")
      .collect();
  },
});

export const upsertRule = mutation({
  args: {
    id: v.optional(v.id("approval_rules")),
    name: v.string(),
    min_amount: v.number(),
    max_amount: v.optional(v.number()),
    category: v.optional(v.string()),
    cost_center_id: v.optional(v.id("cost_centers")),
    branch_id: v.optional(v.id("branches")),
    department_id: v.optional(v.id("departments")),
    enabled: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    if (!args.name.trim()) throw new ConvexError("Name is required");
    if (args.min_amount < 0) throw new ConvexError("Minimum amount must be non-negative");
    if (args.max_amount != null && args.max_amount < args.min_amount) {
      throw new ConvexError("Maximum must be greater than minimum");
    }
    const verifyOwn = async (table: "cost_centers" | "branches" | "departments", id: any) => {
      const doc = (await ctx.db.get(id)) as { client_id?: any } | null;
      if (!doc || doc.client_id !== profile._id) throw new ConvexError(`Invalid ${table}`);
    };
    if (args.cost_center_id) await verifyOwn("cost_centers", args.cost_center_id);
    if (args.branch_id) await verifyOwn("branches", args.branch_id);
    if (args.department_id) await verifyOwn("departments", args.department_id);

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || existing.client_id !== profile._id) throw new ConvexError("Forbidden");
      const { id: _id, ...rest } = args;
      await ctx.db.patch(args.id, rest);
      return args.id;
    }
    const { id: _id, ...rest } = args;
    return ctx.db.insert("approval_rules", { ...rest, client_id: profile._id });
  },
});

export const deleteRule = mutation({
  args: { id: v.id("approval_rules") },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.client_id !== profile._id) throw new ConvexError("Forbidden");
    await ctx.db.delete(args.id);
  },
});

export const listMyRequests = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    const requests = await ctx.db
      .query("approval_requests")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("desc")
      .collect();
    return Promise.all(
      requests.map(async (r) => ({
        ...r,
        decided_by_profile: r.decided_by ? await ctx.db.get(r.decided_by) : null,
      })),
    );
  },
});

export const listPending = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const requests = await ctx.db
      .query("approval_requests")
      .withIndex("by_status", (q) => q.eq("status", "PENDING"))
      .order("desc")
      .collect();
    return Promise.all(
      requests.map(async (r) => {
        const client = await ctx.db.get(r.client_id);
        const quote = await ctx.db.get(r.quote_id);
        const rfq = await ctx.db.get(r.rfq_id);
        return {
          ...r,
          client_public_id: client?.public_id ?? "—",
          client_company_name: (client as any)?.company_name,
          quote_status: quote?.status,
          rfq_category: rfq?.category,
        };
      }),
    );
  },
});

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const requests = await ctx.db.query("approval_requests").order("desc").collect();
    return Promise.all(
      requests.map(async (r) => {
        const client = await ctx.db.get(r.client_id);
        return {
          ...r,
          client_public_id: client?.public_id ?? "—",
          client_company_name: (client as any)?.company_name,
        };
      }),
    );
  },
});

export const approve = mutation({
  args: { id: v.id("approval_requests"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const request = await ctx.db.get(args.id);
    if (!request) throw new ConvexError("Not found");
    if (request.status !== "PENDING") throw new ConvexError("Already decided");
    await ctx.db.patch(args.id, {
      status: "APPROVED",
      decided_at: Date.now(),
      decided_by: admin._id,
      decision_note: args.note,
    });
    await createOrderFromQuote(ctx, request.quote_id, request.client_id);
    await ctx.db.insert("notifications", {
      user_id: request.client_id,
      title: "Approval granted",
      message: `${request.rule_name} approved.`,
      link: "/client/orders",
      read: false,
    });
  },
});

export const reject = mutation({
  args: { id: v.id("approval_requests"), note: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const request = await ctx.db.get(args.id);
    if (!request) throw new ConvexError("Not found");
    if (request.status !== "PENDING") throw new ConvexError("Already decided");
    await ctx.db.patch(args.id, {
      status: "REJECTED",
      decided_at: Date.now(),
      decided_by: admin._id,
      decision_note: args.note,
    });
    const quote = await ctx.db.get(request.quote_id);
    if (quote && quote.status === "ACCEPTED") {
      await ctx.db.patch(request.quote_id, { status: "REJECTED" });
    }
    await ctx.db.insert("notifications", {
      user_id: request.client_id,
      title: "Approval rejected",
      message: args.note,
      link: "/client/quotes",
      read: false,
    });
  },
});

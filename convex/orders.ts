import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin, requireAdminRead, requireClient, requireSupplier, getAuthenticatedProfile } from "./lib";
import { logAction } from "./audit";
import { enqueueNotification } from "./notifyHelpers";

const ORDER_STATUSES = [
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PREPARING",
  "DISPATCHED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

const computeQuoteTotals = async (ctx: any, quoteId: Id<"quotes">) => {
  const quoteItems = await ctx.db
    .query("quote_items")
    .withIndex("by_quote", (q: any) => q.eq("quote_id", quoteId))
    .collect();
  let totalBeforeVat = 0;
  let totalWithVat = 0;
  for (const item of quoteItems) {
    if (!item.is_quoted) continue;
    const rfqItem = await ctx.db.get(item.rfq_item_id);
    const quantity = rfqItem?.quantity ?? 1;
    totalBeforeVat += (item.final_price_before_vat ?? 0) * quantity;
    totalWithVat += (item.final_price_with_vat ?? 0) * quantity;
  }
  return { totalBeforeVat, totalWithVat };
};

// Routes through enqueueNotification so cross-channel dispatch (email
// today, SMS/WhatsApp later) fans out automatically. PRD §10.1.
const notify = async (
  ctx: any,
  userId: Id<"profiles">,
  title: string,
  message: string,
  link: string,
  event_type?: string,
) => {
  await enqueueNotification(ctx, {
    user_id: userId,
    event_type,
    title,
    message,
    link,
  });
};

const notifyAdmins = async (
  ctx: any,
  title: string,
  message: string,
  link: string,
  event_type?: string,
) => {
  const admins = await ctx.db
    .query("profiles")
    .withIndex("by_role", (q: any) => q.eq("role", "ADMIN"))
    .collect();
  await Promise.all(
    admins.map((admin: any) => notify(ctx, admin._id, title, message, link, event_type)),
  );
};

export const createFromQuote = async (ctx: any, quoteId: Id<"quotes">, actorId: Id<"profiles">) => {
  const quote = await ctx.db.get(quoteId);
  if (!quote) throw new ConvexError("Quote not found");
  const existing = await ctx.db
    .query("orders")
    .withIndex("by_quote", (q: any) => q.eq("quote_id", quoteId))
    .unique();
  if (existing) return existing._id as Id<"orders">;
  const rfq = await ctx.db.get(quote.rfq_id);
  if (!rfq) throw new ConvexError("RFQ not found");
  const totals = await computeQuoteTotals(ctx, quoteId);
  const orderId = await ctx.db.insert("orders", {
    rfq_id: quote.rfq_id,
    quote_id: quoteId,
    client_id: rfq.client_id,
    supplier_id: quote.supplier_id,
    status: "PENDING_CONFIRMATION" as OrderStatus,
    total_before_vat: totals.totalBeforeVat,
    total_with_vat: totals.totalWithVat,
    delivery_location: rfq.delivery_location,
    required_by: rfq.required_by,
  });
  await ctx.db.insert("order_events", {
    order_id: orderId,
    actor_id: actorId,
    actor_role: "CLIENT",
    event_type: "CREATED",
    message: "Client accepted the quote and the order was created.",
    created_at: Date.now(),
  });
  await notify(
    ctx,
    quote.supplier_id,
    "New order to confirm",
    "A client accepted your quote. Confirm the order to begin preparation.",
    `/supplier/orders/${orderId}`,
  );
  await notifyAdmins(
    ctx,
    "New order created",
    "A client accepted a quote and created an order.",
    `/admin/orders/${orderId}`,
  );
  return orderId as Id<"orders">;
};

const enrichOrder = async (ctx: any, order: any) => {
  const [client, supplier, rfq, events] = await Promise.all([
    ctx.db.get(order.client_id),
    ctx.db.get(order.supplier_id),
    ctx.db.get(order.rfq_id),
    ctx.db
      .query("order_events")
      .withIndex("by_order", (q: any) => q.eq("order_id", order._id))
      .order("asc")
      .collect(),
  ]);
  return {
    ...order,
    client_public_id: client?.public_id ?? "—",
    client_company_name: client?.company_name,
    supplier_public_id: supplier?.public_id ?? "—",
    supplier_company_name: supplier?.company_name,
    rfq: rfq ? { _id: rfq._id, status: rfq.status, category: rfq.category } : null,
    events,
  };
};

export const listMineClient = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("desc")
      .collect();
    return Promise.all(orders.map((order) => enrichOrder(ctx, order)));
  },
});

export const listMineSupplier = query({
  handler: async (ctx) => {
    const profile = await requireSupplier(ctx);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .order("desc")
      .collect();
    return Promise.all(orders.map((order) => enrichOrder(ctx, order)));
  },
});

export const listAll = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const orders = await ctx.db.query("orders").order("desc").collect();
    return Promise.all(orders.map((order) => enrichOrder(ctx, order)));
  },
});

export const listDisputed = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const orders = await ctx.db.query("orders").collect();
    const disputed = orders
      .filter((o) => o.dispute_status)
      .sort((a, b) => (b.dispute_opened_at ?? b._creationTime) - (a.dispute_opened_at ?? a._creationTime));
    return Promise.all(disputed.map((order) => enrichOrder(ctx, order)));
  },
});

export const getById = query({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    const order = await ctx.db.get(args.id);
    if (!order) return null;
    // ADMIN + AUDITOR (PRD §13.4 read-only) see every order; CLIENT/SUPPLIER
    // only see orders where they're the counterparty.
    if (
      profile.role !== "ADMIN" &&
      profile.role !== "AUDITOR" &&
      order.client_id !== profile._id &&
      order.supplier_id !== profile._id
    ) {
      throw new ConvexError("Forbidden");
    }
    const enriched = await enrichOrder(ctx, order);
    const quote = await ctx.db.get(order.quote_id);
    const quoteItems = quote
      ? await ctx.db
          .query("quote_items")
          .withIndex("by_quote", (q) => q.eq("quote_id", quote._id))
          .collect()
      : [];
    const itemsWithDetails = await Promise.all(
      quoteItems.map(async (item) => {
        const rfqItem = await ctx.db.get(item.rfq_item_id);
        const product = rfqItem?.product_id ? await ctx.db.get(rfqItem.product_id) : null;
        return { ...item, rfq_item: rfqItem ? { ...rfqItem, product } : null };
      }),
    );
    const pod_url = order.pod_storage_id ? await ctx.storage.getUrl(order.pod_storage_id) : null;
    return { ...enriched, quote, items: itemsWithDetails, pod_url };
  },
});

const recordEvent = async (
  ctx: any,
  orderId: Id<"orders">,
  actor: { _id: Id<"profiles">; role: "CLIENT" | "SUPPLIER" | "ADMIN" },
  eventType:
    | "CONFIRMED"
    | "PREPARING"
    | "DISPATCHED"
    | "DELIVERED"
    | "COMPLETED"
    | "CANCELLED"
    | "NOTE"
    | "TRACKING_UPDATED"
    | "POD_UPLOADED"
    | "DISPUTE_OPENED"
    | "DISPUTE_RESOLVED"
    | "DISPUTE_REJECTED",
  message?: string,
) => {
  await ctx.db.insert("order_events", {
    order_id: orderId,
    actor_id: actor._id,
    actor_role: actor.role,
    event_type: eventType,
    message,
    created_at: Date.now(),
  });
};

const requireOrderForSupplier = async (ctx: any, orderId: Id<"orders">) => {
  const profile = await requireSupplier(ctx);
  const order = await ctx.db.get(orderId);
  if (!order) throw new ConvexError("Order not found");
  if (order.supplier_id !== profile._id) throw new ConvexError("Forbidden");
  return { profile, order };
};

const requireOrderForClient = async (ctx: any, orderId: Id<"orders">) => {
  const profile = await requireClient(ctx);
  const order = await ctx.db.get(orderId);
  if (!order) throw new ConvexError("Order not found");
  if (order.client_id !== profile._id) throw new ConvexError("Forbidden");
  return { profile, order };
};

const expectStatus = (order: any, expected: OrderStatus[]) => {
  if (!expected.includes(order.status)) {
    throw new ConvexError(`Order is ${order.status}; cannot perform this action.`);
  }
};

export const confirmBySupplier = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const { profile, order } = await requireOrderForSupplier(ctx, args.id);
    expectStatus(order, ["PENDING_CONFIRMATION"]);
    await ctx.db.patch(args.id, { status: "CONFIRMED", confirmed_at: Date.now() });
    await recordEvent(ctx, args.id, { _id: profile._id, role: "SUPPLIER" }, "CONFIRMED");
    await logAction(ctx, {
      action: "order.confirm",
      target_type: "order",
      target_id: args.id,
      before: { status: order.status },
      after: { status: "CONFIRMED" },
    });
    await notify(
      ctx,
      order.client_id,
      "Order confirmed",
      "Your supplier has confirmed the order.",
      `/client/orders/${args.id}`,
    );
  },
});

export const markPreparing = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const { profile, order } = await requireOrderForSupplier(ctx, args.id);
    expectStatus(order, ["CONFIRMED"]);
    await ctx.db.patch(args.id, { status: "PREPARING", preparing_at: Date.now() });
    await recordEvent(ctx, args.id, { _id: profile._id, role: "SUPPLIER" }, "PREPARING");
    await logAction(ctx, {
      action: "order.preparing",
      target_type: "order",
      target_id: args.id,
      before: { status: order.status },
      after: { status: "PREPARING" },
    });
    await notify(
      ctx,
      order.client_id,
      "Order in preparation",
      "Your supplier is preparing the order.",
      `/client/orders/${args.id}`,
    );
  },
});

export const markDispatched = mutation({
  args: {
    id: v.id("orders"),
    notes: v.optional(v.string()),
    carrier: v.optional(v.string()),
    tracking_number: v.optional(v.string()),
    tracking_url: v.optional(v.string()),
    estimated_delivery_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile, order } = await requireOrderForSupplier(ctx, args.id);
    expectStatus(order, ["PREPARING", "CONFIRMED"]);
    await ctx.db.patch(args.id, {
      status: "DISPATCHED",
      dispatched_at: Date.now(),
      carrier: args.carrier,
      tracking_number: args.tracking_number,
      tracking_url: args.tracking_url,
      estimated_delivery_at: args.estimated_delivery_at,
    });
    await recordEvent(ctx, args.id, { _id: profile._id, role: "SUPPLIER" }, "DISPATCHED", args.notes);
    await logAction(ctx, {
      action: "order.dispatch",
      target_type: "order",
      target_id: args.id,
      before: { status: order.status },
      after: { status: "DISPATCHED" },
      details: { carrier: args.carrier, tracking_number: args.tracking_number },
    });
    await notify(
      ctx,
      order.client_id,
      "Order dispatched",
      args.tracking_number ? `Tracking: ${args.tracking_number}` : "Your order is on the way.",
      `/client/orders/${args.id}`,
    );
  },
});

export const updateTracking = mutation({
  args: {
    id: v.id("orders"),
    carrier: v.optional(v.string()),
    tracking_number: v.optional(v.string()),
    tracking_url: v.optional(v.string()),
    estimated_delivery_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile, order } = await requireOrderForSupplier(ctx, args.id);
    expectStatus(order, ["DISPATCHED"]);
    await ctx.db.patch(args.id, {
      carrier: args.carrier,
      tracking_number: args.tracking_number,
      tracking_url: args.tracking_url,
      estimated_delivery_at: args.estimated_delivery_at,
    });
    await recordEvent(
      ctx,
      args.id,
      { _id: profile._id, role: "SUPPLIER" },
      "TRACKING_UPDATED",
      args.tracking_number ? `Tracking: ${args.tracking_number}` : "Tracking details updated.",
    );
  },
});

export const generatePodUploadUrl = mutation({
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    if (profile.role !== "SUPPLIER" && profile.role !== "ADMIN") {
      throw new ConvexError("Only suppliers or admins can upload proof of delivery");
    }
    return ctx.storage.generateUploadUrl();
  },
});

export const attachProofOfDelivery = mutation({
  args: {
    id: v.id("orders"),
    storage_id: v.id("_storage"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile, order } = await requireOrderForSupplier(ctx, args.id);
    if (!["DISPATCHED", "DELIVERED"].includes(order.status)) {
      throw new ConvexError("Order must be dispatched before uploading proof of delivery.");
    }
    await ctx.db.patch(args.id, {
      pod_storage_id: args.storage_id,
      pod_name: args.name,
      pod_uploaded_at: Date.now(),
    });
    await recordEvent(
      ctx,
      args.id,
      { _id: profile._id, role: "SUPPLIER" },
      "POD_UPLOADED",
      `Proof of delivery attached: ${args.name}`,
    );
    await notify(
      ctx,
      order.client_id,
      "Proof of delivery available",
      "Your supplier uploaded the proof of delivery.",
      `/client/orders/${args.id}`,
    );
  },
});

export const markDelivered = mutation({
  args: { id: v.id("orders"), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { profile, order } = await requireOrderForSupplier(ctx, args.id);
    expectStatus(order, ["DISPATCHED"]);
    await ctx.db.patch(args.id, { status: "DELIVERED", delivered_at: Date.now() });
    await recordEvent(ctx, args.id, { _id: profile._id, role: "SUPPLIER" }, "DELIVERED", args.notes);
    await logAction(ctx, {
      action: "order.deliver",
      target_type: "order",
      target_id: args.id,
      before: { status: order.status },
      after: { status: "DELIVERED" },
    });
    await notify(
      ctx,
      order.client_id,
      "Order delivered",
      "Your order has been delivered. Please confirm to close it out.",
      `/client/orders/${args.id}`,
    );
  },
});

export const confirmByClient = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const { profile, order } = await requireOrderForClient(ctx, args.id);
    expectStatus(order, ["DELIVERED"]);
    await ctx.db.patch(args.id, { status: "COMPLETED", completed_at: Date.now() });
    await recordEvent(ctx, args.id, { _id: profile._id, role: "CLIENT" }, "COMPLETED");
    await logAction(ctx, {
      action: "order.complete",
      target_type: "order",
      target_id: args.id,
      before: { status: order.status },
      after: { status: "COMPLETED" },
    });
    await notify(
      ctx,
      order.supplier_id,
      "Order completed",
      "The client confirmed delivery.",
      `/supplier/orders/${args.id}`,
    );
  },
});

export const cancel = mutation({
  args: { id: v.id("orders"), reason: v.string() },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    if (profile.role === "AUDITOR") throw new ConvexError("Forbidden");
    const order = await ctx.db.get(args.id);
    if (!order) throw new ConvexError("Order not found");
    if (
      profile.role !== "ADMIN" &&
      order.client_id !== profile._id &&
      order.supplier_id !== profile._id
    ) {
      throw new ConvexError("Forbidden");
    }
    if (["COMPLETED", "CANCELLED"].includes(order.status)) {
      throw new ConvexError(`Order is ${order.status}; cannot cancel.`);
    }
    if (profile.role === "CLIENT" && !["PENDING_CONFIRMATION", "CONFIRMED"].includes(order.status)) {
      throw new ConvexError("Clients can only cancel before dispatch.");
    }
    await ctx.db.patch(args.id, {
      status: "CANCELLED",
      cancelled_at: Date.now(),
      cancelled_reason: args.reason,
    });
    await recordEvent(ctx, args.id, { _id: profile._id, role: profile.role }, "CANCELLED", args.reason);
    await logAction(ctx, {
      action: "order.cancel",
      target_type: "order",
      target_id: args.id,
      before: { status: order.status },
      after: { status: "CANCELLED" },
      details: { reason: args.reason },
    });
    const counterpartyId = profile._id === order.client_id ? order.supplier_id : order.client_id;
    await notify(
      ctx,
      counterpartyId,
      "Order cancelled",
      args.reason || "Order cancelled.",
      profile.role === "CLIENT" ? `/supplier/orders/${args.id}` : `/client/orders/${args.id}`,
    );
  },
});

export const openDispute = mutation({
  args: { id: v.id("orders"), reason: v.string() },
  handler: async (ctx, args) => {
    const { profile, order } = await requireOrderForClient(ctx, args.id);
    if (!["DELIVERED", "COMPLETED"].includes(order.status)) {
      throw new ConvexError("Disputes can only be opened after delivery.");
    }
    if (order.dispute_status === "OPEN") {
      throw new ConvexError("A dispute is already open on this order.");
    }
    await ctx.db.patch(args.id, {
      dispute_status: "OPEN",
      dispute_reason: args.reason,
      dispute_opened_by: profile._id,
      dispute_opened_at: Date.now(),
      dispute_resolution: undefined,
      dispute_resolved_by: undefined,
      dispute_resolved_at: undefined,
    });
    await recordEvent(
      ctx,
      args.id,
      { _id: profile._id, role: "CLIENT" },
      "DISPUTE_OPENED",
      args.reason,
    );
    await logAction(ctx, {
      action: "order.dispute.open",
      target_type: "order",
      target_id: args.id,
      after: { dispute_status: "OPEN" },
      details: { reason: args.reason, client_id: order.client_id, supplier_id: order.supplier_id },
    });
    await notify(
      ctx,
      order.supplier_id,
      "Dispute opened on your order",
      args.reason,
      `/supplier/orders/${args.id}`,
    );
    await notifyAdmins(
      ctx,
      "Order dispute opened",
      "A client opened a dispute on a delivered order.",
      `/admin/orders/${args.id}`,
    );
  },
});

export const resolveDispute = mutation({
  args: {
    id: v.id("orders"),
    resolution: v.string(),
    outcome: v.union(v.literal("RESOLVED"), v.literal("REJECTED")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(args.id);
    if (!order) throw new ConvexError("Order not found");
    if (order.dispute_status !== "OPEN") {
      throw new ConvexError("No open dispute on this order.");
    }
    await ctx.db.patch(args.id, {
      dispute_status: args.outcome,
      dispute_resolution: args.resolution,
      dispute_resolved_by: admin._id,
      dispute_resolved_at: Date.now(),
    });
    await recordEvent(
      ctx,
      args.id,
      { _id: admin._id, role: "ADMIN" },
      args.outcome === "RESOLVED" ? "DISPUTE_RESOLVED" : "DISPUTE_REJECTED",
      args.resolution,
    );
    await logAction(ctx, {
      action: args.outcome === "RESOLVED" ? "order.dispute.resolve" : "order.dispute.reject",
      target_type: "order",
      target_id: args.id,
      before: { dispute_status: "OPEN" },
      after: { dispute_status: args.outcome },
      details: { resolution: args.resolution },
    });
    await notify(
      ctx,
      order.client_id,
      args.outcome === "RESOLVED" ? "Dispute resolved" : "Dispute closed",
      args.resolution,
      `/client/orders/${args.id}`,
    );
    await notify(
      ctx,
      order.supplier_id,
      args.outcome === "RESOLVED" ? "Dispute resolved" : "Dispute closed",
      args.resolution,
      `/supplier/orders/${args.id}`,
    );
  },
});

export const addNote = mutation({
  args: { id: v.id("orders"), message: v.string() },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    if (profile.role === "AUDITOR") throw new ConvexError("Forbidden");
    const order = await ctx.db.get(args.id);
    if (!order) throw new ConvexError("Order not found");
    if (
      profile.role !== "ADMIN" &&
      order.client_id !== profile._id &&
      order.supplier_id !== profile._id
    ) {
      throw new ConvexError("Forbidden");
    }
    await recordEvent(ctx, args.id, { _id: profile._id, role: profile.role }, "NOTE", args.message);
  },
});

// Phase 4 — split CPO award flow.
//
// `createFromAward` lets a client award an RFQ either:
//   - FULL_BASKET: one supplier wins every quoted line (legacy behavior).
//   - PER_ITEM: each line is awarded to a specific quote (potentially different
//     supplier). Output is one client_purchase_orders parent + N supplier
//     orders sharing transaction_ref.
//
// Award input is `lines: [{ rfq_item_id, quote_id, quantity }]`. The mutation:
//   1. Resolves each line → its quote → quote_item, validates ownership.
//   2. Groups awarded lines by supplier (via quote.supplier_id).
//   3. Creates the CPO row and one order per supplier with per-line totals.
//   4. Stamps client_po_id + transaction_ref on every order.
const generateTransactionRef = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TX-${yyyy}${mm}${dd}-${rand}`;
};

export const createFromAward = mutation({
  args: {
    rfq_id: v.id("rfqs"),
    award_mode: v.union(v.literal("FULL_BASKET"), v.literal("PER_ITEM")),
    lines: v.array(
      v.object({
        rfq_item_id: v.id("rfq_items"),
        quote_id: v.id("quotes"),
        quantity: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const rfq = await ctx.db.get(args.rfq_id);
    if (!rfq) throw new ConvexError("RFQ not found");
    if (rfq.client_id !== profile._id) throw new ConvexError("Forbidden");
    if (args.lines.length === 0) throw new ConvexError("No award lines");

    // Resolve each line → quote_item under that quote for the rfq_item.
    type Resolved = {
      rfq_item_id: Id<"rfq_items">;
      quote_id: Id<"quotes">;
      supplier_id: Id<"profiles">;
      quote_item_id: Id<"quote_items">;
      quantity: number;
      final_price_before_vat: number;
      final_price_with_vat: number;
    };
    const resolved: Resolved[] = [];
    for (const line of args.lines) {
      const quote = await ctx.db.get(line.quote_id);
      if (!quote) throw new ConvexError("Quote not found");
      if (quote.rfq_id !== args.rfq_id) {
        throw new ConvexError("Quote does not belong to this RFQ");
      }
      const quoteItems = await ctx.db
        .query("quote_items")
        .withIndex("by_quote", (q) => q.eq("quote_id", line.quote_id))
        .collect();
      const matched = quoteItems.find(
        (qi) => qi.rfq_item_id === line.rfq_item_id && qi.is_quoted,
      );
      if (!matched) {
        throw new ConvexError(
          "Awarded line is not quoted in the chosen supplier's quote",
        );
      }
      if (!(line.quantity > 0)) throw new ConvexError("Quantity must be > 0");
      resolved.push({
        rfq_item_id: line.rfq_item_id,
        quote_id: line.quote_id,
        supplier_id: quote.supplier_id,
        quote_item_id: matched._id,
        quantity: line.quantity,
        final_price_before_vat: matched.final_price_before_vat ?? 0,
        final_price_with_vat: matched.final_price_with_vat ?? 0,
      });
    }

    // FULL_BASKET sanity check — single supplier across all lines.
    if (args.award_mode === "FULL_BASKET") {
      const suppliers = new Set(resolved.map((r) => r.supplier_id));
      if (suppliers.size !== 1) {
        throw new ConvexError(
          "FULL_BASKET requires every line to come from one supplier",
        );
      }
    }

    // Group by supplier for SPO creation.
    const bySupplier = new Map<string, Resolved[]>();
    for (const r of resolved) {
      const arr = bySupplier.get(r.supplier_id) ?? [];
      arr.push(r);
      bySupplier.set(r.supplier_id, arr);
    }

    // Compute totals per supplier and the CPO grand total.
    let cpoTotalBeforeVat = 0;
    let cpoTotalWithVat = 0;
    for (const r of resolved) {
      cpoTotalBeforeVat += r.final_price_before_vat * r.quantity;
      cpoTotalWithVat += r.final_price_with_vat * r.quantity;
    }

    const transactionRef = generateTransactionRef();
    const cpoId = await ctx.db.insert("client_purchase_orders", {
      rfq_id: args.rfq_id,
      client_id: profile._id,
      transaction_ref: transactionRef,
      award_mode: args.award_mode,
      status: "OPEN",
      total_before_vat: Math.round(cpoTotalBeforeVat * 100) / 100,
      total_with_vat: Math.round(cpoTotalWithVat * 100) / 100,
      delivery_location: rfq.delivery_location,
      required_by: rfq.required_by,
    });

    const createdOrderIds: Id<"orders">[] = [];
    for (const [supplierIdStr, lines] of bySupplier.entries()) {
      const supplierId = supplierIdStr as Id<"profiles">;
      // Sum this supplier's lines.
      let beforeVat = 0;
      let withVat = 0;
      for (const l of lines) {
        beforeVat += l.final_price_before_vat * l.quantity;
        withVat += l.final_price_with_vat * l.quantity;
      }
      const orderId = await ctx.db.insert("orders", {
        rfq_id: args.rfq_id,
        quote_id: lines[0].quote_id,
        client_id: profile._id,
        supplier_id: supplierId,
        client_po_id: cpoId,
        transaction_ref: transactionRef,
        status: "PENDING_CONFIRMATION" as OrderStatus,
        total_before_vat: Math.round(beforeVat * 100) / 100,
        total_with_vat: Math.round(withVat * 100) / 100,
        delivery_location: rfq.delivery_location,
        required_by: rfq.required_by,
      });
      createdOrderIds.push(orderId as Id<"orders">);
      await ctx.db.insert("order_events", {
        order_id: orderId,
        actor_id: profile._id,
        actor_role: "CLIENT",
        event_type: "CREATED",
        message:
          args.award_mode === "PER_ITEM"
            ? `Awarded ${lines.length} line(s) of ${transactionRef}.`
            : `Client awarded the full basket (${transactionRef}).`,
        created_at: Date.now(),
      });
      await notify(
        ctx,
        supplierId,
        "New order to confirm",
        "A client awarded your quote. Confirm the order to begin preparation.",
        `/supplier/orders/${orderId}`,
      );
    }

    // Mark all losing quotes on this RFQ as REJECTED so suppliers see closure.
    const allRfqQuotes = await ctx.db
      .query("quotes")
      .withIndex("by_rfq", (q) => q.eq("rfq_id", args.rfq_id))
      .collect();
    const winningQuotes = new Set(resolved.map((r) => r.quote_id as string));
    for (const q of allRfqQuotes) {
      if (
        !winningQuotes.has(q._id) &&
        (q.status === "SENT_TO_CLIENT" ||
          q.status === "CLIENT_REVISION_REQUESTED" ||
          q.status === "REVISION_SUBMITTED")
      ) {
        await ctx.db.patch(q._id, { status: "REJECTED" });
      }
    }
    // Mark winning quotes ACCEPTED.
    for (const qid of winningQuotes) {
      const q = await ctx.db.get(qid as Id<"quotes">);
      if (q && q.status !== "ACCEPTED") {
        await ctx.db.patch(qid as Id<"quotes">, { status: "ACCEPTED" });
      }
    }
    // Close the RFQ.
    await ctx.db.patch(args.rfq_id, { status: "CLOSED" });

    await notifyAdmins(
      ctx,
      "New CPO created",
      `A client awarded RFQ ${args.rfq_id}. ${createdOrderIds.length} supplier order(s) opened.`,
      `/admin/cpo/${cpoId}`,
    );

    await logAction(ctx, {
      action: "cpo.create",
      target_type: "client_purchase_order",
      target_id: cpoId,
      details: {
        transaction_ref: transactionRef,
        award_mode: args.award_mode,
        supplier_count: bySupplier.size,
        order_ids: createdOrderIds,
        rfq_id: args.rfq_id,
      },
    });

    return {
      client_po_id: cpoId,
      transaction_ref: transactionRef,
      order_ids: createdOrderIds,
    };
  },
});

export const getCpoById = query({
  args: { id: v.id("client_purchase_orders") },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) return null;
    const cpo = await ctx.db.get(args.id);
    if (!cpo) return null;
    if (
      profile.role !== "ADMIN" &&
      profile.role !== "AUDITOR" &&
      cpo.client_id !== profile._id
    ) {
      return null;
    }
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_client_po", (q) => q.eq("client_po_id", args.id))
      .collect();
    const ordersWithSuppliers = await Promise.all(
      orders.map(async (o) => {
        const supplier = await ctx.db.get(o.supplier_id);
        return {
          ...o,
          supplier_public_id: supplier?.public_id ?? "—",
        };
      }),
    );
    return { ...cpo, orders: ordersWithSuppliers };
  },
});

export const listMyCpos = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    const cpos = await ctx.db
      .query("client_purchase_orders")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("desc")
      .collect();
    return Promise.all(
      cpos.map(async (cpo) => {
        const orders = await ctx.db
          .query("orders")
          .withIndex("by_client_po", (q) => q.eq("client_po_id", cpo._id))
          .collect();
        return { ...cpo, supplier_count: new Set(orders.map((o) => o.supplier_id)).size };
      }),
    );
  },
});

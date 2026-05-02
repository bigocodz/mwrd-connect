/**
 * Delivery Notes — supplier-issued shipment record (distinct from
 * Goods Receipt Notes which the client issues on receipt). The dual-PO
 * lifecycle is: SPO → DN (supplier ships) → GRN (client receives) → INV.
 * The three-way match consumes both DN.shipped_qty and GRN.received_qty.
 */
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  getAuthenticatedProfile,
  requireSupplier,
  requireAdminRead,
} from "./lib";
import { logAction } from "./audit";
import { recomputeMatchForOrder } from "./threeWayMatch";
import { enqueueNotification, enqueueNotifications } from "./notifyHelpers";

const lineInput = v.object({
  quote_item_id: v.optional(v.id("quote_items")),
  rfq_item_id: v.optional(v.id("rfq_items")),
  description: v.string(),
  ordered_qty: v.number(),
  shipped_qty: v.number(),
  notes: v.optional(v.string()),
});

const formatDnNumber = async (ctx: any): Promise<string> => {
  const year = new Date().getFullYear();
  const all = await ctx.db.query("delivery_notes").collect();
  const sameYear = all.filter((d: any) =>
    d.dn_number?.startsWith(`MWRD-DN-${year}-`),
  );
  const next = sameYear.length + 1;
  return `MWRD-DN-${year}-${String(next).padStart(4, "0")}`;
};

const requireOrderForReader = async (ctx: any, orderId: Id<"orders">) => {
  const profile = await getAuthenticatedProfile(ctx);
  if (!profile) throw new ConvexError("Unauthorized");
  const order = await ctx.db.get(orderId);
  if (!order) throw new ConvexError("Order not found");
  if (
    profile.role !== "ADMIN" &&
    profile.role !== "AUDITOR" &&
    order.client_id !== profile._id &&
    order.supplier_id !== profile._id
  ) {
    throw new ConvexError("Forbidden");
  }
  return { profile, order };
};

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    return ctx.storage.generateUploadUrl();
  },
});

export const listForOrder = query({
  args: { order_id: v.id("orders") },
  handler: async (ctx, args) => {
    await requireOrderForReader(ctx, args.order_id);
    const dns = await ctx.db
      .query("delivery_notes")
      .withIndex("by_order", (q) => q.eq("order_id", args.order_id))
      .order("desc")
      .collect();
    return Promise.all(
      dns.map(async (d) => {
        const [lines, photos] = await Promise.all([
          ctx.db
            .query("delivery_note_lines")
            .withIndex("by_delivery_note", (q) =>
              q.eq("delivery_note_id", d._id),
            )
            .collect(),
          Promise.all(
            d.photo_storage_ids.map(async (id) => ({
              storage_id: id,
              url: await ctx.storage.getUrl(id),
            })),
          ),
        ]);
        const issuedBy = await ctx.db.get(d.issued_by);
        return {
          ...d,
          lines,
          photos,
          issued_by_public_id: issuedBy?.public_id ?? null,
        };
      }),
    );
  },
});

export const listMineSupplier = query({
  handler: async (ctx) => {
    const profile = await requireSupplier(ctx);
    const dns = await ctx.db
      .query("delivery_notes")
      .withIndex("by_supplier", (q) => q.eq("supplier_id", profile._id))
      .order("desc")
      .collect();
    return Promise.all(
      dns.map(async (d) => {
        const order = await ctx.db.get(d.order_id);
        const client = order ? await ctx.db.get(order.client_id) : null;
        return {
          ...d,
          order_status: order?.status ?? null,
          client_public_id: client?.public_id ?? "—",
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    order_id: v.id("orders"),
    issued_at: v.optional(v.number()),
    carrier: v.optional(v.string()),
    tracking_number: v.optional(v.string()),
    expected_delivery_at: v.optional(v.number()),
    notes: v.optional(v.string()),
    photo_storage_ids: v.optional(v.array(v.id("_storage"))),
    lines: v.array(lineInput),
    /** ISSUED finalizes the DN immediately; DRAFT keeps it editable. */
    issue_now: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const supplier = await requireSupplier(ctx);
    const order = await ctx.db.get(args.order_id);
    if (!order) throw new ConvexError("Order not found");
    if (order.supplier_id !== supplier._id) throw new ConvexError("Forbidden");
    if (args.lines.length === 0) {
      throw new ConvexError("A delivery note needs at least one line");
    }
    for (const line of args.lines) {
      if (line.shipped_qty < 0) {
        throw new ConvexError("Shipped qty cannot be negative");
      }
      if (line.shipped_qty > line.ordered_qty) {
        // Allow zero (item not shipped this run) but block over-shipment —
        // catches typos before the doc reaches the client.
        throw new ConvexError(
          `Line "${line.description}": shipped > ordered`,
        );
      }
    }

    const dnNumber = await formatDnNumber(ctx);
    const status = args.issue_now ? "ISSUED" : "DRAFT";
    const dnId = await ctx.db.insert("delivery_notes", {
      order_id: args.order_id,
      supplier_id: supplier._id,
      client_id: order.client_id,
      dn_number: dnNumber,
      issued_at: args.issued_at ?? Date.now(),
      issued_by: supplier._id,
      status,
      carrier: args.carrier,
      tracking_number: args.tracking_number,
      expected_delivery_at: args.expected_delivery_at,
      notes: args.notes,
      photo_storage_ids: args.photo_storage_ids ?? [],
    });
    await Promise.all(
      args.lines.map((line) =>
        ctx.db.insert("delivery_note_lines", {
          delivery_note_id: dnId,
          order_id: args.order_id,
          quote_item_id: line.quote_item_id,
          rfq_item_id: line.rfq_item_id,
          description: line.description,
          ordered_qty: line.ordered_qty,
          shipped_qty: line.shipped_qty,
          notes: line.notes,
        }),
      ),
    );

    if (status === "ISSUED") {
      // Bump order status to DISPATCHED if the supplier hadn't already.
      if (order.status === "PREPARING" || order.status === "CONFIRMED") {
        await ctx.db.patch(args.order_id, {
          status: "DISPATCHED",
          dispatched_at: Date.now(),
          carrier: args.carrier ?? order.carrier,
          tracking_number: args.tracking_number ?? order.tracking_number,
          estimated_delivery_at:
            args.expected_delivery_at ?? order.estimated_delivery_at,
        });
        await ctx.db.insert("order_events", {
          order_id: args.order_id,
          actor_id: supplier._id,
          actor_role: "SUPPLIER",
          event_type: "DISPATCHED",
          message: `Delivery note ${dnNumber} issued.`,
          created_at: Date.now(),
        });
      }
      // Recompute three-way match — DN qty is one of the four legs.
      await recomputeMatchForOrder(ctx, args.order_id);
      // Notify client.
      await enqueueNotification(ctx, {
        user_id: order.client_id,
        title: "Order shipped",
        message: `Supplier issued delivery note ${dnNumber}.`,
        link: `/client/orders/${args.order_id}`,
      });
    }

    await logAction(ctx, {
      action: "delivery_note.create",
      target_type: "delivery_note",
      target_id: dnId,
      details: {
        order_id: args.order_id,
        dn_number: dnNumber,
        status,
        line_count: args.lines.length,
      },
    });
    return dnId;
  },
});

export const issue = mutation({
  args: { id: v.id("delivery_notes") },
  handler: async (ctx, args) => {
    const supplier = await requireSupplier(ctx);
    const dn = await ctx.db.get(args.id);
    if (!dn) throw new ConvexError("Not found");
    if (dn.supplier_id !== supplier._id) throw new ConvexError("Forbidden");
    if (dn.status !== "DRAFT") {
      throw new ConvexError(`Cannot issue a DN in status ${dn.status}`);
    }
    await ctx.db.patch(args.id, { status: "ISSUED" });
    const order = await ctx.db.get(dn.order_id);
    if (order && (order.status === "PREPARING" || order.status === "CONFIRMED")) {
      await ctx.db.patch(dn.order_id, {
        status: "DISPATCHED",
        dispatched_at: Date.now(),
        carrier: dn.carrier ?? order.carrier,
        tracking_number: dn.tracking_number ?? order.tracking_number,
        estimated_delivery_at:
          dn.expected_delivery_at ?? order.estimated_delivery_at,
      });
      await ctx.db.insert("order_events", {
        order_id: dn.order_id,
        actor_id: supplier._id,
        actor_role: "SUPPLIER",
        event_type: "DISPATCHED",
        message: `Delivery note ${dn.dn_number} issued.`,
        created_at: Date.now(),
      });
    }
    await recomputeMatchForOrder(ctx, dn.order_id);
    if (order) {
      await enqueueNotification(ctx, {
        user_id: order.client_id,
        title: "Order shipped",
        message: `Supplier issued delivery note ${dn.dn_number}.`,
        link: `/client/orders/${dn.order_id}`,
      });
    }
    await logAction(ctx, {
      action: "delivery_note.issue",
      target_type: "delivery_note",
      target_id: args.id,
    });
  },
});

export const cancel = mutation({
  args: {
    id: v.id("delivery_notes"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const supplier = await requireSupplier(ctx);
    const dn = await ctx.db.get(args.id);
    if (!dn) throw new ConvexError("Not found");
    if (dn.supplier_id !== supplier._id) throw new ConvexError("Forbidden");
    if (dn.status === "CANCELLED") return;
    await ctx.db.patch(args.id, {
      status: "CANCELLED",
      cancelled_at: Date.now(),
      cancelled_reason: args.reason,
    });
    await recomputeMatchForOrder(ctx, dn.order_id);
    await logAction(ctx, {
      action: "delivery_note.cancel",
      target_type: "delivery_note",
      target_id: args.id,
      details: { reason: args.reason },
    });
  },
});

export const adminListAll = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("DRAFT"),
        v.literal("ISSUED"),
        v.literal("CANCELLED"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdminRead(ctx);
    const dns = args.status
      ? await ctx.db
          .query("delivery_notes")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .order("desc")
          .collect()
      : await ctx.db.query("delivery_notes").order("desc").collect();
    return Promise.all(
      dns.map(async (d) => {
        const supplier = await ctx.db.get(d.supplier_id);
        const client = await ctx.db.get(d.client_id);
        return {
          ...d,
          supplier_public_id: supplier?.public_id ?? "—",
          client_public_id: client?.public_id ?? "—",
        };
      }),
    );
  },
});

/**
 * Goods Receipt Notes (PRD §6.10).
 *
 * Clients record receipt of dispatched orders here. Each GRN captures
 * per-line received quantities and condition, optional photos, and an
 * optional discrepancy. Multiple GRNs per order are supported so partial
 * deliveries don't need a single all-or-nothing receipt.
 *
 * The discrepancy flow (PRD §6.10 "discrepancy flow"): a GRN with
 * has_discrepancy=true posts an admin notification so MWRD can mediate
 * with the supplier.
 */
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  getAuthenticatedProfile,
  requireAdmin,
  requireAdminRead,
  requireClient,
} from "./lib";
import { logAction } from "./audit";
import { recomputeMatchForOrder } from "./threeWayMatch";
import { enqueueNotification, enqueueNotifications } from "./notifyHelpers";

const CONDITION = v.union(
  v.literal("GOOD"),
  v.literal("DAMAGED"),
  v.literal("SHORT_SHIPPED"),
  v.literal("WRONG_ITEM"),
);

const lineInput = v.object({
  quote_item_id: v.optional(v.id("quote_items")),
  rfq_item_id: v.optional(v.id("rfq_items")),
  description: v.string(),
  ordered_qty: v.number(),
  received_qty: v.number(),
  condition: CONDITION,
  notes: v.optional(v.string()),
});

// ==================== Numbering ====================

const formatGrnNumber = async (ctx: any): Promise<string> => {
  const year = new Date().getFullYear();
  const all = await ctx.db.query("goods_receipt_notes").collect();
  const sameYear = all.filter((g: any) =>
    g.grn_number?.startsWith(`MWRD-GRN-${year}-`),
  );
  const next = sameYear.length + 1;
  return `MWRD-GRN-${year}-${String(next).padStart(4, "0")}`;
};

// ==================== Auth helpers ====================

const requireOrderForReader = async (
  ctx: any,
  orderId: Id<"orders">,
) => {
  const profile = await getAuthenticatedProfile(ctx);
  if (!profile) throw new ConvexError("Unauthorized");
  const order = await ctx.db.get(orderId);
  if (!order) throw new ConvexError("Order not found");
  // ADMIN + AUDITOR (PRD §13.4 read-only) can read every order's GRNs;
  // CLIENT/SUPPLIER are scoped to their own.
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

const enrichLines = async (ctx: any, grnId: Id<"goods_receipt_notes">) => {
  return ctx.db
    .query("grn_lines")
    .withIndex("by_grn", (q: any) => q.eq("grn_id", grnId))
    .collect();
};

// ==================== Queries ====================

export const generateUploadUrl = mutation({
  // Receiving photos are uploaded directly to Convex storage; the URL is
  // exchanged for a storage_id which we attach to the GRN.
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
    const grns = await ctx.db
      .query("goods_receipt_notes")
      .withIndex("by_order", (q) => q.eq("order_id", args.order_id))
      .order("desc")
      .collect();
    return Promise.all(
      grns.map(async (g) => {
        const [lines, photos] = await Promise.all([
          enrichLines(ctx, g._id),
          Promise.all(
            g.photo_storage_ids.map(async (id) => ({
              storage_id: id,
              url: await ctx.storage.getUrl(id),
            })),
          ),
        ]);
        const receivedBy = await ctx.db.get(g.received_by);
        return {
          ...g,
          lines,
          photos,
          received_by_public_id: receivedBy?.public_id ?? null,
        };
      }),
    );
  },
});

export const listMine = query({
  // All GRNs raised by the calling client across their orders. Useful for
  // the "Recent receipts" widget on the dashboard (future).
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    return ctx.db
      .query("goods_receipt_notes")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("desc")
      .collect();
  },
});

export const listDisputed = query({
  // Admin queue: GRNs flagged with discrepancy that need MWRD mediation.
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const grns = await ctx.db
      .query("goods_receipt_notes")
      .withIndex("by_status", (q) => q.eq("status", "DISPUTED"))
      .order("desc")
      .collect();
    return Promise.all(
      grns.map(async (g) => {
        const order = await ctx.db.get(g.order_id);
        const client = await ctx.db.get(g.client_id);
        const supplier = await ctx.db.get(g.supplier_id);
        return {
          ...g,
          order_status: order?.status,
          client_public_id: client?.public_id ?? "—",
          supplier_public_id: supplier?.public_id ?? "—",
        };
      }),
    );
  },
});

// ==================== Mutations ====================

export const create = mutation({
  args: {
    order_id: v.id("orders"),
    received_at: v.optional(v.number()),
    notes: v.optional(v.string()),
    photo_storage_ids: v.optional(v.array(v.id("_storage"))),
    lines: v.array(lineInput),
    discrepancy_summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const order = await ctx.db.get(args.order_id);
    if (!order) throw new ConvexError("Order not found");
    if (order.client_id !== profile._id) throw new ConvexError("Forbidden");
    if (!["DISPATCHED", "DELIVERED", "COMPLETED"].includes(order.status)) {
      throw new ConvexError(
        "Receipts can only be recorded after dispatch",
      );
    }
    if (args.lines.length === 0) {
      throw new ConvexError("At least one line is required");
    }
    for (const line of args.lines) {
      if (line.received_qty < 0) {
        throw new ConvexError("Received quantity must be non-negative");
      }
    }

    const hasDiscrepancy = args.lines.some(
      (l) => l.condition !== "GOOD" || l.received_qty < l.ordered_qty,
    );
    const grnNumber = await formatGrnNumber(ctx);

    const grnId = await ctx.db.insert("goods_receipt_notes", {
      order_id: args.order_id,
      client_id: order.client_id,
      supplier_id: order.supplier_id,
      grn_number: grnNumber,
      received_at: args.received_at ?? Date.now(),
      received_by: profile._id,
      status: hasDiscrepancy ? "DISPUTED" : "CONFIRMED",
      has_discrepancy: hasDiscrepancy,
      discrepancy_summary: hasDiscrepancy
        ? args.discrepancy_summary?.trim() || undefined
        : undefined,
      notes: args.notes?.trim() || undefined,
      photo_storage_ids: args.photo_storage_ids ?? [],
    });

    for (const line of args.lines) {
      await ctx.db.insert("grn_lines", {
        grn_id: grnId,
        order_id: args.order_id,
        quote_item_id: line.quote_item_id,
        rfq_item_id: line.rfq_item_id,
        description: line.description.trim() || "—",
        ordered_qty: line.ordered_qty,
        received_qty: line.received_qty,
        condition: line.condition,
        notes: line.notes?.trim() || undefined,
      });
    }

    // Notify the supplier so they see the receipt landed
    await enqueueNotification(ctx, {
      user_id: order.supplier_id,
      event_type: hasDiscrepancy ? "grn.discrepancy" : "grn.confirmed",
      title: hasDiscrepancy ? "Receipt with discrepancy" : "Receipt confirmed",
      message: `${grnNumber} for order ${args.order_id.slice(0, 8)}…`,
      link: `/supplier/orders/${args.order_id}`,
    });
    if (hasDiscrepancy) {
      const admins = await ctx.db
        .query("profiles")
        .withIndex("by_role", (q) => q.eq("role", "ADMIN"))
        .collect();
      await enqueueNotifications(
        ctx,
        admins.map((a) => a._id),
        {
          event_type: "grn.discrepancy",
          title: "GRN discrepancy reported",
          message: `${grnNumber}: ${args.discrepancy_summary?.trim() ?? "see lines"}`,
          link: `/admin/orders/${args.order_id}`,
        },
      );
    }

    await logAction(ctx, {
      action: "grn.create",
      target_type: "goods_receipt_note",
      target_id: grnId,
      after: { status: hasDiscrepancy ? "DISPUTED" : "CONFIRMED" },
      details: {
        grn_number: grnNumber,
        order_id: args.order_id,
        line_count: args.lines.length,
        has_discrepancy: hasDiscrepancy,
      },
    });

    // Re-reconcile any invoices that already exist for this order (PRD §6.11).
    await recomputeMatchForOrder(ctx, args.order_id);

    return grnId;
  },
});

export const resolveDiscrepancy = mutation({
  args: {
    id: v.id("goods_receipt_notes"),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const grn = await ctx.db.get(args.id);
    if (!grn) throw new ConvexError("GRN not found");
    if (grn.status !== "DISPUTED") {
      throw new ConvexError("Only disputed GRNs can be resolved");
    }
    if (!args.resolution.trim()) {
      throw new ConvexError("Resolution note is required");
    }
    await ctx.db.patch(args.id, {
      status: "CLOSED",
      resolution: args.resolution.trim(),
      resolved_by: admin._id,
      resolved_at: Date.now(),
    });
    await ctx.db.insert("notifications", {
      user_id: grn.client_id,
      title: "Receipt discrepancy resolved",
      message: args.resolution.trim(),
      link: `/client/orders/${grn.order_id}`,
      read: false,
    });
    await ctx.db.insert("notifications", {
      user_id: grn.supplier_id,
      title: "Receipt discrepancy resolved",
      message: args.resolution.trim(),
      link: `/supplier/orders/${grn.order_id}`,
      read: false,
    });
    await logAction(ctx, {
      action: "grn.resolve",
      target_type: "goods_receipt_note",
      target_id: args.id,
      before: { status: "DISPUTED" },
      after: { status: "CLOSED" },
      details: { resolution: args.resolution },
    });

    // Closing a discrepancy unblocks any DISPUTED_GRN-flagged invoices.
    await recomputeMatchForOrder(ctx, grn.order_id);
  },
});

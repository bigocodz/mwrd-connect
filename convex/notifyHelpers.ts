/**
 * V8-side helpers for the notification system. Lives outside convex/notify.ts
 * because that file is "use node" (HTTP fetch) and Convex mutations have to
 * import their helpers from V8-runtime modules.
 *
 * Usage from any mutation:
 *
 *   import { enqueueNotification } from "./notifyHelpers";
 *   await enqueueNotification(ctx, {
 *     user_id: profile._id,
 *     event_type: "invoice.issued",
 *     title: "New invoice issued",
 *     message: `Invoice ${invoice_number} for SAR ${total}.`,
 *     link: "/client/invoices",
 *   });
 *
 * Inserts the in-app row (so existing UI keeps working unchanged) AND
 * schedules the cross-channel dispatch (email today, SMS/WhatsApp later).
 */
import { MutationCtx, internalQuery, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export async function enqueueNotification(
  ctx: MutationCtx,
  args: {
    user_id: Id<"profiles">;
    event_type?: string;
    title: string;
    message?: string;
    link?: string;
  },
): Promise<Id<"notifications">> {
  const id = await ctx.db.insert("notifications", {
    user_id: args.user_id,
    title: args.title,
    message: args.message,
    link: args.link,
    read: false,
    event_type: args.event_type,
  });
  // Fire-and-forget cross-channel dispatch on the next tick. Mutations
  // can't call actions directly; the scheduler handles the hop.
  await ctx.scheduler.runAfter(0, internal.notify.dispatch, {
    notification_id: id,
  });
  return id;
}

/**
 * Convenience for fan-out events ("notify all admins"). Schedules one
 * dispatch per recipient. Caller is responsible for resolving the
 * recipient list (e.g., listing all admins).
 */
export async function enqueueNotifications(
  ctx: MutationCtx,
  recipients: Id<"profiles">[],
  args: {
    event_type?: string;
    title: string;
    message?: string;
    link?: string;
  },
): Promise<Id<"notifications">[]> {
  const ids: Id<"notifications">[] = [];
  for (const recipient of recipients) {
    const id = await enqueueNotification(ctx, { ...args, user_id: recipient });
    ids.push(id);
  }
  return ids;
}

// ==================== Internal queries / mutations used by the dispatch action ====================
// These live here (V8 runtime) rather than in convex/notify.ts because that
// file is "use node" and Convex disallows queries/mutations in Node modules.
// The Node-runtime dispatch action runs them via ctx.runQuery / ctx.runMutation.

export const _getNotificationContext = internalQuery({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.id);
    if (!notif) return null;
    const profile = await ctx.db.get(notif.user_id);
    if (!profile) return { notif, profile: null, email: null, template: null };
    const user = profile.userId ? await ctx.db.get(profile.userId) : null;
    // Look up the matching notification template by event_type. May be null
    // — dispatch falls back to the generic wrapper in that case.
    const template = notif.event_type
      ? await ctx.db
          .query("notification_templates")
          .withIndex("by_event_type", (q) => q.eq("event_type", notif.event_type as string))
          .unique()
      : null;
    // Per-user channel pref for this event type (PRD §10.2). Missing row =
    // every wired channel is opt-in by default.
    const prefRow = notif.event_type
      ? await ctx.db
          .query("notification_channel_prefs")
          .withIndex("by_user_and_event", (q) =>
            q.eq("user_id", notif.user_id).eq("event_type", notif.event_type as string),
          )
          .unique()
      : null;
    return {
      notif,
      profile,
      email: (user as any)?.email ?? null,
      preferred_language: (profile as any)?.preferred_language ?? "ar",
      template,
      pref: prefRow,
    };
  },
});

export const _writeDispatchLog = internalMutation({
  args: {
    notification_id: v.id("notifications"),
    user_id: v.id("profiles"),
    channel: v.union(
      v.literal("EMAIL"),
      v.literal("SMS"),
      v.literal("WHATSAPP"),
      v.literal("WEBHOOK"),
    ),
    status: v.union(
      v.literal("SUCCESS"),
      v.literal("FAILED"),
      v.literal("SKIPPED"),
      v.literal("MOCK"),
    ),
    target: v.optional(v.string()),
    error_message: v.optional(v.string()),
    duration_ms: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notification_dispatch_log", args);
  },
});

export const _markDispatched = internalMutation({
  args: {
    id: v.id("notifications"),
    channels: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      dispatched_at: Date.now(),
      dispatched_channels: args.channels,
    });
  },
});

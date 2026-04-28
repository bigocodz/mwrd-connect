import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedProfile } from "./lib";

export const listMine = query({
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) return [];
    // Honor per-user in_app opt-outs (PRD §10.2). Notifications the user
    // explicitly muted for their event_type are filtered out before the
    // bell sees them, which also keeps the unread count honest.
    const prefs = await ctx.db
      .query("notification_channel_prefs")
      .withIndex("by_user", (q) => q.eq("user_id", profile._id))
      .collect();
    const mutedEvents = new Set(
      prefs.filter((p) => p.in_app === false).map((p) => p.event_type),
    );
    // Read with headroom so we still hand back ~20 visible items even
    // when many were muted. 60 is plenty for any realistic mute ratio.
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("user_id", profile._id))
      .order("desc")
      .take(60);
    const filtered = rows.filter((n) => {
      if (!n.event_type) return true;
      return !mutedEvents.has(n.event_type);
    });
    return filtered.slice(0, 20);
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new Error("Unauthorized");
    const notif = await ctx.db.get(args.id);
    if (!notif || notif.user_id !== profile._id) throw new Error("Not found");
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllRead = mutation({
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new Error("Unauthorized");
    // Mark only the visible (non-muted) ones — muted notifications stay
    // in their original state so the user can still see them later if
    // they re-enable that event_type.
    const prefs = await ctx.db
      .query("notification_channel_prefs")
      .withIndex("by_user", (q) => q.eq("user_id", profile._id))
      .collect();
    const mutedEvents = new Set(
      prefs.filter((p) => p.in_app === false).map((p) => p.event_type),
    );
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("user_id", profile._id))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();
    await Promise.all(
      unread
        .filter((n) => !n.event_type || !mutedEvents.has(n.event_type))
        .map((n) => ctx.db.patch(n._id, { read: true })),
    );
  },
});

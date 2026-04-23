import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedProfile } from "./lib";

export const listMine = query({
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) return [];
    return ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("user_id", profile._id))
      .order("desc")
      .take(20);
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
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("user_id", profile._id))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();
    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { read: true })));
  },
});

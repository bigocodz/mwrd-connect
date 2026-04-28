/**
 * Comments threads on procurement entities (PRD §10.4).
 *
 * Visibility model preserves the anonymity invariant from PRD §4.6:
 *   - INTERNAL          — admin-only notes
 *   - CLIENT_THREAD     — admin + the client party of the target
 *   - SUPPLIER_THREAD   — admin + the supplier party of the target
 *
 * A client never reads SUPPLIER_THREAD comments and vice versa, so
 * supplier identity stays hidden from the client side.
 *
 * @mentions: callers pass `mentioned_profile_ids` explicitly (resolved
 * client-side from a `@public_id` token). Each mentioned user gets an
 * in-app + email notification via the existing dispatch path.
 */

import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthenticatedProfile } from "./lib";
import { logAction } from "./audit";
import { enqueueNotification } from "./notifyHelpers";

type Visibility = "INTERNAL" | "CLIENT_THREAD" | "SUPPLIER_THREAD";

const TARGET_TYPE = v.union(
  v.literal("rfq"),
  v.literal("quote"),
  v.literal("order"),
  v.literal("client_invoice"),
  v.literal("dispute"),
);

const VISIBILITY = v.union(
  v.literal("INTERNAL"),
  v.literal("CLIENT_THREAD"),
  v.literal("SUPPLIER_THREAD"),
);

// ==================== Helpers ====================

/**
 * Resolve a target to its (client_id, supplier_id) tuple. `dispute` shares
 * its target_id with the order it lives on.
 */
async function resolveParties(
  ctx: any,
  target_type: string,
  target_id: string,
): Promise<{ client_id?: Id<"profiles">; supplier_id?: Id<"profiles"> }> {
  switch (target_type) {
    case "rfq": {
      const rfq = await ctx.db.get(target_id as Id<"rfqs">);
      return { client_id: rfq?.client_id };
    }
    case "quote": {
      const quote = await ctx.db.get(target_id as Id<"quotes">);
      if (!quote) return {};
      const rfq = await ctx.db.get(quote.rfq_id);
      return { client_id: rfq?.client_id, supplier_id: quote.supplier_id };
    }
    case "order":
    case "dispute": {
      const order = await ctx.db.get(target_id as Id<"orders">);
      return { client_id: order?.client_id, supplier_id: order?.supplier_id };
    }
    case "client_invoice": {
      const invoice = await ctx.db.get(target_id as Id<"client_invoices">);
      return { client_id: invoice?.client_id };
    }
    default:
      return {};
  }
}

/**
 * Returns the set of visibilities a given role+profile can read on a target.
 * AUDITOR (PRD §13.4) sees the full ADMIN set — they're auditing all threads.
 */
function readableVisibilities(
  role: "CLIENT" | "SUPPLIER" | "ADMIN" | "AUDITOR",
  profileId: Id<"profiles">,
  parties: { client_id?: Id<"profiles">; supplier_id?: Id<"profiles"> },
): Set<Visibility> {
  if (role === "ADMIN" || role === "AUDITOR") {
    return new Set<Visibility>(["INTERNAL", "CLIENT_THREAD", "SUPPLIER_THREAD"]);
  }
  if (role === "CLIENT" && parties.client_id === profileId) {
    return new Set<Visibility>(["CLIENT_THREAD"]);
  }
  if (role === "SUPPLIER" && parties.supplier_id === profileId) {
    return new Set<Visibility>(["SUPPLIER_THREAD"]);
  }
  return new Set();
}

/**
 * Returns the set of visibilities a given role+profile can post under.
 * Tighter than read — non-admins can only post in their own thread, and
 * AUDITORs cannot post at all (read-only role).
 */
function postableVisibilities(
  role: "CLIENT" | "SUPPLIER" | "ADMIN" | "AUDITOR",
  profileId: Id<"profiles">,
  parties: { client_id?: Id<"profiles">; supplier_id?: Id<"profiles"> },
): Set<Visibility> {
  if (role === "AUDITOR") {
    return new Set();
  }
  if (role === "ADMIN") {
    return new Set<Visibility>(["INTERNAL", "CLIENT_THREAD", "SUPPLIER_THREAD"]);
  }
  if (role === "CLIENT" && parties.client_id === profileId) {
    return new Set<Visibility>(["CLIENT_THREAD"]);
  }
  if (role === "SUPPLIER" && parties.supplier_id === profileId) {
    return new Set<Visibility>(["SUPPLIER_THREAD"]);
  }
  return new Set();
}

const buildTargetLink = (target_type: string, target_id: string): string => {
  switch (target_type) {
    case "rfq":
      return `/admin/rfqs/${target_id}/quotes`;
    case "quote":
      return `/admin/quotes/${target_id}/review`;
    case "order":
    case "dispute":
      return `/admin/orders/${target_id}`;
    case "client_invoice":
      return `/admin/client-invoices`;
    default:
      return "/admin/dashboard";
  }
};

// ==================== Queries ====================

export const listForTarget = query({
  args: {
    target_type: TARGET_TYPE,
    target_id: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) return [];
    const parties = await resolveParties(ctx, args.target_type, args.target_id);
    const allowed = readableVisibilities(profile.role, profile._id, parties);
    if (allowed.size === 0) return [];
    const rows = await ctx.db
      .query("comments")
      .withIndex("by_target", (q) =>
        q.eq("target_type", args.target_type).eq("target_id", args.target_id),
      )
      .order("asc")
      .collect();
    const visible = rows.filter((r) => allowed.has(r.visibility as Visibility));
    // Resolve author public_id for display
    const authorIds = [...new Set(visible.map((r) => r.author_profile_id))];
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const authorMap = new Map(
      authors.filter(Boolean).map((a) => [a!._id, a!]),
    );
    return visible.map((r) => ({
      ...r,
      author_public_id: authorMap.get(r.author_profile_id)?.public_id,
      author_company_name: (authorMap.get(r.author_profile_id) as any)?.company_name,
    }));
  },
});

/**
 * Resolve `@public_id` tokens to profile_ids client-side. The composer
 * calls this on every keystroke (debounced) to highlight valid mentions
 * and capture the resolved IDs into `mentioned_profile_ids` on submit.
 */
export const resolveMentions = query({
  args: { public_ids: v.array(v.string()) },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) return [];
    if (args.public_ids.length === 0) return [];
    const out: Array<{ public_id: string; profile_id: Id<"profiles"> }> = [];
    for (const pid of args.public_ids) {
      const match = await ctx.db
        .query("profiles")
        .withIndex("by_public_id", (q) => q.eq("public_id", pid))
        .unique();
      if (match) out.push({ public_id: pid, profile_id: match._id });
    }
    return out;
  },
});

// ==================== Mutations ====================

export const post = mutation({
  args: {
    target_type: TARGET_TYPE,
    target_id: v.string(),
    visibility: VISIBILITY,
    body: v.string(),
    mentioned_profile_ids: v.optional(v.array(v.id("profiles"))),
  },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    if (profile.role === "AUDITOR") {
      // AUDITORs (PRD §13.4) are read-only — block at the mutation surface
      // so the type narrows for author_role and the audit invariant holds.
      throw new ConvexError("Auditors are read-only and cannot post comments");
    }
    if (!args.body.trim()) throw new ConvexError("Comment body is required");
    if (args.body.length > 5000) throw new ConvexError("Comment is too long");

    const parties = await resolveParties(ctx, args.target_type, args.target_id);
    const allowed = postableVisibilities(profile.role, profile._id, parties);
    if (!allowed.has(args.visibility as Visibility)) {
      throw new ConvexError("You can't post this visibility on this target");
    }

    const id = await ctx.db.insert("comments", {
      target_type: args.target_type,
      target_id: args.target_id,
      visibility: args.visibility,
      body: args.body.trim(),
      author_profile_id: profile._id,
      author_role: profile.role,
      mentioned_profile_ids: args.mentioned_profile_ids,
    });

    // Fire @mention notifications (PRD §10.4). We only notify users who
    // can actually *read* this comment given its visibility; mentioning
    // someone outside the thread is a no-op rather than a leak.
    const link = buildTargetLink(args.target_type, args.target_id);
    for (const mentioned of args.mentioned_profile_ids ?? []) {
      const target = await ctx.db.get(mentioned);
      if (!target) continue;
      const targetReadable = readableVisibilities(
        target.role,
        target._id,
        parties,
      );
      if (!targetReadable.has(args.visibility as Visibility)) continue;
      // Don't notify the author of their own mention
      if (target._id === profile._id) continue;
      await enqueueNotification(ctx, {
        user_id: target._id,
        event_type: "comment.mention",
        title: `${profile.public_id ?? profile.role} mentioned you`,
        message:
          args.body.length > 140 ? args.body.slice(0, 140) + "…" : args.body,
        link,
      });
    }

    await logAction(ctx, {
      action: "comment.post",
      target_type: "comment",
      target_id: id,
      details: {
        on: { type: args.target_type, id: args.target_id },
        visibility: args.visibility,
        mention_count: args.mentioned_profile_ids?.length ?? 0,
      },
    });

    return id;
  },
});

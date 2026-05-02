import { QueryCtx, MutationCtx } from "./_generated/server";
import { auth } from "./auth";
import { ConvexError } from "convex/values";

export async function getAuthenticatedProfile(ctx: QueryCtx | MutationCtx) {
  const userId = await auth.getUserId(ctx);
  if (!userId) return null;
  return ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  role: "CLIENT" | "SUPPLIER" | "ADMIN" | "AUDITOR",
) {
  const profile = await getAuthenticatedProfile(ctx);
  if (!profile) throw new ConvexError("Unauthorized");
  if (profile.role !== role) throw new ConvexError("Forbidden");
  return profile;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, "ADMIN");
}

/**
 * Allow ADMIN or AUDITOR (PRD §13.4 — read-only external audit role).
 * Use this on admin-facing QUERIES so auditors can see all the same data
 * as admins. MUTATIONS must continue to use `requireAdmin` so auditors are
 * naturally rejected from any state-changing path.
 */
export async function requireAdminRead(ctx: QueryCtx | MutationCtx) {
  const profile = await getAuthenticatedProfile(ctx);
  if (!profile) throw new ConvexError("Unauthorized");
  if (profile.role !== "ADMIN" && profile.role !== "AUDITOR") {
    throw new ConvexError("Forbidden");
  }
  return profile;
}

export async function requireSupplier(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, "SUPPLIER");
}

export async function requireClient(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, "CLIENT");
}

/**
 * Returns the org-owner profile id for the current actor.
 *
 * Team members are CLIENT profiles with `parent_client_id` set to the org
 * owner's profile id. All org-scoped data (RFQs, orders, cost centers,
 * approvals, etc.) keys on the owner's id so every team member sees the
 * same shared org. Use this in queries/mutations that touch shared client
 * data; use `requireClient` when you need the *actor's* identity (audit,
 * notifications).
 */
export async function getClientOrgId(ctx: QueryCtx | MutationCtx) {
  const profile = await requireClient(ctx);
  return profile.parent_client_id ?? profile._id;
}

/**
 * Returns both the actor and the org-owner id in one call.
 */
export async function requireClientWithOrg(ctx: QueryCtx | MutationCtx) {
  const profile = await requireClient(ctx);
  return { profile, orgId: profile.parent_client_id ?? profile._id };
}

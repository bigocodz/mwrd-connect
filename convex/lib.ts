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
  role: "CLIENT" | "SUPPLIER" | "ADMIN",
) {
  const profile = await getAuthenticatedProfile(ctx);
  if (!profile) throw new ConvexError("Unauthorized");
  if (profile.role !== role) throw new ConvexError("Forbidden");
  return profile;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, "ADMIN");
}

export async function requireSupplier(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, "SUPPLIER");
}

export async function requireClient(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, "CLIENT");
}

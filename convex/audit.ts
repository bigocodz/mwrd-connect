import { MutationCtx } from "./_generated/server";
import { auth } from "./auth";

/**
 * logAction — strict, single-write helper for the append-only audit_log.
 * Resolves the authenticated actor automatically; callers only describe
 * the change. PRD §13.4 (10-year ZATCA retention) requires this on every
 * privileged mutation.
 *
 * Naming convention for `action`:
 *   "<entity>.<verb>"  e.g. "category.create", "user.freeze", "order.cancel"
 *
 * Snapshots:
 *   - For inserts: pass { after } only.
 *   - For deletes: pass { before } only.
 *   - For patches: read the row before patching → pass both { before, after }.
 *   - For multi-row ops: omit before/after, summarize in `details`.
 */
export async function logAction(
  ctx: MutationCtx,
  args: {
    action: string;
    target_type: string;
    target_id?: string;
    before?: unknown;
    after?: unknown;
    details?: unknown;
  },
) {
  const userId = await auth.getUserId(ctx);
  let actor_profile_id: any = undefined;
  let actor_role: "CLIENT" | "SUPPLIER" | "ADMIN" | "AUDITOR" | undefined;
  let actor_public_id: string | undefined;
  if (userId) {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (profile) {
      actor_profile_id = profile._id;
      actor_role = profile.role;
      actor_public_id = profile.public_id ?? undefined;
    }
  }
  await ctx.db.insert("audit_log", {
    actor_user_id: userId ?? undefined,
    actor_profile_id,
    actor_role: actor_role ?? "SYSTEM",
    actor_public_id,
    action: args.action,
    target_type: args.target_type,
    target_id: args.target_id,
    before: args.before,
    after: args.after,
    details: args.details,
  });
}

/**
 * Compute a shallow diff of two records, keyed by changed fields.
 * Useful when logging a patch so the audit row carries before/after
 * for only the fields that actually changed.
 */
export function diffShallow<T extends Record<string, unknown>>(
  before: T | undefined,
  after: T,
): { before: Partial<T>; after: Partial<T> } | undefined {
  if (!before) return { before: {}, after };
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (before[k] !== after[k]) {
      b[k] = before[k];
      a[k] = after[k];
    }
  }
  if (Object.keys(a).length === 0) return undefined;
  return { before: b as Partial<T>, after: a as Partial<T> };
}

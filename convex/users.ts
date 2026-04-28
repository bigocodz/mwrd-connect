import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { modifyAccountCredentials } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { getAuthenticatedProfile, requireAdmin, requireAdminRead } from "./lib";
import { logAction, diffShallow } from "./audit";

export const getMyProfile = query({
  handler: async (ctx) => {
    return getAuthenticatedProfile(ctx);
  },
});

// Used internally from actions
export const getMyProfileInternal = internalQuery({
  handler: async (ctx) => {
    return getAuthenticatedProfile(ctx);
  },
});

export const listAll = query({
  args: {
    role: v.optional(v.string()),
    status: v.optional(v.string()),
    kyc_status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminRead(ctx);
    let profiles = await ctx.db.query("profiles").order("desc").collect();
    if (args.role && args.role !== "ALL") {
      profiles = profiles.filter((p) => p.role === args.role);
    }
    if (args.status && args.status !== "ALL") {
      profiles = profiles.filter((p) => p.status === args.status);
    }
    if (args.kyc_status && args.kyc_status !== "ALL") {
      profiles = profiles.filter((p) => p.kyc_status === args.kyc_status);
    }
    return profiles;
  },
});

export const getById = query({
  args: { id: v.id("profiles") },
  handler: async (ctx, args) => {
    await requireAdminRead(ctx);
    return ctx.db.get(args.id);
  },
});

export const listClients = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    return ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "CLIENT"))
      .order("desc")
      .collect();
  },
});

export const listSuppliers = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    return ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "SUPPLIER"))
      .order("asc")
      .collect();
  },
});

export const listPreferredSuppliers = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const suppliers = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "SUPPLIER"))
      .collect();
    const preferred = suppliers.filter((s) => s.is_preferred);
    return preferred.sort((a, b) => (b.preferred_at ?? 0) - (a.preferred_at ?? 0));
  },
});

export const setPreferredSupplier = mutation({
  args: {
    id: v.id("profiles"),
    is_preferred: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const profile = await ctx.db.get(args.id);
    if (!profile) throw new ConvexError("Supplier not found");
    if (profile.role !== "SUPPLIER") throw new ConvexError("Only suppliers can be marked preferred");
    if (args.is_preferred) {
      await ctx.db.patch(args.id, {
        is_preferred: true,
        preferred_note: args.note,
        preferred_at: Date.now(),
        preferred_by: admin._id,
      });
    } else {
      await ctx.db.patch(args.id, {
        is_preferred: false,
        preferred_note: undefined,
        preferred_at: undefined,
        preferred_by: undefined,
      });
    }
    await logAction(ctx, {
      action: args.is_preferred ? "user.preferred.set" : "user.preferred.unset",
      target_type: "user",
      target_id: args.id,
      details: { public_id: profile.public_id, note: args.note },
    });
  },
});

export const updateProfile = mutation({
  args: {
    id: v.id("profiles"),
    status: v.optional(v.string()),
    kyc_status: v.optional(v.string()),
    credit_limit: v.optional(v.number()),
    payment_terms: v.optional(v.string()),
    client_margin: v.optional(v.union(v.number(), v.null())),
    frozen_at: v.optional(v.union(v.number(), v.null())),
    freeze_reason: v.optional(v.union(v.string(), v.null())),
    frozen_by: v.optional(v.union(v.id("profiles"), v.null())),
    // Legal entity (PRD §3.2.1, §11.1, §8.3)
    company_name: v.optional(v.string()),
    legal_name_ar: v.optional(v.union(v.string(), v.null())),
    legal_name_en: v.optional(v.union(v.string(), v.null())),
    cr_number: v.optional(v.union(v.string(), v.null())),
    vat_number: v.optional(v.union(v.string(), v.null())),
    national_address: v.optional(
      v.union(
        v.object({
          building_number: v.optional(v.string()),
          street: v.optional(v.string()),
          district: v.optional(v.string()),
          city: v.optional(v.string()),
          postal_code: v.optional(v.string()),
          additional_number: v.optional(v.string()),
        }),
        v.null(),
      ),
    ),
    iban: v.optional(v.union(v.string(), v.null())),
    bank_name: v.optional(v.union(v.string(), v.null())),
    bank_account_holder: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...updates }) => {
    await requireAdmin(ctx);
    const before = await ctx.db.get(id);
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) patch[k] = val === null ? undefined : val;
    }
    await ctx.db.patch(id, patch);
    const after = await ctx.db.get(id);
    const diff = diffShallow(before as any, after as any);
    if (diff) {
      await logAction(ctx, {
        action: "user.update_profile",
        target_type: "user",
        target_id: id,
        before: diff.before,
        after: diff.after,
      });
    }
  },
});

export const freezeAccount = mutation({
  args: {
    id: v.id("profiles"),
    freeze_reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const before = await ctx.db.get(args.id);
    await ctx.db.patch(args.id, {
      status: "FROZEN",
      frozen_at: Date.now(),
      freeze_reason: args.freeze_reason,
      frozen_by: admin._id,
    });
    await logAction(ctx, {
      action: "user.freeze",
      target_type: "user",
      target_id: args.id,
      before: { status: before?.status },
      after: { status: "FROZEN" },
      details: { reason: args.freeze_reason, public_id: before?.public_id },
    });
  },
});

export const unfreezeAccount = mutation({
  args: { id: v.id("profiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const before = await ctx.db.get(args.id);
    await ctx.db.patch(args.id, {
      status: "ACTIVE",
      frozen_at: undefined,
      freeze_reason: undefined,
      frozen_by: undefined,
    });
    await logAction(ctx, {
      action: "user.unfreeze",
      target_type: "user",
      target_id: args.id,
      before: { status: before?.status, freeze_reason: before?.freeze_reason },
      after: { status: "ACTIVE" },
      details: { public_id: before?.public_id },
    });
  },
});

export const updateCreditLimit = mutation({
  args: {
    id: v.id("profiles"),
    credit_limit: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const before = await ctx.db.get(args.id);
    await ctx.db.patch(args.id, { credit_limit: args.credit_limit });
    await logAction(ctx, {
      action: "user.credit_limit.update",
      target_type: "user",
      target_id: args.id,
      before: { credit_limit: before?.credit_limit },
      after: { credit_limit: args.credit_limit },
      details: { public_id: before?.public_id },
    });
  },
});

export const adjustBalance = mutation({
  args: {
    id: v.id("profiles"),
    adjustment: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const profile = await ctx.db.get(args.id);
    if (!profile) throw new Error("Profile not found");
    const oldBalance = profile.current_balance ?? 0;
    const newBalance = oldBalance + args.adjustment;
    await ctx.db.patch(args.id, { current_balance: newBalance });
    await logAction(ctx, {
      action: "user.balance.adjust",
      target_type: "user",
      target_id: args.id,
      before: { current_balance: oldBalance },
      after: { current_balance: newBalance },
      details: { adjustment: args.adjustment, public_id: profile.public_id },
    });
    return { newBalance };
  },
});

export const activateAndFlagPasswordChange = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) return;
    await ctx.db.patch(profile._id, {
      status: "ACTIVE",
      must_change_password: true,
    });
  },
});

export const clearMustChangePassword = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) return;
    await ctx.db.patch(profile._id, { must_change_password: undefined });
  },
});

export const changePassword = action({
  args: { newPassword: v.string() },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 8) {
      throw new ConvexError("Password must be at least 8 characters");
    }
    const profile = await ctx.runQuery(internal.users.getMyProfileInternal);
    if (!profile) throw new ConvexError("Not authenticated");

    const user = await ctx.runQuery(internal.users.getUserById, { userId: profile.userId });
    if (!user?.email) throw new ConvexError("No email on account");

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: user.email, secret: args.newPassword },
    });

    await ctx.runMutation(internal.users.clearMustChangePassword, { userId: profile.userId });
  },
});

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => ctx.db.get(args.userId),
});

// ==================== Self-service preferences ====================

export const updateMyPreferences = mutation({
  // Self-service subset of updateProfile. Any authenticated user can edit
  // their own language preference, Hijri toggle, etc. — no admin needed.
  args: {
    preferred_language: v.optional(v.union(v.literal("ar"), v.literal("en"))),
    show_hijri: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    const before = profile;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) return profile._id;
    await ctx.db.patch(profile._id, patch);
    const after = await ctx.db.get(profile._id);
    const diff = diffShallow(before as any, after as any);
    if (diff) {
      await logAction(ctx, {
        action: "user.update_preferences",
        target_type: "user",
        target_id: profile._id,
        before: diff.before,
        after: diff.after,
      });
    }
    return profile._id;
  },
});

// ==================== Stamp & signature uploads (PRD §6.5, §6.6.3) ====================

export const generateUploadUrl = mutation({
  // Convex-storage upload URL. Caller exchanges it client-side for a
  // storage_id, then calls setStamp / setSignature with the result.
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    return ctx.storage.generateUploadUrl();
  },
});

export const setStamp = mutation({
  args: {
    profile_id: v.id("profiles"),
    storage_id: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedProfile(ctx);
    if (!actor) throw new ConvexError("Unauthorized");
    const target = await ctx.db.get(args.profile_id);
    if (!target) throw new ConvexError("Profile not found");
    // Self-update OR admin-managed. Stamps only meaningful for clients in v1.
    if (actor.role !== "ADMIN" && actor._id !== args.profile_id) {
      throw new ConvexError("Forbidden");
    }
    if (target.role !== "CLIENT") {
      throw new ConvexError("Stamps are only used on client profiles");
    }
    // Best-effort cleanup of the old stamp (avoid orphaned blobs)
    if (target.stamp_storage_id && target.stamp_storage_id !== args.storage_id) {
      try {
        await ctx.storage.delete(target.stamp_storage_id);
      } catch {
        // ignore — already gone
      }
    }
    await ctx.db.patch(args.profile_id, {
      stamp_storage_id: args.storage_id,
      stamp_uploaded_at: Date.now(),
    });
    await logAction(ctx, {
      action: "user.stamp.upload",
      target_type: "user",
      target_id: args.profile_id,
      details: { public_id: target.public_id },
    });
  },
});

export const clearStamp = mutation({
  args: { profile_id: v.id("profiles") },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedProfile(ctx);
    if (!actor) throw new ConvexError("Unauthorized");
    const target = await ctx.db.get(args.profile_id);
    if (!target) throw new ConvexError("Profile not found");
    if (actor.role !== "ADMIN" && actor._id !== args.profile_id) {
      throw new ConvexError("Forbidden");
    }
    if (target.stamp_storage_id) {
      try {
        await ctx.storage.delete(target.stamp_storage_id);
      } catch {
        // ignore
      }
    }
    await ctx.db.patch(args.profile_id, {
      stamp_storage_id: undefined,
      stamp_uploaded_at: undefined,
    });
    await logAction(ctx, {
      action: "user.stamp.clear",
      target_type: "user",
      target_id: args.profile_id,
    });
  },
});

export const setSignature = mutation({
  args: {
    profile_id: v.id("profiles"),
    storage_id: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedProfile(ctx);
    if (!actor) throw new ConvexError("Unauthorized");
    const target = await ctx.db.get(args.profile_id);
    if (!target) throw new ConvexError("Profile not found");
    if (actor.role !== "ADMIN" && actor._id !== args.profile_id) {
      throw new ConvexError("Forbidden");
    }
    if (target.signature_storage_id && target.signature_storage_id !== args.storage_id) {
      try {
        await ctx.storage.delete(target.signature_storage_id);
      } catch {
        // ignore
      }
    }
    await ctx.db.patch(args.profile_id, {
      signature_storage_id: args.storage_id,
      signature_uploaded_at: Date.now(),
    });
    await logAction(ctx, {
      action: "user.signature.upload",
      target_type: "user",
      target_id: args.profile_id,
      details: { public_id: target.public_id },
    });
  },
});

export const clearSignature = mutation({
  args: { profile_id: v.id("profiles") },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedProfile(ctx);
    if (!actor) throw new ConvexError("Unauthorized");
    const target = await ctx.db.get(args.profile_id);
    if (!target) throw new ConvexError("Profile not found");
    if (actor.role !== "ADMIN" && actor._id !== args.profile_id) {
      throw new ConvexError("Forbidden");
    }
    if (target.signature_storage_id) {
      try {
        await ctx.storage.delete(target.signature_storage_id);
      } catch {
        // ignore
      }
    }
    await ctx.db.patch(args.profile_id, {
      signature_storage_id: undefined,
      signature_uploaded_at: undefined,
    });
    await logAction(ctx, {
      action: "user.signature.clear",
      target_type: "user",
      target_id: args.profile_id,
    });
  },
});

export const getStampUrl = query({
  args: { profile_id: v.id("profiles") },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.profile_id);
    if (!target?.stamp_storage_id) return null;
    return ctx.storage.getUrl(target.stamp_storage_id);
  },
});

export const getSignatureUrl = query({
  args: { profile_id: v.id("profiles") },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.profile_id);
    if (!target?.signature_storage_id) return null;
    return ctx.storage.getUrl(target.signature_storage_id);
  },
});

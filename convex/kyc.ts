import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin, requireAdminRead, getAuthenticatedProfile } from "./lib";
import { logAction } from "./audit";

const documentType = v.union(
  v.literal("CR_CERTIFICATE"),
  v.literal("VAT_CERTIFICATE"),
  v.literal("NATIONAL_ADDRESS"),
  v.literal("BANK_LETTER"),
  v.literal("AUTHORIZED_SIGNATORY"),
  v.literal("ID_DOCUMENT"),
  v.literal("OTHER"),
);

const enrich = async (ctx: any, doc: any) => {
  const url = doc.storage_id ? await ctx.storage.getUrl(doc.storage_id) : null;
  return { ...doc, url };
};

const recomputeKycStatus = async (ctx: any, profileId: Id<"profiles">) => {
  const docs = await ctx.db
    .query("kyc_documents")
    .withIndex("by_profile", (q: any) => q.eq("profile_id", profileId))
    .collect();
  let next: "INCOMPLETE" | "IN_REVIEW" | "VERIFIED" | "REJECTED" = "INCOMPLETE";
  if (docs.length > 0) {
    if (docs.some((d: any) => d.status === "REJECTED")) next = "REJECTED";
    else if (docs.every((d: any) => d.status === "APPROVED")) next = "VERIFIED";
    else next = "IN_REVIEW";
  }
  await ctx.db.patch(profileId, { kyc_status: next });
};

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    return ctx.storage.generateUploadUrl();
  },
});

export const listMine = query({
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    const docs = await ctx.db
      .query("kyc_documents")
      .withIndex("by_profile", (q) => q.eq("profile_id", profile._id))
      .order("desc")
      .collect();
    return Promise.all(docs.map((doc) => enrich(ctx, doc)));
  },
});

export const listForProfile = query({
  args: { profile_id: v.id("profiles") },
  handler: async (ctx, args) => {
    await requireAdminRead(ctx);
    const docs = await ctx.db
      .query("kyc_documents")
      .withIndex("by_profile", (q) => q.eq("profile_id", args.profile_id))
      .order("desc")
      .collect();
    return Promise.all(docs.map((doc) => enrich(ctx, doc)));
  },
});

export const submit = mutation({
  args: {
    document_type: documentType,
    name: v.string(),
    storage_id: v.id("_storage"),
    content_type: v.optional(v.string()),
    size: v.optional(v.number()),
    expiry_date: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    const id = await ctx.db.insert("kyc_documents", {
      profile_id: profile._id,
      document_type: args.document_type,
      name: args.name,
      storage_id: args.storage_id,
      content_type: args.content_type,
      size: args.size,
      expiry_date: args.expiry_date,
      notes: args.notes,
      status: "PENDING",
    });
    await recomputeKycStatus(ctx, profile._id);
    const admins = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "ADMIN"))
      .collect();
    await Promise.all(
      admins.map((admin) =>
        ctx.db.insert("notifications", {
          user_id: admin._id,
          title: "KYC document submitted",
          message: `${profile.public_id ?? "A user"} uploaded ${args.name}.`,
          link: `/admin/users/${profile._id}`,
          read: false,
        }),
      ),
    );
    await logAction(ctx, {
      action: "kyc.submit",
      target_type: "kyc_document",
      target_id: id,
      after: { status: "PENDING" },
      details: {
        document_type: args.document_type,
        name: args.name,
        profile_id: profile._id,
        expiry_date: args.expiry_date,
      },
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("kyc_documents") },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found");
    if (doc.profile_id !== profile._id && profile.role !== "ADMIN") {
      throw new ConvexError("Forbidden");
    }
    if (doc.status === "APPROVED" && profile.role !== "ADMIN") {
      throw new ConvexError("Approved documents can only be removed by admins.");
    }
    if (doc.storage_id) {
      try {
        await ctx.storage.delete(doc.storage_id);
      } catch {
        // ignore missing storage object
      }
    }
    await ctx.db.delete(args.id);
    await recomputeKycStatus(ctx, doc.profile_id);
    await logAction(ctx, {
      action: "kyc.remove",
      target_type: "kyc_document",
      target_id: args.id,
      before: {
        status: doc.status,
        document_type: doc.document_type,
        name: doc.name,
      },
      details: { profile_id: doc.profile_id, removed_by_role: profile.role },
    });
  },
});

export const approve = mutation({
  args: { id: v.id("kyc_documents") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found");
    await ctx.db.patch(args.id, {
      status: "APPROVED",
      reviewed_by: admin._id,
      reviewed_at: Date.now(),
      rejection_reason: undefined,
    });
    await recomputeKycStatus(ctx, doc.profile_id);
    await ctx.db.insert("notifications", {
      user_id: doc.profile_id,
      title: "KYC document approved",
      message: doc.name,
      link: "/supplier/kyc",
      read: false,
    });
    await logAction(ctx, {
      action: "kyc.approve",
      target_type: "kyc_document",
      target_id: args.id,
      before: { status: doc.status },
      after: { status: "APPROVED" },
      details: {
        document_type: doc.document_type,
        name: doc.name,
        profile_id: doc.profile_id,
      },
    });
  },
});

export const reject = mutation({
  args: { id: v.id("kyc_documents"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found");
    await ctx.db.patch(args.id, {
      status: "REJECTED",
      reviewed_by: admin._id,
      reviewed_at: Date.now(),
      rejection_reason: args.reason,
    });
    await recomputeKycStatus(ctx, doc.profile_id);
    await ctx.db.insert("notifications", {
      user_id: doc.profile_id,
      title: "KYC document rejected",
      message: args.reason,
      link: "/supplier/kyc",
      read: false,
    });
    await logAction(ctx, {
      action: "kyc.reject",
      target_type: "kyc_document",
      target_id: args.id,
      before: { status: doc.status },
      after: { status: "REJECTED" },
      details: {
        document_type: doc.document_type,
        name: doc.name,
        profile_id: doc.profile_id,
        reason: args.reason,
      },
    });
  },
});

import { mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthenticatedProfile } from "./lib";

/**
 * Generic upload helpers used by image-list inputs (catalog, bundles, supplier
 * product requests). Auth-gated: only signed-in profiles can request URLs;
 * we don't restrict by role since suppliers, admins, and clients all need to
 * attach images in different flows.
 */
export const generateImageUploadUrl = mutation({
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    return ctx.storage.generateUploadUrl();
  },
});

/**
 * Convert a freshly-uploaded storage_id into a long-lived signed URL we can
 * persist on rows that store `images: string[]`. Returns null if the storage
 * object can't be resolved.
 */
export const resolveStorageUrl = mutation({
  args: { storage_id: v.id("_storage") },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    return ctx.storage.getUrl(args.storage_id);
  },
});

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Phase 1 catalog two-tier backfill.
 *
 * The legacy `products` table holds supplier-owned listings. The new model
 * splits identity (master_products) from price-and-availability (offers,
 * still stored in `products`). This migration:
 *
 *   1. Groups existing `products` rows by (sku || normalized name) +
 *      category_id (falling back to plain `category` when category_id is
 *      absent, keyed by a synthetic "legacy:<category>" string).
 *   2. Creates one `master_products` row per group with a single EACH pack
 *      type. The first product in the group seeds name/images/specs.
 *   3. Patches every product in the group with master_product_id and
 *      pack_type_code = "EACH".
 *
 * Run with:
 *   npx convex run catalogMigration:backfillMasterProducts
 *
 * Idempotent: rows already linked are skipped. Safe to re-run.
 */
export const backfillMasterProducts = internalMutation({
  args: {
    // Limit per run for very large datasets. Defaults to 1000.
    limit: v.optional(v.number()),
    // Pass an explicit admin profile id to credit creation to.
    admin_profile_id: v.optional(v.id("profiles")),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 1000;

    // Pick an admin to attribute master_products.created_by to.
    let adminId = args.admin_profile_id;
    if (!adminId) {
      const admin = await ctx.db
        .query("profiles")
        .withIndex("by_role", (q) => q.eq("role", "ADMIN"))
        .first();
      if (!admin) {
        throw new Error(
          "No admin profile found — pass admin_profile_id explicitly",
        );
      }
      adminId = admin._id;
    }

    const products = await ctx.db.query("products").take(limit);

    const normalize = (s: string) =>
      s.toLowerCase().replace(/\s+/g, " ").trim();

    type Bucket = {
      key: string;
      seed: (typeof products)[number];
      members: typeof products;
      category_id: typeof products[number]["category_id"];
    };

    const buckets = new Map<string, Bucket>();
    let alreadyLinked = 0;
    let skippedNoCategory = 0;

    for (const p of products) {
      if (p.master_product_id) {
        alreadyLinked++;
        continue;
      }
      const categoryKey = p.category_id
        ? `cat:${p.category_id}`
        : p.category
        ? `legacy:${normalize(p.category)}`
        : null;
      if (!categoryKey) {
        skippedNoCategory++;
        continue;
      }
      const identityKey = p.sku ? `sku:${normalize(p.sku)}` : `name:${normalize(p.name)}`;
      const key = `${categoryKey}|${identityKey}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.members.push(p);
      } else {
        buckets.set(key, {
          key,
          seed: p,
          members: [p],
          category_id: p.category_id,
        });
      }
    }

    let mastersCreated = 0;
    let offersLinked = 0;

    for (const bucket of buckets.values()) {
      if (!bucket.category_id) {
        // Legacy plain-text category with no category_id link — can't safely
        // create a master here without a category FK. Leave for manual fix.
        skippedNoCategory += bucket.members.length;
        continue;
      }
      const seed = bucket.seed;
      const masterId = await ctx.db.insert("master_products", {
        name_en: seed.name,
        name_ar: seed.name, // best-effort: copy until admin fills Arabic
        description_en: seed.description,
        description_ar: seed.description,
        category_id: bucket.category_id,
        sku: seed.sku,
        brand: seed.brand,
        images: seed.images,
        specs: undefined,
        pack_types: [
          {
            code: "EACH",
            label_en: "Each",
            label_ar: "حبة",
            base_qty: 1,
          },
        ],
        status: "ACTIVE",
        created_by: adminId!,
        updated_at: Date.now(),
      });
      mastersCreated++;

      for (const member of bucket.members) {
        await ctx.db.patch(member._id, {
          master_product_id: masterId,
          pack_type_code: "EACH",
        });
        offersLinked++;
      }
    }

    return {
      products_scanned: products.length,
      already_linked: alreadyLinked,
      skipped_no_category: skippedNoCategory,
      masters_created: mastersCreated,
      offers_linked: offersLinked,
    };
  },
});

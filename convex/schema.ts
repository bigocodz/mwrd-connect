import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  pending_users: defineTable({
    email: v.string(),
    role: v.union(
      v.literal("CLIENT"),
      v.literal("SUPPLIER"),
      v.literal("AUDITOR"),
    ),
    company_name: v.string(),
    created_at: v.number(),
    // Client team-member invites: when an org owner invites a colleague,
    // these fields steer the auth callback to attach the new profile to
    // the parent org with the right team_role + display info.
    parent_client_id: v.optional(v.id("profiles")),
    team_role: v.optional(
      v.union(
        v.literal("ADMIN"),
        v.literal("BUYER"),
        v.literal("APPROVER"),
        v.literal("VIEWER"),
      ),
    ),
    full_name: v.optional(v.string()),
    job_title: v.optional(v.string()),
    phone: v.optional(v.string()),
  }).index("by_email", ["email"]),

  profiles: defineTable({
    userId: v.id("users"),
    // Roles. AUDITOR (PRD §13.4) is read-only — same admin surfaces as
    // ADMIN but every mutation rejects them via requireAdmin().
    role: v.union(
      v.literal("CLIENT"),
      v.literal("SUPPLIER"),
      v.literal("ADMIN"),
      v.literal("AUDITOR"),
    ),
    status: v.union(
      v.literal("PENDING"),
      v.literal("ACTIVE"),
      v.literal("REJECTED"),
      v.literal("REQUIRES_ATTENTION"),
      v.literal("DEACTIVATED"),
      v.literal("FROZEN"),
    ),
    kyc_status: v.union(
      v.literal("INCOMPLETE"),
      v.literal("IN_REVIEW"),
      v.literal("VERIFIED"),
      v.literal("REJECTED"),
    ),
    company_name: v.optional(v.string()),
    public_id: v.optional(v.string()),
    credit_limit: v.optional(v.number()),
    current_balance: v.optional(v.number()),
    payment_terms: v.optional(v.union(v.literal("net_30"), v.literal("prepaid"))),
    client_margin: v.optional(v.number()),
    frozen_at: v.optional(v.number()),
    freeze_reason: v.optional(v.string()),
    frozen_by: v.optional(v.id("profiles")),
    must_change_password: v.optional(v.boolean()),
    is_preferred: v.optional(v.boolean()),
    preferred_note: v.optional(v.string()),
    preferred_at: v.optional(v.number()),
    preferred_by: v.optional(v.id("profiles")),
    // Wafeq integration (PRD §8.1) — Wafeq Contact ID for this org. Populated
    // on first invoice submission and reused thereafter.
    wafeq_contact_id: v.optional(v.string()),
    wafeq_contact_synced_at: v.optional(v.number()),
    // Legal entity fields (PRD §3.2.1, §11.1, §8.3). These mirror the
    // Organization model from the PRD onto the existing profiles table to
    // avoid a disruptive split today. Bilingual legal name takes precedence
    // over `company_name` for invoices and tax documents.
    legal_name_ar: v.optional(v.string()),
    legal_name_en: v.optional(v.string()),
    cr_number: v.optional(v.string()), // Saudi Commercial Registration
    vat_number: v.optional(v.string()), // VAT registration (15-digit)
    national_address: v.optional(
      v.object({
        building_number: v.optional(v.string()),
        street: v.optional(v.string()),
        district: v.optional(v.string()),
        city: v.optional(v.string()),
        postal_code: v.optional(v.string()),
        additional_number: v.optional(v.string()),
      }),
    ),
    // Banking (suppliers — PRD §5.3.2). Verified via bank-letter at KYC.
    iban: v.optional(v.string()),
    bank_name: v.optional(v.string()),
    bank_account_holder: v.optional(v.string()),
    // Wathq verification trail (PRD §8.3) — populated by Wathq lookup action
    // when implemented; for now manual edits are allowed.
    wathq_status: v.optional(
      v.union(
        v.literal("UNVERIFIED"),
        v.literal("VERIFIED"),
        v.literal("MISMATCH"),
        v.literal("EXPIRED"),
      ),
    ),
    wathq_verified_at: v.optional(v.number()),
    wathq_verified_legal_name: v.optional(v.string()),
    // SPL (Saudi Post) National Address validation trail (PRD §8.3).
    spl_status: v.optional(
      v.union(
        v.literal("UNVERIFIED"),
        v.literal("VERIFIED"),
        v.literal("MISMATCH"),
        v.literal("NOT_FOUND"),
      ),
    ),
    spl_verified_at: v.optional(v.number()),
    spl_short_address: v.optional(v.string()),
    // Server-side language preference (PRD §9.1) — drives per-user
    // notification rendering. Defaults to Arabic when unset.
    preferred_language: v.optional(v.union(v.literal("ar"), v.literal("en"))),
    // Show Hijri dates alongside Gregorian in the UI (PRD §8.4). Defaults
    // to true for Saudi-first profiles.
    show_hijri: v.optional(v.boolean()),
    // Company stamp image (PRD §6.5) — one per client, rendered on PO docs.
    // Suppliers don't need stamps in v1.
    stamp_storage_id: v.optional(v.id("_storage")),
    stamp_uploaded_at: v.optional(v.number()),
    // Personal signature image (PRD §6.6.3) — used when the user signs an
    // approval step. Snapshotted into the step decision at sign time so
    // historical artifacts stay correct if the user replaces it later.
    signature_storage_id: v.optional(v.id("_storage")),
    signature_uploaded_at: v.optional(v.number()),
    // Client team-member model. The first profile created for an account is
    // the OWNER; additional team members are profiles whose parent_client_id
    // points at the owner's _id. All org-scoped data (RFQs, orders, cost
    // centers, etc.) keys on the owner profile, so every team member sees
    // the same org. team_role gates which actions a member can perform on
    // shared org data.
    parent_client_id: v.optional(v.id("profiles")),
    team_role: v.optional(
      v.union(
        v.literal("OWNER"),     // org account holder; full control
        v.literal("ADMIN"),     // can manage team + every org action
        v.literal("BUYER"),     // can browse, create RFQs, place orders
        v.literal("APPROVER"),  // sits in the approval tree; reviews + approves
        v.literal("VIEWER"),    // read-only across org data
      ),
    ),
    // Personal display fields for team members (the OWNER reuses
    // company_name / legal_name etc.).
    full_name: v.optional(v.string()),
    job_title: v.optional(v.string()),
    phone: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_role", ["role"])
    .index("by_public_id", ["public_id"])
    .index("by_parent_client", ["parent_client_id"]),

  // Master Catalog (Phase 1 of catalog two-tier refactor). Admin-curated,
  // single source of truth for product identity (name, specs, images, pack
  // types). Suppliers attach Offers (rows in `products`) to a master_product
  // and price/availability per pack type.
  master_products: defineTable({
    name_en: v.string(),
    name_ar: v.string(),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    category_id: v.id("categories"),
    sku: v.optional(v.string()),       // canonical admin SKU
    brand: v.optional(v.string()),
    images: v.array(v.string()),
    specs: v.optional(v.any()),        // structured attributes (free-form JSON)
    // Pack types (PRD: per-pack-type cost prices). Each entry is one orderable
    // unit — e.g. {code:"EACH", base_qty:1}, {code:"CASE", base_qty:24}.
    pack_types: v.array(
      v.object({
        code: v.string(),              // EACH | CASE | BULK | <custom>
        label_en: v.string(),
        label_ar: v.string(),
        base_qty: v.number(),          // units of the smallest sellable unit
        uom: v.optional(v.string()),   // PCS, KG, BOX, ...
      }),
    ),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("ACTIVE"),
      v.literal("DEPRECATED"),
    ),
    display_order: v.optional(v.number()),
    created_by: v.id("profiles"),      // admin who created
    updated_at: v.optional(v.number()),
    deprecated_at: v.optional(v.number()),
    deprecation_reason: v.optional(v.string()),
  })
    .index("by_category", ["category_id"])
    .index("by_status", ["status"])
    .index("by_sku", ["sku"]),

  // Bundles (Phase 3) — admin-curated kits of master products. One-click
  // add expands into N rfq_items at the configured pack_type + quantity.
  bundles: defineTable({
    name_en: v.string(),
    name_ar: v.string(),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    category_id: v.optional(v.id("categories")),
    image_url: v.optional(v.string()),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("ACTIVE"),
      v.literal("ARCHIVED"),
    ),
    display_order: v.optional(v.number()),
    created_by: v.id("profiles"),
    updated_at: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_category", ["category_id"]),

  bundle_items: defineTable({
    bundle_id: v.id("bundles"),
    master_product_id: v.id("master_products"),
    pack_type_code: v.string(),
    quantity: v.number(),
    display_order: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_bundle", ["bundle_id"])
    .index("by_master_product", ["master_product_id"]),

  // Supplier proposals to add new master products. Approval creates a row
  // in `master_products` and stamps `created_master_product_id` here.
  product_addition_requests: defineTable({
    supplier_id: v.id("profiles"),
    proposed_name_en: v.string(),
    proposed_name_ar: v.string(),
    proposed_description_en: v.optional(v.string()),
    proposed_description_ar: v.optional(v.string()),
    category_id: v.id("categories"),
    proposed_sku: v.optional(v.string()),
    proposed_brand: v.optional(v.string()),
    images: v.array(v.string()),
    specs: v.optional(v.any()),
    proposed_pack_types: v.array(
      v.object({
        code: v.string(),
        label_en: v.string(),
        label_ar: v.string(),
        base_qty: v.number(),
        uom: v.optional(v.string()),
      }),
    ),
    justification: v.optional(v.string()),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
    ),
    admin_notes: v.optional(v.string()),
    rejection_reason: v.optional(v.string()),
    decided_by: v.optional(v.id("profiles")),
    decided_at: v.optional(v.number()),
    created_master_product_id: v.optional(v.id("master_products")),
  })
    .index("by_supplier", ["supplier_id"])
    .index("by_status", ["status"]),

  // Supplier Offers — current `products` table re-purposed into the offer
  // tier of the two-tier catalog. Existing rows continue to function in
  // legacy mode (master_product_id null). New offers reference a
  // master_product and a pack_type from that master.
  products: defineTable({
    supplier_id: v.id("profiles"),
    name: v.string(),
    description: v.optional(v.string()),
    // Legacy plain-text category (kept for backward compat with existing rows).
    // New code should prefer category_id pointing at the master tree.
    category: v.string(),
    subcategory: v.optional(v.string()),
    // Master-tree references (PRD §5.4) — optional during migration.
    category_id: v.optional(v.id("categories")),
    subcategory_id: v.optional(v.id("categories")),
    // Two-tier link (Phase 1). Optional during migration; populated for any
    // offer attached to a master product. pack_type_code identifies which
    // pack from master_products.pack_types this offer prices.
    master_product_id: v.optional(v.id("master_products")),
    pack_type_code: v.optional(v.string()),
    sku: v.optional(v.string()),
    brand: v.optional(v.string()),
    images: v.array(v.string()),
    cost_price: v.number(),
    lead_time_days: v.number(),
    // Minimum order quantity (PRD: per-offer MOQ). Optional for back-compat.
    moq: v.optional(v.number()),
    // Auto-quote engine (Phase 2 surfaces — fields land here in Phase 1 so
    // suppliers can set the toggle now).
    auto_quote: v.optional(v.boolean()),
    review_window: v.optional(
      v.union(
        v.literal("INSTANT"),
        v.literal("MIN_30"),
        v.literal("HR_2"),
      ),
    ),
    availability_status: v.union(
      v.literal("AVAILABLE"),
      v.literal("LIMITED_STOCK"),
      v.literal("OUT_OF_STOCK"),
    ),
    approval_status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
    ),
    rejection_reason: v.optional(v.string()),
    updated_at: v.optional(v.number()),
    stock_quantity: v.optional(v.number()),
    low_stock_threshold: v.optional(v.number()),
    stock_updated_at: v.optional(v.number()),
  })
    .index("by_supplier", ["supplier_id"])
    .index("by_approval", ["approval_status"])
    .index("by_category_id", ["category_id"])
    .index("by_master_product", ["master_product_id"])
    .index("by_master_and_supplier", ["master_product_id", "supplier_id"]),

  rfqs: defineTable({
    client_id: v.id("profiles"),
    status: v.union(v.literal("OPEN"), v.literal("QUOTED"), v.literal("CLOSED")),
    category: v.optional(v.string()),
    template_key: v.optional(v.string()),
    expiry_date: v.optional(v.string()),
    required_by: v.optional(v.string()),
    delivery_location: v.optional(v.string()),
    notes: v.optional(v.string()),
    cost_center_id: v.optional(v.id("cost_centers")),
    branch_id: v.optional(v.id("branches")),
    department_id: v.optional(v.id("departments")),
  })
    .index("by_client", ["client_id"])
    .index("by_status", ["status"]),

  rfq_items: defineTable({
    rfq_id: v.id("rfqs"),
    // Legacy direct supplier-product reference (back-compat). New RFQs should
    // populate master_product_id + pack_type_code instead.
    product_id: v.optional(v.id("products")),
    master_product_id: v.optional(v.id("master_products")),
    pack_type_code: v.optional(v.string()),
    custom_item_description: v.optional(v.string()),
    quantity: v.number(),
    flexibility: v.union(
      v.literal("EXACT_MATCH"),
      v.literal("OPEN_TO_EQUIVALENT"),
      v.literal("OPEN_TO_ALTERNATIVES"),
    ),
    special_notes: v.optional(v.string()),
  }).index("by_rfq", ["rfq_id"]),

  rfq_supplier_assignments: defineTable({
    rfq_id: v.id("rfqs"),
    supplier_id: v.id("profiles"),
    assigned_at: v.optional(v.number()),
  })
    .index("by_rfq", ["rfq_id"])
    .index("by_supplier", ["supplier_id"]),

  quotes: defineTable({
    rfq_id: v.id("rfqs"),
    supplier_id: v.id("profiles"),
    status: v.union(
      v.literal("AUTO_DRAFT"),          // generated by auto-quote engine, still
                                        // in supplier review window. Not yet
                                        // visible to client or admin.
      v.literal("PENDING_ADMIN"),
      v.literal("SENT_TO_CLIENT"),
      v.literal("CLIENT_REVISION_REQUESTED"),
      v.literal("SUPPLIER_REVISION_REQUESTED"),
      v.literal("REVISION_SUBMITTED"),
      v.literal("ACCEPTED"),
      v.literal("REJECTED"),
    ),
    // Auto-quote engine (Phase 2). `source` distinguishes a draft generated by
    // the engine from a supplier-typed manual quote so review queues, audit
    // logs, and notifications can describe the right user journey.
    source: v.optional(
      v.union(
        v.literal("MANUAL"),
        v.literal("AUTO_DRAFT"),
        v.literal("AUTO_SENT"),
      ),
    ),
    // When status=AUTO_DRAFT, the scheduled flip to PENDING_ADMIN/SENT happens
    // at this timestamp unless the supplier sends/edits/declines first.
    review_until: v.optional(v.number()),
    reviewed_by: v.optional(v.id("profiles")),
    reviewed_at: v.optional(v.number()),
    supplier_notes: v.optional(v.string()),
    revision_count: v.optional(v.number()),
    // Document engine cross-stamp (PRD §10.3)
    latest_document_id: v.optional(v.id("generated_documents")),
    latest_document_hash: v.optional(v.string()),
    latest_document_at: v.optional(v.number()),
  })
    .index("by_rfq", ["rfq_id"])
    .index("by_supplier", ["supplier_id"])
    .index("by_status", ["status"])
    .index("by_status_and_review_until", ["status", "review_until"]),

  quote_items: defineTable({
    quote_id: v.id("quotes"),
    rfq_item_id: v.id("rfq_items"),
    is_quoted: v.boolean(),
    // supplier_product_id is the offer the supplier is pricing. Two-tier
    // refactor (Phase 1): also stamp master_product_id + pack_type_code so
    // line-item comparison and award flows can group across suppliers.
    supplier_product_id: v.optional(v.id("products")),
    alternative_product_id: v.optional(v.id("products")),
    master_product_id: v.optional(v.id("master_products")),
    pack_type_code: v.optional(v.string()),
    cost_price: v.optional(v.number()),
    lead_time_days: v.optional(v.number()),
    margin_percent: v.optional(v.number()),
    final_price_before_vat: v.optional(v.number()),
    final_price_with_vat: v.optional(v.number()),
  }).index("by_quote", ["quote_id"]),

  quote_revision_events: defineTable({
    quote_id: v.id("quotes"),
    rfq_id: v.id("rfqs"),
    actor_id: v.id("profiles"),
    actor_role: v.union(v.literal("CLIENT"), v.literal("SUPPLIER"), v.literal("ADMIN")),
    event_type: v.union(
      v.literal("CLIENT_REQUESTED"),
      v.literal("ADMIN_REQUESTED"),
      v.literal("SUPPLIER_SUBMITTED"),
      v.literal("ADMIN_SENT_TO_CLIENT"),
    ),
    message: v.string(),
    created_at: v.number(),
  })
    .index("by_quote", ["quote_id"])
    .index("by_rfq", ["rfq_id"]),

  procurement_attachments: defineTable({
    rfq_id: v.optional(v.id("rfqs")),
    quote_id: v.optional(v.id("quotes")),
    uploaded_by: v.id("profiles"),
    document_type: v.union(
      v.literal("SPECIFICATION"),
      v.literal("PURCHASE_POLICY"),
      v.literal("SUPPORTING_DOCUMENT"),
      v.literal("SUPPLIER_QUOTATION"),
      v.literal("COMMERCIAL_TERMS"),
      v.literal("OTHER"),
    ),
    name: v.string(),
    url: v.optional(v.string()),
    storage_id: v.optional(v.id("_storage")),
    content_type: v.optional(v.string()),
    size: v.optional(v.number()),
    notes: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_rfq", ["rfq_id"])
    .index("by_quote", ["quote_id"]),

  // Internal comments threads on procurement entities (PRD §10.4).
  // Visibility enum is the anonymity invariant gate: SUPPLIER_THREAD never
  // leaks client identity, CLIENT_THREAD never leaks supplier identity,
  // INTERNAL is admin-only.
  comments: defineTable({
    target_type: v.union(
      v.literal("rfq"),
      v.literal("quote"),
      v.literal("order"),
      v.literal("client_invoice"),
      v.literal("dispute"),
    ),
    target_id: v.string(), // polymorphic — Convex IDs are strings
    visibility: v.union(
      v.literal("INTERNAL"),         // admin-only
      v.literal("CLIENT_THREAD"),    // admin + the client party
      v.literal("SUPPLIER_THREAD"),  // admin + the supplier party
    ),
    body: v.string(),
    author_profile_id: v.id("profiles"),
    author_role: v.union(
      v.literal("CLIENT"),
      v.literal("SUPPLIER"),
      v.literal("ADMIN"),
    ),
    mentioned_profile_ids: v.optional(v.array(v.id("profiles"))),
  })
    .index("by_target", ["target_type", "target_id"])
    .index("by_author", ["author_profile_id"]),

  // Cross-channel dispatch log (PRD §10.1) — every send attempt with the
  // provider response. Append-only; lets ops debug "why didn't user X get
  // the email?" without rerunning the world.
  notification_dispatch_log: defineTable({
    notification_id: v.id("notifications"),
    user_id: v.id("profiles"),
    channel: v.union(
      v.literal("EMAIL"),
      v.literal("SMS"),
      v.literal("WHATSAPP"),
      v.literal("WEBHOOK"),
    ),
    status: v.union(
      v.literal("SUCCESS"),
      v.literal("FAILED"),
      v.literal("SKIPPED"),  // user opted out / channel not configured
      v.literal("MOCK"),     // dev mode, no provider call
    ),
    target: v.optional(v.string()),  // email address / phone / webhook URL
    error_message: v.optional(v.string()),
    duration_ms: v.optional(v.number()),
  })
    .index("by_notification", ["notification_id"])
    .index("by_user", ["user_id"])
    .index("by_status", ["status"]),

  notifications: defineTable({
    user_id: v.id("profiles"),
    title: v.string(),
    message: v.optional(v.string()),
    read: v.boolean(),
    link: v.optional(v.string()),
    // Cross-channel dispatch metadata (PRD §10.1, §10.2). Optional so the
    // existing legacy in-app inserts continue to work unchanged.
    event_type: v.optional(v.string()),
    dispatched_at: v.optional(v.number()),
    dispatched_channels: v.optional(v.array(v.string())),
  }).index("by_user", ["user_id"]),

  // Per-user-per-event channel opt-in/out (PRD §10.2 — "each event is
  // independently controllable per user"). Missing rows default to "send
  // on every channel that's wired" so existing behavior doesn't break.
  notification_channel_prefs: defineTable({
    user_id: v.id("profiles"),
    event_type: v.string(),
    in_app: v.optional(v.boolean()),
    email: v.optional(v.boolean()),
    sms: v.optional(v.boolean()),
    whatsapp: v.optional(v.boolean()),
  })
    .index("by_user", ["user_id"])
    .index("by_user_and_event", ["user_id", "event_type"]),

  // Bilingual templates for cross-channel notifications (PRD §10.2).
  // Keyed by event_type, rendered through the same handlebars-lite engine
  // as document_templates. Subject + body are stored separately so each
  // channel (email, SMS) can pick the right field.
  notification_templates: defineTable({
    event_type: v.string(),         // e.g. "invoice.issued", "approval.required"
    subject_ar: v.string(),
    subject_en: v.string(),
    body_ar: v.string(),
    body_en: v.string(),
    is_default: v.boolean(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index("by_event_type", ["event_type"]),

  payments: defineTable({
    client_id: v.id("profiles"),
    order_id: v.optional(v.string()),
    amount: v.number(),
    payment_method: v.union(
      v.literal("BANK_TRANSFER"),
      v.literal("MADA"),
      v.literal("VISA_MASTERCARD"),
      v.literal("APPLE_PAY"),
      v.literal("STC_PAY"),
    ),
    status: v.union(v.literal("PENDING"), v.literal("PAID"), v.literal("DISCREPANCY")),
    bank_reference: v.optional(v.string()),
    confirmed_by: v.optional(v.id("profiles")),
    confirmed_at: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_client", ["client_id"])
    .index("by_status", ["status"]),

  payment_audit_logs: defineTable({
    payment_id: v.id("payments"),
    admin_id: v.id("profiles"),
    action: v.string(),
    details: v.optional(v.any()),
  }).index("by_payment", ["payment_id"]),

  supplier_payouts: defineTable({
    supplier_id: v.id("profiles"),
    order_id: v.optional(v.string()),
    amount: v.number(),
    payment_method: v.union(v.literal("BANK_TRANSFER"), v.literal("CHECK")),
    status: v.union(v.literal("PENDING"), v.literal("PAID")),
    bank_reference: v.optional(v.string()),
    recorded_by: v.id("profiles"),
    notes: v.optional(v.string()),
    paid_at: v.optional(v.number()),
  })
    .index("by_supplier", ["supplier_id"])
    .index("by_status", ["status"]),

  margin_settings: defineTable({
    type: v.union(v.literal("GLOBAL"), v.literal("CATEGORY"), v.literal("CLIENT")),
    category: v.optional(v.string()),
    client_id: v.optional(v.id("profiles")),
    margin_percent: v.number(),
  }).index("by_type", ["type"]),

  reviews: defineTable({
    client_id: v.id("profiles"),
    supplier_id: v.id("profiles"),
    order_id: v.optional(v.string()),
    rating: v.number(),
    comment: v.optional(v.string()),
  })
    .index("by_supplier", ["supplier_id"])
    .index("by_client", ["client_id"]),

  admin_audit_log: defineTable({
    admin_id: v.id("profiles"),
    action: v.string(),
    target_user_id: v.optional(v.id("profiles")),
    target_type: v.optional(v.string()),
    target_id: v.optional(v.string()),
    details: v.optional(v.any()),
  }).index("by_admin", ["admin_id"]),

  // Client Purchase Orders (Phase 4 — dual PO). One CPO is created per
  // client award decision and groups all the supplier-side orders that came
  // out of that award. transaction_ref is the human-readable id that appears
  // on every linked SPO (the legacy `orders` table) so docs reconcile.
  client_purchase_orders: defineTable({
    rfq_id: v.id("rfqs"),
    client_id: v.id("profiles"),
    transaction_ref: v.string(),
    award_mode: v.union(
      v.literal("FULL_BASKET"),  // single supplier won every line
      v.literal("PER_ITEM"),     // lines split across suppliers
    ),
    status: v.union(
      v.literal("OPEN"),
      v.literal("PARTIALLY_FULFILLED"),
      v.literal("FULFILLED"),
      v.literal("CANCELLED"),
    ),
    total_before_vat: v.number(),
    total_with_vat: v.number(),
    delivery_location: v.optional(v.string()),
    required_by: v.optional(v.string()),
    notes: v.optional(v.string()),
    cancelled_at: v.optional(v.number()),
    cancelled_reason: v.optional(v.string()),
    latest_document_id: v.optional(v.id("generated_documents")),
    latest_document_hash: v.optional(v.string()),
    latest_document_at: v.optional(v.number()),
  })
    .index("by_client", ["client_id"])
    .index("by_rfq", ["rfq_id"])
    .index("by_transaction_ref", ["transaction_ref"]),

  orders: defineTable({
    rfq_id: v.id("rfqs"),
    quote_id: v.id("quotes"),
    client_id: v.id("profiles"),
    supplier_id: v.id("profiles"),
    // Phase 4 — dual PO link. Optional during migration; set on every order
    // created via the new createFromAward path. Legacy single-quote orders
    // have these unset and continue to behave as before.
    client_po_id: v.optional(v.id("client_purchase_orders")),
    transaction_ref: v.optional(v.string()),
    status: v.union(
      v.literal("PENDING_CONFIRMATION"),
      v.literal("CONFIRMED"),
      v.literal("PREPARING"),
      v.literal("DISPATCHED"),
      v.literal("DELIVERED"),
      v.literal("COMPLETED"),
      v.literal("CANCELLED"),
    ),
    total_before_vat: v.number(),
    total_with_vat: v.number(),
    delivery_location: v.optional(v.string()),
    required_by: v.optional(v.string()),
    notes: v.optional(v.string()),
    confirmed_at: v.optional(v.number()),
    preparing_at: v.optional(v.number()),
    dispatched_at: v.optional(v.number()),
    delivered_at: v.optional(v.number()),
    completed_at: v.optional(v.number()),
    cancelled_at: v.optional(v.number()),
    cancelled_reason: v.optional(v.string()),
    carrier: v.optional(v.string()),
    tracking_number: v.optional(v.string()),
    tracking_url: v.optional(v.string()),
    estimated_delivery_at: v.optional(v.number()),
    pod_storage_id: v.optional(v.id("_storage")),
    pod_name: v.optional(v.string()),
    pod_uploaded_at: v.optional(v.number()),
    dispute_status: v.optional(
      v.union(v.literal("OPEN"), v.literal("RESOLVED"), v.literal("REJECTED")),
    ),
    dispute_reason: v.optional(v.string()),
    dispute_opened_by: v.optional(v.id("profiles")),
    dispute_opened_at: v.optional(v.number()),
    dispute_resolution: v.optional(v.string()),
    dispute_resolved_by: v.optional(v.id("profiles")),
    dispute_resolved_at: v.optional(v.number()),
    // Document engine cross-stamp (PRD §10.3) — last generated artifact +
    // its SHA-256 so tampering on the artifact is visible at the source.
    latest_document_id: v.optional(v.id("generated_documents")),
    latest_document_hash: v.optional(v.string()),
    latest_document_at: v.optional(v.number()),
  })
    .index("by_client", ["client_id"])
    .index("by_supplier", ["supplier_id"])
    .index("by_status", ["status"])
    .index("by_quote", ["quote_id"])
    .index("by_dispute_status", ["dispute_status"])
    .index("by_client_po", ["client_po_id"])
    .index("by_transaction_ref", ["transaction_ref"]),

  // Delivery Notes (PRD: supplier-issued shipment record). Distinct from
  // Goods Receipt Notes — a DN is what the SUPPLIER ships; a GRN is what
  // the CLIENT receives. Three-way match compares PO × DN × GRN × INV.
  delivery_notes: defineTable({
    order_id: v.id("orders"),
    supplier_id: v.id("profiles"),
    client_id: v.id("profiles"),         // denormalized for client lookups
    dn_number: v.string(),               // MWRD-controlled sequential
    issued_at: v.number(),
    issued_by: v.id("profiles"),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("ISSUED"),                // supplier finalized; client can receive against it
      v.literal("CANCELLED"),
    ),
    carrier: v.optional(v.string()),
    tracking_number: v.optional(v.string()),
    expected_delivery_at: v.optional(v.number()),
    notes: v.optional(v.string()),
    photo_storage_ids: v.array(v.id("_storage")),
    cancelled_at: v.optional(v.number()),
    cancelled_reason: v.optional(v.string()),
    latest_document_id: v.optional(v.id("generated_documents")),
    latest_document_hash: v.optional(v.string()),
    latest_document_at: v.optional(v.number()),
  })
    .index("by_order", ["order_id"])
    .index("by_supplier", ["supplier_id"])
    .index("by_client", ["client_id"])
    .index("by_status", ["status"]),

  // Per-line shipped quantities on a delivery_note. Three-way match reads
  // these to compare ordered → shipped → received → invoiced.
  delivery_note_lines: defineTable({
    delivery_note_id: v.id("delivery_notes"),
    order_id: v.id("orders"),
    quote_item_id: v.optional(v.id("quote_items")),
    rfq_item_id: v.optional(v.id("rfq_items")),
    description: v.string(),
    ordered_qty: v.number(),
    shipped_qty: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_delivery_note", ["delivery_note_id"])
    .index("by_order", ["order_id"]),

  // Goods Receipt Notes (PRD §6.10) — first-class receiving record per
  // delivery. Multiple GRNs per order to support partial deliveries.
  // Each line records what was actually received vs what was ordered, with
  // condition flags for the discrepancy flow.
  goods_receipt_notes: defineTable({
    order_id: v.id("orders"),
    client_id: v.id("profiles"),     // denormalized for client-side queries
    supplier_id: v.id("profiles"),   // denormalized for admin lookups
    grn_number: v.string(),          // MWRD-controlled sequential
    received_at: v.number(),
    received_by: v.id("profiles"),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("CONFIRMED"),        // happy path — fully accepted
      v.literal("DISPUTED"),         // has at least one discrepancy line
      v.literal("CLOSED"),           // admin-resolved, terminal
    ),
    has_discrepancy: v.boolean(),
    discrepancy_summary: v.optional(v.string()),
    notes: v.optional(v.string()),
    photo_storage_ids: v.array(v.id("_storage")),
    // Resolution trail when admin closes a disputed GRN
    resolution: v.optional(v.string()),
    resolved_by: v.optional(v.id("profiles")),
    resolved_at: v.optional(v.number()),
    // Document engine cross-stamp (PRD §10.3)
    latest_document_id: v.optional(v.id("generated_documents")),
    latest_document_hash: v.optional(v.string()),
    latest_document_at: v.optional(v.number()),
  })
    .index("by_order", ["order_id"])
    .index("by_client", ["client_id"])
    .index("by_supplier", ["supplier_id"])
    .index("by_status", ["status"]),

  // Per-line receiving record. References the original quote_item so we can
  // reconcile against ordered quantities for the three-way match.
  grn_lines: defineTable({
    grn_id: v.id("goods_receipt_notes"),
    order_id: v.id("orders"),
    quote_item_id: v.optional(v.id("quote_items")),
    rfq_item_id: v.optional(v.id("rfq_items")),
    description: v.string(),
    ordered_qty: v.number(),
    received_qty: v.number(),
    condition: v.union(
      v.literal("GOOD"),
      v.literal("DAMAGED"),
      v.literal("SHORT_SHIPPED"),
      v.literal("WRONG_ITEM"),
    ),
    notes: v.optional(v.string()),
  })
    .index("by_grn", ["grn_id"])
    .index("by_order", ["order_id"]),

  order_events: defineTable({
    order_id: v.id("orders"),
    actor_id: v.id("profiles"),
    actor_role: v.union(v.literal("CLIENT"), v.literal("SUPPLIER"), v.literal("ADMIN")),
    event_type: v.union(
      v.literal("CREATED"),
      v.literal("CONFIRMED"),
      v.literal("PREPARING"),
      v.literal("DISPATCHED"),
      v.literal("DELIVERED"),
      v.literal("COMPLETED"),
      v.literal("CANCELLED"),
      v.literal("NOTE"),
      v.literal("TRACKING_UPDATED"),
      v.literal("POD_UPLOADED"),
      v.literal("DISPUTE_OPENED"),
      v.literal("DISPUTE_RESOLVED"),
      v.literal("DISPUTE_REJECTED"),
    ),
    message: v.optional(v.string()),
    created_at: v.number(),
  }).index("by_order", ["order_id"]),

  client_catalog_entries: defineTable({
    client_id: v.id("profiles"),
    product_id: v.id("products"),
    alias: v.optional(v.string()),
    notes: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
    hidden: v.optional(v.boolean()),
    cart_quantity: v.optional(v.number()),
    // Saved Cart 7-day expiry (PRD: RFQ drafts have a 7-day TTL). Set on every
    // cart-touch (add / setQty), null for non-cart catalog entries. Sweep cron
    // zeroes cart_quantity on entries past expiry without deleting the entry
    // (we keep favorites/notes intact).
    cart_expires_at: v.optional(v.number()),
  })
    .index("by_client", ["client_id"])
    .index("by_client_product", ["client_id", "product_id"])
    .index("by_cart_expires", ["cart_expires_at"]),

  rfq_schedules: defineTable({
    client_id: v.id("profiles"),
    name: v.string(),
    cadence: v.union(
      v.literal("WEEKLY"),
      v.literal("BIWEEKLY"),
      v.literal("MONTHLY"),
      v.literal("QUARTERLY"),
    ),
    next_run_at: v.number(),
    last_run_at: v.optional(v.number()),
    active: v.boolean(),
    template: v.object({
      category: v.optional(v.string()),
      template_key: v.optional(v.string()),
      notes: v.optional(v.string()),
      delivery_location: v.optional(v.string()),
      lead_time_days: v.number(),
      cost_center_id: v.optional(v.id("cost_centers")),
      branch_id: v.optional(v.id("branches")),
      department_id: v.optional(v.id("departments")),
      items: v.array(
        v.object({
          product_id: v.optional(v.id("products")),
          custom_item_description: v.optional(v.string()),
          quantity: v.number(),
          flexibility: v.union(
            v.literal("EXACT_MATCH"),
            v.literal("OPEN_TO_EQUIVALENT"),
            v.literal("OPEN_TO_ALTERNATIVES"),
          ),
          special_notes: v.optional(v.string()),
        }),
      ),
    }),
  })
    .index("by_client", ["client_id"])
    .index("by_active_next", ["active", "next_run_at"]),

  approval_rules: defineTable({
    client_id: v.id("profiles"),
    name: v.string(),
    min_amount: v.number(),
    max_amount: v.optional(v.number()),
    category: v.optional(v.string()),
    cost_center_id: v.optional(v.id("cost_centers")),
    branch_id: v.optional(v.id("branches")),
    department_id: v.optional(v.id("departments")),
    enabled: v.boolean(),
    notes: v.optional(v.string()),
    // PRD §6.6 — quotes whose total ≤ threshold skip approval entirely.
    // null/undefined means "no shortcut, always require approval if matched".
    auto_approve_threshold: v.optional(v.number()),
    // Hours after which a pending step pings escalation. Optional.
    escalation_hours: v.optional(v.number()),
  }).index("by_client", ["client_id"]),

  // Workflow template steps for an approval_rule (PRD §6.6.1).
  // Steps with the same parallel_group must all approve before the next
  // group activates (parallel branches). Sequential = each step in its own
  // group. approver_admin_id null means "any admin in the queue".
  approval_steps: defineTable({
    rule_id: v.id("approval_rules"),
    step_index: v.number(), // 0-based ordering across the whole workflow
    parallel_group: v.number(), // groups with the same number run in parallel
    label: v.string(),
    approver_admin_id: v.optional(v.id("profiles")),
  })
    .index("by_rule", ["rule_id"])
    .index("by_rule_and_group", ["rule_id", "parallel_group"]),

  approval_requests: defineTable({
    quote_id: v.id("quotes"),
    rfq_id: v.id("rfqs"),
    client_id: v.id("profiles"),
    rule_id: v.id("approval_rules"),
    rule_name: v.string(),
    quote_total: v.number(),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
    ),
    requested_at: v.number(),
    decided_at: v.optional(v.number()),
    decided_by: v.optional(v.id("profiles")),
    decision_note: v.optional(v.string()),
    // Multi-step state — current parallel_group whose decisions are active.
    // null/undefined = legacy single-step request.
    current_group: v.optional(v.number()),
    total_groups: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_client", ["client_id"])
    .index("by_quote", ["quote_id"]),

  // Per-step runtime state on an approval_request. One row per step in the
  // workflow. Status is filled in as decisions land.
  approval_step_decisions: defineTable({
    request_id: v.id("approval_requests"),
    step_id: v.id("approval_steps"),
    rule_id: v.id("approval_rules"),
    parallel_group: v.number(),
    label: v.string(),
    approver_admin_id: v.optional(v.id("profiles")),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("SKIPPED"), // request rejected upstream, this step never opened
    ),
    decided_at: v.optional(v.number()),
    decided_by: v.optional(v.id("profiles")),
    decision_note: v.optional(v.string()),
    escalated_at: v.optional(v.number()),
    activated_at: v.optional(v.number()), // when this group became current
    // Snapshot of the approver's signature at decision time (PRD §6.6.3).
    // Frozen here so historical artifacts don't change if the user later
    // replaces their signature image.
    signature_storage_id: v.optional(v.id("_storage")),
  })
    .index("by_request", ["request_id"])
    .index("by_status", ["status"])
    .index("by_approver", ["approver_admin_id", "status"]),

  cost_centers: defineTable({
    client_id: v.id("profiles"),
    code: v.string(),
    name: v.string(),
    notes: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  }).index("by_client", ["client_id"]),

  branches: defineTable({
    client_id: v.id("profiles"),
    name: v.string(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  }).index("by_client", ["client_id"]),

  departments: defineTable({
    client_id: v.id("profiles"),
    name: v.string(),
    notes: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  }).index("by_client", ["client_id"]),

  kyc_documents: defineTable({
    profile_id: v.id("profiles"),
    document_type: v.union(
      v.literal("CR_CERTIFICATE"),
      v.literal("VAT_CERTIFICATE"),
      v.literal("NATIONAL_ADDRESS"),
      v.literal("BANK_LETTER"),
      v.literal("AUTHORIZED_SIGNATORY"),
      v.literal("ID_DOCUMENT"),
      v.literal("OTHER"),
    ),
    name: v.string(),
    storage_id: v.id("_storage"),
    content_type: v.optional(v.string()),
    size: v.optional(v.number()),
    expiry_date: v.optional(v.string()),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
    ),
    rejection_reason: v.optional(v.string()),
    reviewed_by: v.optional(v.id("profiles")),
    reviewed_at: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_profile", ["profile_id"])
    .index("by_status", ["status"]),

  contracts: defineTable({
    name: v.string(),
    client_id: v.optional(v.id("profiles")),
    supplier_id: v.id("profiles"),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("ACTIVE"),
      v.literal("EXPIRED"),
      v.literal("TERMINATED"),
    ),
    start_date: v.string(),
    end_date: v.optional(v.string()),
    payment_terms: v.optional(v.string()),
    discount_percent: v.optional(v.number()),
    terms: v.optional(v.string()),
    notes: v.optional(v.string()),
    created_by: v.id("profiles"),
    terminated_at: v.optional(v.number()),
    terminated_reason: v.optional(v.string()),
  })
    .index("by_client", ["client_id"])
    .index("by_supplier", ["supplier_id"])
    .index("by_status", ["status"]),

  contract_lines: defineTable({
    contract_id: v.id("contracts"),
    product_id: v.optional(v.id("products")),
    description: v.string(),
    unit_price: v.number(),
    min_quantity: v.optional(v.number()),
    notes: v.optional(v.string()),
  }).index("by_contract", ["contract_id"]),

  client_invoices: defineTable({
    client_id: v.id("profiles"),
    order_id: v.optional(v.id("orders")),
    invoice_number: v.string(),
    issue_date: v.string(),
    due_date: v.string(),
    subtotal: v.number(),
    vat_amount: v.number(),
    total_amount: v.number(),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("PENDING_PAYMENT"),
      v.literal("PAID"),
      v.literal("OVERDUE"),
      v.literal("VOID"),
    ),
    issued_by: v.id("profiles"),
    paid_at: v.optional(v.number()),
    paid_reference: v.optional(v.string()),
    void_reason: v.optional(v.string()),
    voided_at: v.optional(v.number()),
    last_reminder_at: v.optional(v.number()),
    reminder_count: v.optional(v.number()),
    matched_payment_id: v.optional(v.id("payments")),
    // Document engine cross-stamp (PRD §10.3)
    latest_document_id: v.optional(v.id("generated_documents")),
    latest_document_hash: v.optional(v.string()),
    latest_document_at: v.optional(v.number()),
    // Three-way match (PRD §6.11) — auto-reconciliation against the
    // underlying order's quote items and any confirmed GRN lines.
    // Recomputed when an invoice is created, a GRN lands, or admin clicks
    // "Recompute match".
    match_status: v.optional(
      v.union(
        v.literal("MATCHED"),         // received >= invoiced, no disputes
        v.literal("MISMATCH"),        // qty/price drift detected
        v.literal("NO_GRN"),          // invoice exists but no receipt yet
        v.literal("DISPUTED_GRN"),    // any GRN linked is in DISPUTED status
        v.literal("NOT_APPLICABLE"),  // manual invoice (no order_id)
      ),
    ),
    match_summary: v.optional(v.string()),
    match_computed_at: v.optional(v.number()),
    matched_grn_ids: v.optional(v.array(v.id("goods_receipt_notes"))),
    // Wafeq / ZATCA tracking (PRD §8.1) — populated when invoice is pushed
    // through Wafeq for ZATCA Phase 2 clearance.
    wafeq_invoice_id: v.optional(v.string()),
    wafeq_environment: v.optional(
      v.union(v.literal("simulation"), v.literal("production"), v.literal("mock")),
    ),
    zatca_uuid: v.optional(v.string()),
    zatca_status: v.optional(v.string()), // e.g. CLEARED, REPORTED, PENDING, REJECTED
    zatca_hash: v.optional(v.string()),
    zatca_qr: v.optional(v.string()),
    zatca_pdf_url: v.optional(v.string()),
    zatca_pdf_storage_id: v.optional(v.id("_storage")),
    zatca_cleared_at: v.optional(v.number()),
    zatca_last_error: v.optional(v.string()),
  })
    .index("by_client", ["client_id"])
    .index("by_status", ["status"])
    .index("by_order", ["order_id"])
    .index("by_zatca_status", ["zatca_status"])
    .index("by_match_status", ["match_status"]),

  payment_allocations: defineTable({
    payment_id: v.id("payments"),
    invoice_id: v.id("client_invoices"),
    amount: v.number(),
    allocated_by: v.id("profiles"),
  })
    .index("by_payment", ["payment_id"])
    .index("by_invoice", ["invoice_id"]),

  // Credit & debit notes against client invoices (PRD §8.1.4). Each note
  // references an original invoice, gets cleared through Wafeq for ZATCA,
  // and is tracked here as an adjustment record. Single polymorphic table
  // keyed by `type` to avoid duplicating ZATCA fields across two tables.
  client_invoice_adjustments: defineTable({
    invoice_id: v.id("client_invoices"),
    client_id: v.id("profiles"),
    type: v.union(v.literal("CREDIT"), v.literal("DEBIT")),
    adjustment_number: v.string(), // MWRD-controlled sequential
    issue_date: v.string(),
    subtotal: v.number(),
    vat_amount: v.number(),
    total_amount: v.number(),
    reason: v.string(),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("PENDING_CLEARANCE"), // created, awaiting Wafeq submit
      v.literal("CLEARED"),           // ZATCA cleared via Wafeq
      v.literal("FAILED"),            // Wafeq returned an error
      v.literal("VOID"),              // soft-deleted by admin
    ),
    issued_by: v.id("profiles"),
    void_reason: v.optional(v.string()),
    voided_at: v.optional(v.number()),
    // Wafeq / ZATCA tracking — same shape as client_invoices for consistency
    wafeq_adjustment_id: v.optional(v.string()),
    wafeq_environment: v.optional(
      v.union(v.literal("simulation"), v.literal("production"), v.literal("mock")),
    ),
    zatca_uuid: v.optional(v.string()),
    zatca_status: v.optional(v.string()),
    zatca_hash: v.optional(v.string()),
    zatca_qr: v.optional(v.string()),
    zatca_pdf_url: v.optional(v.string()),
    zatca_cleared_at: v.optional(v.number()),
    zatca_last_error: v.optional(v.string()),
  })
    .index("by_invoice", ["invoice_id"])
    .index("by_client", ["client_id"])
    .index("by_status", ["status"]),

  supplier_invoices: defineTable({
    supplier_id: v.id("profiles"),
    order_id: v.id("orders"),
    invoice_number: v.string(),
    issue_date: v.string(),
    due_date: v.optional(v.string()),
    subtotal: v.number(),
    vat_amount: v.number(),
    total_amount: v.number(),
    notes: v.optional(v.string()),
    storage_id: v.optional(v.id("_storage")),
    file_name: v.optional(v.string()),
    status: v.union(
      v.literal("SUBMITTED"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("PAID"),
    ),
    rejection_reason: v.optional(v.string()),
    reviewed_by: v.optional(v.id("profiles")),
    reviewed_at: v.optional(v.number()),
    paid_at: v.optional(v.number()),
    paid_reference: v.optional(v.string()),
    // AP-side bookkeeping in Wafeq (PRD §8.1.3). Supplier remains seller of
    // record; this is just MWRD's bill ledger.
    wafeq_bill_id: v.optional(v.string()),
    wafeq_environment: v.optional(
      v.union(v.literal("simulation"), v.literal("production"), v.literal("mock")),
    ),
    // Supplier may have its own ZATCA submission — record those refs here.
    supplier_zatca_uuid: v.optional(v.string()),
    supplier_zatca_pdf_url: v.optional(v.string()),
  })
    .index("by_supplier", ["supplier_id"])
    .index("by_order", ["order_id"])
    .index("by_status", ["status"]),

  // SPL (Saudi Post / National Address) verification sync log (PRD §8.3).
  // Mirrors the wathq_sync_log shape so the admin viewer stays uniform.
  spl_sync_log: defineTable({
    operation: v.string(), // validateAddress
    environment: v.union(v.literal("production"), v.literal("mock")),
    target_type: v.string(), // profile
    target_id: v.string(),
    short_address: v.optional(v.string()),
    status: v.union(
      v.literal("VERIFIED"),
      v.literal("MISMATCH"),
      v.literal("NOT_FOUND"),
      v.literal("API_ERROR"),
      v.literal("NETWORK_ERROR"),
      v.literal("CONFIG_ERROR"),
    ),
    http_status: v.optional(v.number()),
    error_code: v.optional(v.string()),
    error_message: v.optional(v.string()),
    response_summary: v.optional(v.any()),
    duration_ms: v.optional(v.number()),
    actor_profile_id: v.optional(v.id("profiles")),
  })
    .index("by_target", ["target_type", "target_id"])
    .index("by_status", ["status"]),

  // Wathq (Saudi Business Center) verification sync log (PRD §8.3) — every
  // CR lookup attempt with the result. Mirrors the Wafeq sync-log shape so
  // the admin viewer pattern stays uniform.
  wathq_sync_log: defineTable({
    operation: v.string(), // verifyByCR | refreshLegalName
    environment: v.union(v.literal("production"), v.literal("mock")),
    target_type: v.string(), // profile
    target_id: v.string(),
    cr_number: v.optional(v.string()),
    status: v.union(
      v.literal("VERIFIED"),
      v.literal("MISMATCH"),
      v.literal("NOT_FOUND"),
      v.literal("API_ERROR"),
      v.literal("NETWORK_ERROR"),
      v.literal("CONFIG_ERROR"),
    ),
    http_status: v.optional(v.number()),
    error_code: v.optional(v.string()),
    error_message: v.optional(v.string()),
    response_summary: v.optional(v.any()),
    duration_ms: v.optional(v.number()),
    actor_profile_id: v.optional(v.id("profiles")),
  })
    .index("by_target", ["target_type", "target_id"])
    .index("by_status", ["status"]),

  // Wafeq integration sync log (PRD §8.1.5) — every API attempt with the
  // idempotency key, environment, latency, success/error category, and the
  // raw response snippet for debugging. Append-only.
  wafeq_sync_log: defineTable({
    operation: v.string(), // ensureContact | submitClientInvoice | submitSupplierBill | voidInvoice | reconcile
    idempotency_key: v.string(),
    environment: v.union(
      v.literal("simulation"),
      v.literal("production"),
      v.literal("mock"),
    ),
    target_type: v.string(), // client_invoice | supplier_invoice | profile
    target_id: v.string(),
    status: v.union(
      v.literal("SUCCESS"),
      v.literal("API_ERROR"),
      v.literal("ZATCA_ERROR"),
      v.literal("NETWORK_ERROR"),
      v.literal("CONFIG_ERROR"),
    ),
    http_status: v.optional(v.number()),
    error_code: v.optional(v.string()),
    error_message: v.optional(v.string()),
    request_summary: v.optional(v.any()),
    response_summary: v.optional(v.any()),
    duration_ms: v.optional(v.number()),
    actor_profile_id: v.optional(v.id("profiles")),
  })
    .index("by_target", ["target_type", "target_id"])
    .index("by_status", ["status"])
    .index("by_operation", ["operation"]),

  interest_submissions: defineTable({
    full_name: v.string(),
    company_name: v.optional(v.string()),
    cr_number: v.optional(v.string()),
    vat_number: v.optional(v.string()),
    email: v.string(),
    phone: v.optional(v.string()),
    account_type: v.optional(v.union(v.literal("CLIENT"), v.literal("SUPPLIER"))),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("PENDING"),
      v.literal("REVIEWED"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
    ),
  }).index("by_status", ["status"]),

  // Document templates (PRD §10.3) — bilingual body strings rendered by
  // the document engine to produce immutable artifacts. Admin-editable;
  // each template is keyed (e.g. "client_po") and may carry a version.
  document_templates: defineTable({
    key: v.string(),                  // "client_po", "client_invoice", ...
    title_ar: v.string(),
    title_en: v.string(),
    body_ar: v.string(),              // handlebars-lite source
    body_en: v.string(),
    bilingual_layout: v.union(
      v.literal("SIDE_BY_SIDE"),
      v.literal("AR_ONLY"),
      v.literal("EN_ONLY"),
    ),
    is_default: v.boolean(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // Immutable generated artifact (PRD §10.3 storage + versioning).
  // Each regeneration produces a new row with version+1 — old versions are
  // never overwritten. content_hash makes the artifact tamper-evident: any
  // manual edit downstream changes the hash, surfacing the drift.
  generated_documents: defineTable({
    template_key: v.string(),
    target_type: v.string(),          // "order" | "quote" | "client_invoice" | "grn"
    target_id: v.string(),
    version: v.number(),              // per (target_type, target_id), starts at 1
    language: v.union(
      v.literal("ar"),
      v.literal("en"),
      v.literal("bilingual"),
    ),
    title: v.string(),                // resolved title at render time
    content_html: v.string(),         // rendered output
    content_hash: v.string(),         // SHA-256 of content_html
    generated_by: v.id("profiles"),
    notes: v.optional(v.string()),
  })
    .index("by_target", ["target_type", "target_id"])
    .index("by_template", ["template_key"]),

  // Append-only audit trail (PRD §13.4) — every privileged mutation
  // writes one row here via logAction(). Kept separate from admin_audit_log
  // (legacy admin-only table) so we can grow toward 10-year ZATCA retention.
  audit_log: defineTable({
    actor_user_id: v.optional(v.id("users")),
    actor_profile_id: v.optional(v.id("profiles")),
    actor_role: v.optional(
      v.union(
        v.literal("CLIENT"),
        v.literal("SUPPLIER"),
        v.literal("ADMIN"),
        v.literal("AUDITOR"),
        v.literal("SYSTEM"),
      ),
    ),
    actor_public_id: v.optional(v.string()),
    action: v.string(),
    target_type: v.string(),
    target_id: v.optional(v.string()),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    details: v.optional(v.any()),
    ip: v.optional(v.string()),
    user_agent: v.optional(v.string()),
  })
    .index("by_actor", ["actor_profile_id"])
    .index("by_target", ["target_type", "target_id"])
    .index("by_action", ["action"]),

  // Master category tree (PRD §5.4.1) — bilingual, up to 4 levels
  // level 0=Category, 1=Subcategory, 2=Family, 3=Item-class
  categories: defineTable({
    parent_id: v.optional(v.id("categories")),
    level: v.number(), // 0..3
    slug: v.string(),
    name_ar: v.string(),
    name_en: v.string(),
    description_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    default_uom: v.optional(v.string()), // e.g. PCS, KG, BOX
    tax_class: v.optional(
      v.union(
        v.literal("STANDARD"),
        v.literal("ZERO_RATED"),
        v.literal("EXEMPT"),
      ),
    ),
    // Optional JSON-encoded attribute schema for the leaf
    attribute_schema: v.optional(v.string()),
    display_order: v.optional(v.number()),
    is_active: v.boolean(),
    // Proposal lifecycle (PRD §5.4.2). ACTIVE = curated, PROPOSED = supplier-suggested awaiting review.
    status: v.union(
      v.literal("ACTIVE"),
      v.literal("PROPOSED"),
      v.literal("REJECTED"),
      v.literal("ARCHIVED"),
    ),
    proposed_by: v.optional(v.id("profiles")),
    proposed_justification: v.optional(v.string()),
    decided_by: v.optional(v.id("profiles")),
    decided_at: v.optional(v.number()),
    decision_note: v.optional(v.string()),
    created_by: v.optional(v.id("profiles")),
  })
    .index("by_parent", ["parent_id"])
    .index("by_status", ["status"])
    .index("by_level", ["level"])
    .index("by_slug", ["slug"]),
});

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  profiles: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("CLIENT"), v.literal("SUPPLIER"), v.literal("ADMIN")),
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
  })
    .index("by_userId", ["userId"])
    .index("by_role", ["role"])
    .index("by_public_id", ["public_id"]),

  products: defineTable({
    supplier_id: v.id("profiles"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    subcategory: v.optional(v.string()),
    sku: v.optional(v.string()),
    brand: v.optional(v.string()),
    images: v.array(v.string()),
    cost_price: v.number(),
    lead_time_days: v.number(),
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
  })
    .index("by_supplier", ["supplier_id"])
    .index("by_approval", ["approval_status"]),

  rfqs: defineTable({
    client_id: v.id("profiles"),
    status: v.union(v.literal("OPEN"), v.literal("QUOTED"), v.literal("CLOSED")),
    category: v.optional(v.string()),
    template_key: v.optional(v.string()),
    expiry_date: v.optional(v.string()),
    required_by: v.optional(v.string()),
    delivery_location: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_client", ["client_id"])
    .index("by_status", ["status"]),

  rfq_items: defineTable({
    rfq_id: v.id("rfqs"),
    product_id: v.optional(v.id("products")),
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
      v.literal("PENDING_ADMIN"),
      v.literal("SENT_TO_CLIENT"),
      v.literal("ACCEPTED"),
      v.literal("REJECTED"),
    ),
    reviewed_by: v.optional(v.id("profiles")),
    reviewed_at: v.optional(v.number()),
    supplier_notes: v.optional(v.string()),
  })
    .index("by_rfq", ["rfq_id"])
    .index("by_supplier", ["supplier_id"])
    .index("by_status", ["status"]),

  quote_items: defineTable({
    quote_id: v.id("quotes"),
    rfq_item_id: v.id("rfq_items"),
    is_quoted: v.boolean(),
    supplier_product_id: v.optional(v.id("products")),
    alternative_product_id: v.optional(v.id("products")),
    cost_price: v.optional(v.number()),
    lead_time_days: v.optional(v.number()),
    margin_percent: v.optional(v.number()),
    final_price_before_vat: v.optional(v.number()),
    final_price_with_vat: v.optional(v.number()),
  }).index("by_quote", ["quote_id"]),

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

  notifications: defineTable({
    user_id: v.id("profiles"),
    title: v.string(),
    message: v.optional(v.string()),
    read: v.boolean(),
    link: v.optional(v.string()),
  }).index("by_user", ["user_id"]),

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
});

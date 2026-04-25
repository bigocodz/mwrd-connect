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
    is_preferred: v.optional(v.boolean()),
    preferred_note: v.optional(v.string()),
    preferred_at: v.optional(v.number()),
    preferred_by: v.optional(v.id("profiles")),
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
    stock_quantity: v.optional(v.number()),
    low_stock_threshold: v.optional(v.number()),
    stock_updated_at: v.optional(v.number()),
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
    cost_center_id: v.optional(v.id("cost_centers")),
    branch_id: v.optional(v.id("branches")),
    department_id: v.optional(v.id("departments")),
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
      v.literal("CLIENT_REVISION_REQUESTED"),
      v.literal("SUPPLIER_REVISION_REQUESTED"),
      v.literal("REVISION_SUBMITTED"),
      v.literal("ACCEPTED"),
      v.literal("REJECTED"),
    ),
    reviewed_by: v.optional(v.id("profiles")),
    reviewed_at: v.optional(v.number()),
    supplier_notes: v.optional(v.string()),
    revision_count: v.optional(v.number()),
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

  orders: defineTable({
    rfq_id: v.id("rfqs"),
    quote_id: v.id("quotes"),
    client_id: v.id("profiles"),
    supplier_id: v.id("profiles"),
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
  })
    .index("by_client", ["client_id"])
    .index("by_supplier", ["supplier_id"])
    .index("by_status", ["status"])
    .index("by_quote", ["quote_id"])
    .index("by_dispute_status", ["dispute_status"]),

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
  })
    .index("by_client", ["client_id"])
    .index("by_client_product", ["client_id", "product_id"]),

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
  }).index("by_client", ["client_id"]),

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
  })
    .index("by_status", ["status"])
    .index("by_client", ["client_id"])
    .index("by_quote", ["quote_id"]),

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
  })
    .index("by_client", ["client_id"])
    .index("by_status", ["status"])
    .index("by_order", ["order_id"]),

  payment_allocations: defineTable({
    payment_id: v.id("payments"),
    invoice_id: v.id("client_invoices"),
    amount: v.number(),
    allocated_by: v.id("profiles"),
  })
    .index("by_payment", ["payment_id"])
    .index("by_invoice", ["invoice_id"]),

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
  })
    .index("by_supplier", ["supplier_id"])
    .index("by_order", ["order_id"])
    .index("by_status", ["status"]),

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

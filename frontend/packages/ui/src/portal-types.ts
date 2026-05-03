// Types mirroring backend serializers — kept in this package because both
// client and supplier portals consume them. Once openapi-typescript fully
// types the kyc/team responses, these can be derived from @mwrd/api/schema.
import type { OrgType } from "@mwrd/auth";

export type KycStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

export type DocKind = "CR" | "VAT" | "BANK_LETTER" | "ID_CARD" | "OTHER";

export interface KycDocument {
  id: number;
  kind: DocKind;
  storage_key: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
}

export interface KycSubmission {
  id: number;
  organization: number;
  status: KycStatus;
  legal_name: string;
  legal_name_ar: string;
  cr_number: string;
  vat_number: string;
  address_line1: string;
  address_line2: string;
  city: string;
  country: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string;
  documents: KycDocument[];
  created_at: string;
  updated_at: string;
}

export interface SignedUpload {
  upload: { url: string; method: string; headers: Record<string, string> };
  storage_key: string;
}

export interface TeamMember {
  id: number;
  user_email: string;
  user_full_name: string;
  role: "OWNER" | "ADMIN" | "BUYER" | "APPROVER" | "VIEWER";
  status: "INVITED" | "ACTIVE" | "REMOVED";
  created_at: string;
}

export interface OrgListItem {
  id: number;
  type: OrgType;
  status:
    | "INVITED"
    | "KYC_PENDING"
    | "KYC_REVIEW"
    | "ACTIVE"
    | "SUSPENDED"
    | "ARCHIVED";
  name: string;
  public_id: string;
  contact_email: string;
  activated_at: string | null;
  suspended_at: string | null;
  suspension_reason: string;
  created_at: string;
  updated_at: string;
}

// ---------- Catalog ----------

export interface PackType {
  code: string;
  label_en: string;
  label_ar: string;
  base_qty: number;
  uom?: string;
}

export interface Category {
  id: number;
  parent: number | null;
  level: number;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  default_uom: string;
  display_order: number;
  is_active: boolean;
}

export interface MasterProduct {
  id: number;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  category: number;
  category_name_en?: string;
  sku: string;
  brand: string;
  image_keys: string[];
  specs: Record<string, unknown>;
  pack_types: PackType[];
  status: "ACTIVE" | "DEPRECATED";
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierProduct {
  id: number;
  organization: number;
  master_product: number;
  master_name_en?: string;
  pack_type_code: string;
  sku: string;
  cost_price: string;
  moq: number;
  lead_time_days: number;
  auto_quote: boolean;
  availability_status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "DISCONTINUED";
  stock_quantity: number | null;
  low_stock_threshold: number | null;
  approval_status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

// ---------- RFQ / Quote / Contract / Order ----------

export interface RfqItem {
  id: number;
  line_no: number;
  master_product: number;
  master_product_name: string;
  pack_type_code: string;
  quantity: number;
  notes: string;
}

export interface Rfq {
  id: number;
  client_org: number;
  title: string;
  description: string;
  notes: string;
  delivery_location: string;
  required_by: string | null;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "AWARDED";
  published_at: string | null;
  closed_at: string | null;
  awarded_at: string | null;
  items: RfqItem[];
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: number;
  rfq_item: number;
  rfq_item_line_no: number;
  master_product_name: string;
  quantity: number;
  pack_type_code: string;
  unit_price: string;
  total_price: string;
  lead_time_days: number | null;
  availability_notes: string;
}

export interface Quote {
  id: number;
  rfq: number;
  rfq_title: string;
  supplier_org: number;
  supplier_name: string;
  status: "DRAFT" | "SUBMITTED" | "WITHDRAWN" | "AWARDED" | "LOST";
  total: string;
  lead_time_days: number | null;
  valid_until: string | null;
  notes: string;
  submitted_at: string | null;
  withdrawn_at: string | null;
  awarded_at: string | null;
  items: QuoteItem[];
  created_at: string;
  updated_at: string;
}

export interface ContractItem {
  id: number;
  line_no: number;
  master_product: number;
  master_product_name: string;
  pack_type_code: string;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface Contract {
  id: number;
  rfq: number;
  quote: number;
  client_org: number;
  client_org_name: string;
  supplier_org: number;
  supplier_org_name: string;
  status: "PENDING_SIGNATURES" | "SIGNED" | "ORDER_ISSUED" | "CANCELLED";
  total: string;
  delivery_location: string;
  required_by: string | null;
  notes: string;
  client_signed_at: string | null;
  supplier_signed_at: string | null;
  items: ContractItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItemT {
  id: number;
  line_no: number;
  master_product: number;
  master_product_name: string;
  pack_type_code: string;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface OrderT {
  id: number;
  contract: number;
  client_org: number;
  client_org_name: string;
  supplier_org: number;
  supplier_org_name: string;
  status: "DRAFT" | "CONFIRMED" | "IN_FULFILLMENT" | "COMPLETED" | "CANCELLED";
  total: string;
  delivery_location: string;
  required_by: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  items: OrderItemT[];
  created_at: string;
  updated_at: string;
}


// ---------- Fulfillment / Invoicing / Payments ----------

export interface DeliveryNoteItem {
  id: number;
  order_item: number;
  line_no: number;
  master_product_name: string;
  pack_type_code: string;
  quantity: number;
}

export interface DeliveryNote {
  id: number;
  order: number;
  supplier_org: number;
  client_org: number;
  status: "DRAFT" | "DISPATCHED" | "DELIVERED";
  dispatched_at: string | null;
  delivered_at: string | null;
  notes: string;
  items: DeliveryNoteItem[];
  created_at: string;
  updated_at: string;
}

export interface GrnItem {
  id: number;
  dn_item: number;
  line_no: number;
  master_product_name: string;
  dn_quantity: number;
  accepted_qty: number;
  rejected_qty: number;
  notes: string;
}

export interface Grn {
  id: number;
  delivery_note: number;
  client_org: number;
  status: "DRAFT" | "COMPLETED";
  received_at: string | null;
  notes: string;
  items: GrnItem[];
  created_at: string;
  updated_at: string;
}

export interface ThreeWayMatchLine {
  order_item_id: number;
  ordered: number;
  shipped: number;
  accepted: number;
  rejected: number;
  delta: number;
}

export interface ThreeWayMatch {
  matched: boolean;
  lines: ThreeWayMatchLine[];
}

export interface SupplierInvoiceItemT {
  id: number;
  order_item: number;
  line_no: number;
  master_product_name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface SupplierInvoiceT {
  id: number;
  order: number;
  supplier_org: number;
  number: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
  subtotal: string;
  total: string;
  issued_at: string | null;
  paid_at: string | null;
  items: SupplierInvoiceItemT[];
  created_at: string;
  updated_at: string;
}

export interface ClientInvoiceItemT {
  id: number;
  order_item: number;
  line_no: number;
  master_product_name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface ClientInvoiceT {
  id: number;
  order: number;
  client_org: number;
  source_supplier_invoice: number | null;
  number: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
  subtotal: string;
  margin_rate: string;
  margin_amount: string;
  total: string;
  issued_at: string | null;
  paid_at: string | null;
  items: ClientInvoiceItemT[];
  created_at: string;
  updated_at: string;
}

export interface PaymentT {
  id: number;
  invoice: number;
  amount: string;
  method: string;
  reference: string;
  paid_at: string;
  created_at: string;
}

export interface PayoutT {
  id: number;
  invoice: number;
  amount: string;
  method: string;
  reference: string;
  paid_at: string;
  created_at: string;
}


export interface ProductAdditionRequest {
  id: number;
  organization: number;
  proposed_name_en: string;
  proposed_name_ar: string;
  proposed_description_en: string;
  proposed_description_ar: string;
  category: number;
  proposed_sku: string;
  proposed_brand: string;
  image_keys: string[];
  specs: Record<string, unknown>;
  proposed_pack_types: PackType[];
  justification: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  admin_notes: string;
  rejection_reason: string;
  decided_at: string | null;
  created_master_product_id: number | null;
  created_at: string;
  updated_at: string;
}

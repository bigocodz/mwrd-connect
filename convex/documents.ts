/**
 * Document engine (PRD §10.3).
 *
 * Generates immutable, versioned, hash-stamped document artifacts for
 * orders / quotes / invoices / GRNs from admin-editable bilingual templates.
 *
 * For v1 the artifact is HTML stored inline; the same template + renderer
 * produces a printable document the browser can render to PDF. A future
 * slice can swap inline storage for Convex Files + a real PDF binary
 * without touching the template authoring surface.
 */
import { internalMutation, mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin, requireAdminRead, getAuthenticatedProfile } from "./lib";
import { logAction } from "./audit";
import {
  renderTemplate,
  bilingualWrapper,
  singleLanguageWrapper,
  sha256,
} from "./documentRenderer";

// ==================== Default templates ====================

// Templates are intentionally short + structural. Real procurement teams
// will edit these in the admin UI (next slice). Each template contains a
// {{#each items as |item|}} loop so per-line interpolation is possible.

const DEFAULT_TEMPLATES = [
  {
    key: "client_po",
    title_ar: "أمر شراء",
    title_en: "Purchase Order",
    bilingual_layout: "SIDE_BY_SIDE" as const,
    body_ar: `
<p class="meta">رقم الطلب: <strong>{{order.public_id}}</strong> · التاريخ: {{order.issue_date}}</p>
<h3>المشتري</h3>
<p>{{client.legal_name_ar}}<br/>السجل التجاري: {{client.cr_number}}<br/>الرقم الضريبي: {{client.vat_number}}</p>
<h3>المورد</h3>
<p>{{supplier.legal_name_ar}}<br/>السجل التجاري: {{supplier.cr_number}}</p>
<h3>الأصناف</h3>
<table>
  <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر للوحدة</th><th>الإجمالي</th></tr></thead>
  <tbody>
    {{#each items as |item|}}
    <tr><td>{{item.name}}</td><td>{{item.quantity}}</td><td>{{item.unit_price}}</td><td>{{item.line_total}}</td></tr>
    {{/each}}
  </tbody>
</table>
<p class="total-row">الإجمالي قبل الضريبة: {{order.subtotal}} ر.س</p>
<p class="total-row">ضريبة القيمة المضافة: {{order.vat_amount}} ر.س</p>
<p class="total-row">الإجمالي: {{order.total_with_vat}} ر.س</p>
{{#if order.notes}}<p class="meta"><strong>ملاحظات:</strong> {{order.notes}}</p>{{/if}}
{{#if signatures}}
<h3>التواقيع والاعتمادات</h3>
<div class="signature-block">
  {{#each signatures as |sig|}}
  <div class="signature">
    <p class="signature-label">{{sig.label}}</p>
    {{#if sig.url}}<img src="{{{sig.url}}}" alt="Signature" />{{/if}}
    <p class="meta">{{sig.approver_public_id}} · {{sig.decided_at}}</p>
  </div>
  {{/each}}
</div>
{{/if}}
{{#if stamp}}<div class="stamp-block">{{#if stamp.url}}<img src="{{{stamp.url}}}" alt="Company stamp" class="stamp" />{{/if}}</div>{{/if}}
`,
    body_en: `
<p class="meta">Order ID: <strong>{{order.public_id}}</strong> · Date: {{order.issue_date}}</p>
<h3>Buyer</h3>
<p>{{client.legal_name_en}}<br/>CR: {{client.cr_number}}<br/>VAT: {{client.vat_number}}</p>
<h3>Supplier</h3>
<p>{{supplier.legal_name_en}}<br/>CR: {{supplier.cr_number}}</p>
<h3>Items</h3>
<table>
  <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
  <tbody>
    {{#each items as |item|}}
    <tr><td>{{item.name}}</td><td>{{item.quantity}}</td><td>{{item.unit_price}}</td><td>{{item.line_total}}</td></tr>
    {{/each}}
  </tbody>
</table>
<p class="total-row">Subtotal: SAR {{order.subtotal}}</p>
<p class="total-row">VAT: SAR {{order.vat_amount}}</p>
<p class="total-row">Total: SAR {{order.total_with_vat}}</p>
{{#if order.notes}}<p class="meta"><strong>Notes:</strong> {{order.notes}}</p>{{/if}}
{{#if signatures}}
<h3>Approvals & signatures</h3>
<div class="signature-block">
  {{#each signatures as |sig|}}
  <div class="signature">
    <p class="signature-label">{{sig.label}}</p>
    {{#if sig.url}}<img src="{{{sig.url}}}" alt="Signature" />{{/if}}
    <p class="meta">{{sig.approver_public_id}} · {{sig.decided_at}}</p>
  </div>
  {{/each}}
</div>
{{/if}}
{{#if stamp}}<div class="stamp-block">{{#if stamp.url}}<img src="{{{stamp.url}}}" alt="Company stamp" class="stamp" />{{/if}}</div>{{/if}}
`,
    description: "Bilingual purchase order issued to a supplier on a confirmed order",
  },
  {
    key: "client_invoice",
    title_ar: "فاتورة",
    title_en: "Invoice",
    bilingual_layout: "SIDE_BY_SIDE" as const,
    body_ar: `
<p class="meta">رقم الفاتورة: <strong>{{invoice.invoice_number}}</strong></p>
<p class="meta">تاريخ الإصدار: {{invoice.issue_date}} · تاريخ الاستحقاق: {{invoice.due_date}}</p>
<h3>الفوترة إلى</h3>
<p>{{client.legal_name_ar}}<br/>السجل التجاري: {{client.cr_number}}<br/>الرقم الضريبي: {{client.vat_number}}</p>
<h3>التفاصيل</h3>
<table>
  <tbody>
    <tr><td>الإجمالي قبل الضريبة</td><td>{{invoice.subtotal}} ر.س</td></tr>
    <tr><td>ضريبة القيمة المضافة (15%)</td><td>{{invoice.vat_amount}} ر.س</td></tr>
    <tr class="total-row"><td>الإجمالي المستحق</td><td>{{invoice.total_amount}} ر.س</td></tr>
  </tbody>
</table>
{{#if invoice.notes}}<p class="meta">{{invoice.notes}}</p>{{/if}}
{{#if zatca.uuid}}<p class="meta">معرّف ZATCA: {{zatca.uuid}}</p>{{/if}}
`,
    body_en: `
<p class="meta">Invoice #: <strong>{{invoice.invoice_number}}</strong></p>
<p class="meta">Issue date: {{invoice.issue_date}} · Due date: {{invoice.due_date}}</p>
<h3>Bill to</h3>
<p>{{client.legal_name_en}}<br/>CR: {{client.cr_number}}<br/>VAT: {{client.vat_number}}</p>
<h3>Details</h3>
<table>
  <tbody>
    <tr><td>Subtotal</td><td>SAR {{invoice.subtotal}}</td></tr>
    <tr><td>VAT (15%)</td><td>SAR {{invoice.vat_amount}}</td></tr>
    <tr class="total-row"><td>Total due</td><td>SAR {{invoice.total_amount}}</td></tr>
  </tbody>
</table>
{{#if invoice.notes}}<p class="meta">{{invoice.notes}}</p>{{/if}}
{{#if zatca.uuid}}<p class="meta">ZATCA UUID: {{zatca.uuid}}</p>{{/if}}
`,
    description: "Bilingual tax invoice for a client_invoice row (also surfaces ZATCA UUID when cleared)",
  },
  {
    key: "supplier_grn",
    title_ar: "إيصال استلام بضاعة",
    title_en: "Goods Receipt Note",
    bilingual_layout: "SIDE_BY_SIDE" as const,
    body_ar: `
<p class="meta">رقم الإيصال: <strong>{{grn.grn_number}}</strong> · رقم الطلب: {{order.short_id}}</p>
<p class="meta">تاريخ الاستلام: {{grn.received_at}}</p>
<h3>الأطراف</h3>
<p><strong>المشتري:</strong> {{client.legal_name_ar}}<br/><strong>المورد:</strong> {{supplier.legal_name_ar}}</p>
<h3>الأصناف المستلمة</h3>
<table>
  <thead><tr><th>الصنف</th><th>المطلوب</th><th>المستلم</th><th>الحالة</th><th>ملاحظات</th></tr></thead>
  <tbody>
    {{#each lines as |line|}}
    <tr><td>{{line.description}}</td><td>{{line.ordered_qty}}</td><td>{{line.received_qty}}</td><td>{{line.condition}}</td><td>{{line.notes}}</td></tr>
    {{/each}}
  </tbody>
</table>
{{#if grn.has_discrepancy}}<p class="meta"><strong>تباين:</strong> {{grn.discrepancy_summary}}</p>{{/if}}
{{#if grn.resolution}}<p class="meta"><strong>القرار:</strong> {{grn.resolution}}</p>{{/if}}
`,
    body_en: `
<p class="meta">GRN #: <strong>{{grn.grn_number}}</strong> · Order: {{order.short_id}}</p>
<p class="meta">Received at: {{grn.received_at}}</p>
<h3>Parties</h3>
<p><strong>Buyer:</strong> {{client.legal_name_en}}<br/><strong>Supplier:</strong> {{supplier.legal_name_en}}</p>
<h3>Received items</h3>
<table>
  <thead><tr><th>Item</th><th>Ordered</th><th>Received</th><th>Condition</th><th>Notes</th></tr></thead>
  <tbody>
    {{#each lines as |line|}}
    <tr><td>{{line.description}}</td><td>{{line.ordered_qty}}</td><td>{{line.received_qty}}</td><td>{{line.condition}}</td><td>{{line.notes}}</td></tr>
    {{/each}}
  </tbody>
</table>
{{#if grn.has_discrepancy}}<p class="meta"><strong>Discrepancy:</strong> {{grn.discrepancy_summary}}</p>{{/if}}
{{#if grn.resolution}}<p class="meta"><strong>Resolution:</strong> {{grn.resolution}}</p>{{/if}}
`,
    description: "Bilingual goods receipt note printable from any GRN",
  },
  {
    key: "client_quote",
    title_ar: "عرض سعر",
    title_en: "Quotation",
    bilingual_layout: "SIDE_BY_SIDE" as const,
    body_ar: `
<p class="meta">عرض رقم: <strong>{{quote.short_id}}</strong> · المرجع: {{quote.rfq_short_id}}</p>
<p class="meta">الحالة: {{quote.status}}</p>
<h3>المرسل إلى</h3>
<p>{{client.legal_name_ar}}</p>
<h3>الأصناف</h3>
<table>
  <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر للوحدة</th><th>الإجمالي</th></tr></thead>
  <tbody>
    {{#each items as |item|}}
    <tr><td>{{item.name}}</td><td>{{item.quantity}}</td><td>{{item.unit_price}}</td><td>{{item.line_total}}</td></tr>
    {{/each}}
  </tbody>
</table>
<p class="total-row">الإجمالي قبل الضريبة: {{quote.subtotal}} ر.س</p>
<p class="total-row">ضريبة القيمة المضافة: {{quote.vat_amount}} ر.س</p>
<p class="total-row">الإجمالي: {{quote.total_with_vat}} ر.س</p>
{{#if quote.supplier_notes}}<p class="meta"><strong>ملاحظات:</strong> {{quote.supplier_notes}}</p>{{/if}}
`,
    body_en: `
<p class="meta">Quote: <strong>{{quote.short_id}}</strong> · RFQ: {{quote.rfq_short_id}}</p>
<p class="meta">Status: {{quote.status}}</p>
<h3>To</h3>
<p>{{client.legal_name_en}}</p>
<h3>Items</h3>
<table>
  <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
  <tbody>
    {{#each items as |item|}}
    <tr><td>{{item.name}}</td><td>{{item.quantity}}</td><td>{{item.unit_price}}</td><td>{{item.line_total}}</td></tr>
    {{/each}}
  </tbody>
</table>
<p class="total-row">Subtotal: SAR {{quote.subtotal}}</p>
<p class="total-row">VAT: SAR {{quote.vat_amount}}</p>
<p class="total-row">Total: SAR {{quote.total_with_vat}}</p>
{{#if quote.supplier_notes}}<p class="meta"><strong>Notes:</strong> {{quote.supplier_notes}}</p>{{/if}}
`,
    description: "Bilingual quote document used for client-facing offer packs",
  },
];

// ==================== Internal mutations ====================

export const _seedDefaults = internalMutation({
  // Idempotent: only inserts templates that aren't already present.
  handler: async (ctx) => {
    let inserted = 0;
    for (const t of DEFAULT_TEMPLATES) {
      const existing = await ctx.db
        .query("document_templates")
        .withIndex("by_key", (q) => q.eq("key", t.key))
        .unique();
      if (existing) continue;
      await ctx.db.insert("document_templates", { ...t, is_default: true });
      inserted++;
    }
    return { inserted, total: DEFAULT_TEMPLATES.length };
  },
});

// ==================== Queries ====================

export const listTemplates = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    return ctx.db.query("document_templates").collect();
  },
});

// ==================== Template editing ====================

export const updateTemplate = mutation({
  args: {
    id: v.id("document_templates"),
    title_ar: v.optional(v.string()),
    title_en: v.optional(v.string()),
    body_ar: v.optional(v.string()),
    body_en: v.optional(v.string()),
    bilingual_layout: v.optional(
      v.union(
        v.literal("SIDE_BY_SIDE"),
        v.literal("AR_ONLY"),
        v.literal("EN_ONLY"),
      ),
    ),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Template not found");
    const { id, ...rest } = args;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) return id;
    await ctx.db.patch(id, patch);
    await logAction(ctx, {
      action: "document_template.update",
      target_type: "document_template",
      target_id: id,
      details: {
        key: existing.key,
        fields: Object.keys(patch),
        admin_id: admin._id,
      },
    });
    return id;
  },
});

export const listForTarget = query({
  args: {
    target_type: v.string(),
    target_id: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    // Light access control: clients can only see docs for entities they
    // own. Admin sees everything. Suppliers see their orders' docs.
    const docs = await ctx.db
      .query("generated_documents")
      .withIndex("by_target", (q) =>
        q.eq("target_type", args.target_type).eq("target_id", args.target_id),
      )
      .order("desc")
      .collect();
    // ADMIN + AUDITOR (PRD §13.4) see all generated documents; others are
    // scoped to entities they own.
    if (profile.role === "ADMIN" || profile.role === "AUDITOR") return docs;
    // Verify ownership for non-admins.
    if (args.target_type === "order") {
      const order = await ctx.db.get(args.target_id as Id<"orders">);
      if (!order) return [];
      if (order.client_id !== profile._id && order.supplier_id !== profile._id) {
        return [];
      }
    } else if (args.target_type === "client_invoice") {
      const inv = await ctx.db.get(args.target_id as Id<"client_invoices">);
      if (!inv || inv.client_id !== profile._id) return [];
    } else if (args.target_type === "grn") {
      const grn = await ctx.db.get(args.target_id as Id<"goods_receipt_notes">);
      if (!grn) return [];
      if (grn.client_id !== profile._id && grn.supplier_id !== profile._id) {
        return [];
      }
    } else if (args.target_type === "quote") {
      const quote = await ctx.db.get(args.target_id as Id<"quotes">);
      if (!quote) return [];
      const rfq = await ctx.db.get(quote.rfq_id);
      if (!rfq) return [];
      if (rfq.client_id !== profile._id && quote.supplier_id !== profile._id) {
        return [];
      }
    }
    return docs;
  },
});

export const getById = query({
  args: { id: v.id("generated_documents") },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    const doc = await ctx.db.get(args.id);
    if (!doc) return null;
    if (profile.role === "ADMIN" || profile.role === "AUDITOR") return doc;
    if (doc.target_type === "order") {
      const order = await ctx.db.get(doc.target_id as Id<"orders">);
      if (!order) return null;
      if (
        order.client_id !== profile._id &&
        order.supplier_id !== profile._id
      ) {
        return null;
      }
    }
    return doc;
  },
});

// ==================== Generation ====================

const buildOrderContext = async (ctx: any, orderId: Id<"orders">) => {
  const order: any = await ctx.db.get(orderId);
  if (!order) throw new ConvexError("Order not found");
  const [client, supplier] = await Promise.all([
    ctx.db.get(order.client_id),
    ctx.db.get(order.supplier_id),
  ]);

  // Quote items become document line items. Pull rfq_item for the human
  // name + quantity.
  const quoteItems = await ctx.db
    .query("quote_items")
    .withIndex("by_quote", (q: any) => q.eq("quote_id", order.quote_id))
    .collect();
  const items = await Promise.all(
    quoteItems
      .filter((qi: any) => qi.is_quoted)
      .map(async (qi: any) => {
        const rfqItem = await ctx.db.get(qi.rfq_item_id);
        const product = rfqItem?.product_id ? await ctx.db.get(rfqItem.product_id) : null;
        const qty = rfqItem?.quantity ?? 1;
        const unit = qi.final_price_with_vat ?? 0;
        return {
          name: product?.name ?? rfqItem?.custom_item_description ?? "Item",
          quantity: qty,
          unit_price: unit.toFixed(2),
          line_total: (unit * qty).toFixed(2),
        };
      }),
  );

  // Client stamp (PRD §6.5) — embedded as a URL ready for <img src=…>
  const stampUrl = (client as any)?.stamp_storage_id
    ? await ctx.storage.getUrl((client as any).stamp_storage_id)
    : null;

  // Approver signatures (PRD §6.6.3) — pull every APPROVED step decision
  // tied to this order's quote, in approval order. Each carries a
  // snapshotted signature_storage_id which we resolve to a URL here.
  const approvalRequest = await ctx.db
    .query("approval_requests")
    .withIndex("by_quote", (q: any) => q.eq("quote_id", order.quote_id))
    .unique();
  const signatures: Array<{
    label: string;
    approver_public_id?: string;
    decided_at?: string;
    url?: string;
  }> = [];
  if (approvalRequest) {
    const decisions = await ctx.db
      .query("approval_step_decisions")
      .withIndex("by_request", (q: any) => q.eq("request_id", approvalRequest._id))
      .collect();
    const approved = decisions
      .filter((d: any) => d.status === "APPROVED")
      .sort((a: any, b: any) => (a.decided_at ?? 0) - (b.decided_at ?? 0));
    for (const d of approved) {
      const approver = d.decided_by ? await ctx.db.get(d.decided_by) : null;
      const url = d.signature_storage_id
        ? await ctx.storage.getUrl(d.signature_storage_id)
        : null;
      signatures.push({
        label: d.label,
        approver_public_id: (approver as any)?.public_id,
        decided_at: d.decided_at
          ? new Date(d.decided_at).toISOString().slice(0, 10)
          : undefined,
        url: url ?? undefined,
      });
    }
  }

  return {
    order: {
      public_id: String(orderId).slice(0, 8),
      issue_date: new Date(order._creationTime).toISOString().slice(0, 10),
      subtotal: (order.total_before_vat ?? 0).toFixed(2),
      vat_amount: ((order.total_with_vat ?? 0) - (order.total_before_vat ?? 0)).toFixed(2),
      total_with_vat: (order.total_with_vat ?? 0).toFixed(2),
      notes: order.notes,
    },
    client: {
      legal_name_ar: (client as any)?.legal_name_ar ?? (client as any)?.company_name,
      legal_name_en: (client as any)?.legal_name_en ?? (client as any)?.company_name,
      cr_number: (client as any)?.cr_number,
      vat_number: (client as any)?.vat_number,
    },
    supplier: {
      legal_name_ar: (supplier as any)?.legal_name_ar ?? (supplier as any)?.company_name,
      legal_name_en: (supplier as any)?.legal_name_en ?? (supplier as any)?.company_name,
      cr_number: (supplier as any)?.cr_number,
    },
    items,
    stamp: stampUrl ? { url: stampUrl } : undefined,
    signatures,
  };
};

const renderForTemplate = (
  template: any,
  context: any,
  language: "ar" | "en" | "bilingual",
): { title: string; html: string } => {
  if (language === "bilingual" && template.bilingual_layout === "SIDE_BY_SIDE") {
    return {
      title: template.title_en,
      html: bilingualWrapper({
        titleAr: template.title_ar,
        titleEn: template.title_en,
        bodyAr: renderTemplate(template.body_ar, context),
        bodyEn: renderTemplate(template.body_en, context),
      }),
    };
  }
  if (language === "ar") {
    return {
      title: template.title_ar,
      html: singleLanguageWrapper({
        title: template.title_ar,
        body: renderTemplate(template.body_ar, context),
        dir: "rtl",
      }),
    };
  }
  return {
    title: template.title_en,
    html: singleLanguageWrapper({
      title: template.title_en,
      body: renderTemplate(template.body_en, context),
      dir: "ltr",
    }),
  };
};

const findTemplate = async (ctx: any, key: string) => {
  const t = await ctx.db
    .query("document_templates")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .unique();
  if (!t) {
    throw new ConvexError(
      `Template "${key}" not found. Run documents.seed from the Convex dashboard to install defaults.`,
    );
  }
  return t;
};

const nextVersion = async (
  ctx: any,
  targetType: string,
  targetId: string,
): Promise<number> => {
  const existing = await ctx.db
    .query("generated_documents")
    .withIndex("by_target", (q: any) =>
      q.eq("target_type", targetType).eq("target_id", targetId),
    )
    .collect();
  return existing.length + 1;
};

/**
 * Cross-stamp the latest document id + hash onto the source entity (PRD §10.3).
 * Lets list pages and the source entity's UI flag tampering at a glance —
 * if the artifact's recomputed hash no longer matches the stamped one, the
 * artifact has drifted from the rendered output.
 */
const crossStamp = async (
  ctx: any,
  targetType: string,
  targetId: string,
  generatedDocId: Id<"generated_documents">,
  contentHash: string,
) => {
  const patch = {
    latest_document_id: generatedDocId,
    latest_document_hash: contentHash,
    latest_document_at: Date.now(),
  };
  if (targetType === "order") {
    await ctx.db.patch(targetId as Id<"orders">, patch);
  } else if (targetType === "client_invoice") {
    await ctx.db.patch(targetId as Id<"client_invoices">, patch);
  } else if (targetType === "quote") {
    await ctx.db.patch(targetId as Id<"quotes">, patch);
  } else if (targetType === "grn") {
    await ctx.db.patch(targetId as Id<"goods_receipt_notes">, patch);
  }
};

const persistGeneratedDocument = async (
  ctx: any,
  args: {
    template: any;
    targetType: string;
    targetId: string;
    language: "ar" | "en" | "bilingual";
    context: any;
    generatedBy: Id<"profiles">;
    notes?: string;
  },
) => {
  const { title, html } = renderForTemplate(args.template, args.context, args.language);
  const content_hash = await sha256(html);
  const version = await nextVersion(ctx, args.targetType, args.targetId);
  const id = await ctx.db.insert("generated_documents", {
    template_key: args.template.key,
    target_type: args.targetType,
    target_id: args.targetId,
    version,
    language: args.language,
    title,
    content_html: html,
    content_hash,
    generated_by: args.generatedBy,
    notes: args.notes,
  });
  await crossStamp(ctx, args.targetType, args.targetId, id, content_hash);
  await logAction(ctx, {
    action: "document.generate",
    target_type: "generated_document",
    target_id: id,
    after: { version },
    details: {
      template_key: args.template.key,
      target: { type: args.targetType, id: args.targetId },
      language: args.language,
      content_hash,
    },
  });
  return { id, version, content_hash };
};

export const generateForOrder = mutation({
  args: {
    order_id: v.id("orders"),
    language: v.optional(
      v.union(v.literal("ar"), v.literal("en"), v.literal("bilingual")),
    ),
    template_key: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const template = await findTemplate(ctx, args.template_key ?? "client_po");
    const context = await buildOrderContext(ctx, args.order_id);
    return persistGeneratedDocument(ctx, {
      template,
      targetType: "order",
      targetId: String(args.order_id),
      language: args.language ?? "bilingual",
      context,
      generatedBy: admin._id,
      notes: args.notes?.trim() || undefined,
    });
  },
});

// ==================== Invoice ====================

const buildInvoiceContext = async (ctx: any, invoiceId: Id<"client_invoices">) => {
  const invoice: any = await ctx.db.get(invoiceId);
  if (!invoice) throw new ConvexError("Invoice not found");
  const client = await ctx.db.get(invoice.client_id);
  return {
    invoice: {
      invoice_number: invoice.invoice_number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      subtotal: (invoice.subtotal ?? 0).toFixed(2),
      vat_amount: (invoice.vat_amount ?? 0).toFixed(2),
      total_amount: (invoice.total_amount ?? 0).toFixed(2),
      notes: invoice.notes,
    },
    client: {
      legal_name_ar: (client as any)?.legal_name_ar ?? (client as any)?.company_name,
      legal_name_en: (client as any)?.legal_name_en ?? (client as any)?.company_name,
      cr_number: (client as any)?.cr_number,
      vat_number: (client as any)?.vat_number,
    },
    zatca: {
      uuid: invoice.zatca_uuid,
      status: invoice.zatca_status,
    },
  };
};

export const generateForInvoice = mutation({
  args: {
    invoice_id: v.id("client_invoices"),
    language: v.optional(
      v.union(v.literal("ar"), v.literal("en"), v.literal("bilingual")),
    ),
    template_key: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const template = await findTemplate(ctx, args.template_key ?? "client_invoice");
    const context = await buildInvoiceContext(ctx, args.invoice_id);
    return persistGeneratedDocument(ctx, {
      template,
      targetType: "client_invoice",
      targetId: String(args.invoice_id),
      language: args.language ?? "bilingual",
      context,
      generatedBy: admin._id,
      notes: args.notes?.trim() || undefined,
    });
  },
});

// ==================== GRN ====================

const buildGrnContext = async (ctx: any, grnId: Id<"goods_receipt_notes">) => {
  const grn: any = await ctx.db.get(grnId);
  if (!grn) throw new ConvexError("GRN not found");
  const [client, supplier] = await Promise.all([
    ctx.db.get(grn.client_id),
    ctx.db.get(grn.supplier_id),
  ]);
  const lines = await ctx.db
    .query("grn_lines")
    .withIndex("by_grn", (q: any) => q.eq("grn_id", grnId))
    .collect();
  return {
    grn: {
      grn_number: grn.grn_number,
      received_at: new Date(grn.received_at).toISOString().slice(0, 10),
      has_discrepancy: grn.has_discrepancy,
      discrepancy_summary: grn.discrepancy_summary,
      resolution: grn.resolution,
    },
    order: {
      short_id: String(grn.order_id).slice(0, 8),
    },
    client: {
      legal_name_ar: (client as any)?.legal_name_ar ?? (client as any)?.company_name,
      legal_name_en: (client as any)?.legal_name_en ?? (client as any)?.company_name,
    },
    supplier: {
      legal_name_ar: (supplier as any)?.legal_name_ar ?? (supplier as any)?.company_name,
      legal_name_en: (supplier as any)?.legal_name_en ?? (supplier as any)?.company_name,
    },
    lines: lines.map((l: any) => ({
      description: l.description,
      ordered_qty: l.ordered_qty,
      received_qty: l.received_qty,
      condition: l.condition,
      notes: l.notes ?? "",
    })),
  };
};

export const generateForGrn = mutation({
  args: {
    grn_id: v.id("goods_receipt_notes"),
    language: v.optional(
      v.union(v.literal("ar"), v.literal("en"), v.literal("bilingual")),
    ),
    template_key: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const template = await findTemplate(ctx, args.template_key ?? "supplier_grn");
    const context = await buildGrnContext(ctx, args.grn_id);
    return persistGeneratedDocument(ctx, {
      template,
      targetType: "grn",
      targetId: String(args.grn_id),
      language: args.language ?? "bilingual",
      context,
      generatedBy: admin._id,
      notes: args.notes?.trim() || undefined,
    });
  },
});

// ==================== Quote ====================

const buildQuoteContext = async (ctx: any, quoteId: Id<"quotes">) => {
  const quote: any = await ctx.db.get(quoteId);
  if (!quote) throw new ConvexError("Quote not found");
  const rfq: any = await ctx.db.get(quote.rfq_id);
  const client = rfq?.client_id ? await ctx.db.get(rfq.client_id) : null;
  const quoteItems = await ctx.db
    .query("quote_items")
    .withIndex("by_quote", (q: any) => q.eq("quote_id", quoteId))
    .collect();
  let subtotal = 0;
  let total = 0;
  const items = await Promise.all(
    quoteItems
      .filter((qi: any) => qi.is_quoted)
      .map(async (qi: any) => {
        const rfqItem = await ctx.db.get(qi.rfq_item_id);
        const product = rfqItem?.product_id ? await ctx.db.get(rfqItem.product_id) : null;
        const qty = rfqItem?.quantity ?? 1;
        const unitBefore = qi.final_price_before_vat ?? 0;
        const unit = qi.final_price_with_vat ?? 0;
        subtotal += unitBefore * qty;
        total += unit * qty;
        return {
          name: product?.name ?? rfqItem?.custom_item_description ?? "Item",
          quantity: qty,
          unit_price: unit.toFixed(2),
          line_total: (unit * qty).toFixed(2),
        };
      }),
  );
  return {
    quote: {
      short_id: String(quoteId).slice(0, 8),
      rfq_short_id: String(quote.rfq_id).slice(0, 8),
      status: quote.status,
      supplier_notes: quote.supplier_notes,
      subtotal: subtotal.toFixed(2),
      vat_amount: (total - subtotal).toFixed(2),
      total_with_vat: total.toFixed(2),
    },
    client: {
      legal_name_ar: (client as any)?.legal_name_ar ?? (client as any)?.company_name,
      legal_name_en: (client as any)?.legal_name_en ?? (client as any)?.company_name,
    },
    items,
  };
};

export const generateForQuote = mutation({
  args: {
    quote_id: v.id("quotes"),
    language: v.optional(
      v.union(v.literal("ar"), v.literal("en"), v.literal("bilingual")),
    ),
    template_key: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const template = await findTemplate(ctx, args.template_key ?? "client_quote");
    const context = await buildQuoteContext(ctx, args.quote_id);
    return persistGeneratedDocument(ctx, {
      template,
      targetType: "quote",
      targetId: String(args.quote_id),
      language: args.language ?? "bilingual",
      context,
      generatedBy: admin._id,
      notes: args.notes?.trim() || undefined,
    });
  },
});

export const seed = mutation({
  // Admin-callable wrapper around the internal seed for first-time setup.
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    let inserted = 0;
    for (const t of DEFAULT_TEMPLATES) {
      const existing = await ctx.db
        .query("document_templates")
        .withIndex("by_key", (q) => q.eq("key", t.key))
        .unique();
      if (existing) continue;
      await ctx.db.insert("document_templates", { ...t, is_default: true });
      inserted++;
    }
    await logAction(ctx, {
      action: "document_template.seed",
      target_type: "document_template",
      details: { inserted, admin_id: admin._id },
    });
    return { inserted, total: DEFAULT_TEMPLATES.length };
  },
});

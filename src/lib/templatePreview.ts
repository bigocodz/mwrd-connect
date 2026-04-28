/**
 * Client-side mirror of convex/documentRenderer.ts's `renderTemplate`. Used
 * by the admin template editor to show a live preview while authoring.
 *
 * Keep in sync with the server-side implementation when adding directives.
 */

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const resolvePath = (ctx: any, path: string): unknown => {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: any = ctx;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

const stringify = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
};

export function renderTemplatePreview(body: string, context: any): string {
  let out = body;
  out = out.replace(
    /\{\{#each\s+([\w.]+)\s+as\s+\|(\w+)\|\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_match, path, varName, inner) => {
      const arr = resolvePath(context, path);
      if (!Array.isArray(arr)) return "";
      return arr
        .map((item) =>
          renderTemplatePreview(inner, { ...context, [varName]: item }),
        )
        .join("");
    },
  );
  out = out.replace(
    /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, path, inner) => {
      const v = resolvePath(context, path);
      const truthy = Array.isArray(v) ? v.length > 0 : Boolean(v);
      return truthy ? renderTemplatePreview(inner, context) : "";
    },
  );
  out = out.replace(/\{\{\{([\w.]+)\}\}\}/g, (_match, path) =>
    stringify(resolvePath(context, path)),
  );
  out = out.replace(/\{\{([\w.]+)\}\}/g, (_match, path) =>
    escapeHtml(stringify(resolvePath(context, path))),
  );
  return out;
}

/**
 * Sample contexts for preview. Each template_key (or notification event_type)
 * gets a set of plausible variables so the editor can render a realistic
 * preview without needing a real entity to bind against.
 */
export const SAMPLE_DOCUMENT_CONTEXTS: Record<string, any> = {
  client_po: {
    order: {
      public_id: "abc12345",
      issue_date: "2026-04-15",
      subtotal: "10000.00",
      vat_amount: "1500.00",
      total_with_vat: "11500.00",
      notes: "Deliver to receiving dock B before 4 PM",
    },
    client: {
      legal_name_ar: "شركة المثال للتجارة",
      legal_name_en: "Example Trading Co.",
      cr_number: "1010203040",
      vat_number: "300123456789003",
    },
    supplier: {
      legal_name_ar: "مورد العينة المحدودة",
      legal_name_en: "Sample Supplier Ltd.",
      cr_number: "1010987654",
    },
    items: [
      { name: "Office chair", quantity: 10, unit_price: "500.00", line_total: "5000.00" },
      { name: "Standing desk", quantity: 5, unit_price: "1000.00", line_total: "5000.00" },
    ],
  },
  client_invoice: {
    invoice: {
      invoice_number: "MWRD-2026-0042",
      issue_date: "2026-04-15",
      due_date: "2026-05-15",
      subtotal: "10000.00",
      vat_amount: "1500.00",
      total_amount: "11500.00",
      notes: "Net 30 payment terms",
    },
    client: {
      legal_name_ar: "شركة المثال للتجارة",
      legal_name_en: "Example Trading Co.",
      cr_number: "1010203040",
      vat_number: "300123456789003",
    },
    zatca: {
      uuid: "550e8400-e29b-41d4-a716-446655440000",
      status: "CLEARED",
    },
  },
  supplier_grn: {
    grn: {
      grn_number: "MWRD-GRN-2026-0007",
      received_at: "2026-04-15",
      has_discrepancy: true,
      discrepancy_summary: "Two units arrived damaged",
      resolution: "",
    },
    order: { short_id: "abc12345" },
    client: {
      legal_name_ar: "شركة المثال للتجارة",
      legal_name_en: "Example Trading Co.",
    },
    supplier: {
      legal_name_ar: "مورد العينة المحدودة",
      legal_name_en: "Sample Supplier Ltd.",
    },
    lines: [
      { description: "Office chair", ordered_qty: 10, received_qty: 8, condition: "DAMAGED", notes: "2 units cracked" },
      { description: "Standing desk", ordered_qty: 5, received_qty: 5, condition: "GOOD", notes: "" },
    ],
  },
  client_quote: {
    quote: {
      short_id: "qte98765",
      rfq_short_id: "rfq11223",
      status: "SENT_TO_CLIENT",
      supplier_notes: "Lead time 7-10 days from PO acceptance",
      subtotal: "9500.00",
      vat_amount: "1425.00",
      total_with_vat: "10925.00",
    },
    client: {
      legal_name_ar: "شركة المثال للتجارة",
      legal_name_en: "Example Trading Co.",
    },
    items: [
      { name: "Office chair", quantity: 10, unit_price: "475.00", line_total: "4750.00" },
      { name: "Standing desk", quantity: 5, unit_price: "950.00", line_total: "4750.00" },
    ],
  },
};

export const SAMPLE_NOTIFICATION_CONTEXT = {
  title: "New invoice MWRD-2026-0042",
  message: "An invoice for SAR 11,500.00 is now available in your account.",
  link: "https://app.mwrd.sa/client/invoices",
  event_type: "invoice.issued",
};

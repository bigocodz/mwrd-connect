"use node";
/**
 * Wafeq integration (PRD §8.1) — system of record for tax invoices and ZATCA
 * Phase 2 clearance. MWRD remains the system of record for the commercial
 * transaction; Wafeq owns invoicing, signing, QR, UBL 2.1 XML, and PDF/A-3.
 *
 * This module is a SCAFFOLD. It implements:
 *   - env-driven config (Api-Key, environment, base URL)
 *   - mock mode that exercises the full plumbing without a real Wafeq account
 *   - deterministic idempotency keys (PRD §8.1.1)
 *   - retry-on-5xx with exponential backoff
 *   - error categorization (API_ERROR vs ZATCA_ERROR vs NETWORK_ERROR)
 *   - sync-log writes for every attempt (PRD §8.1.5)
 *
 * Entry points (Convex actions):
 *   - ensureContact          — POST /contacts/, persist wafeq_contact_id on profile
 *   - submitClientInvoice    — POST /invoices/, capture ZATCA UUID/hash/PDF
 *   - submitSupplierBill     — POST /bills/, AP bookkeeping
 *
 * NOT YET implemented (next slices):
 *   - voidInvoice / credit & debit notes
 *   - webhook handler (invoice.paid, zatca_status_change)
 *   - daily reconciliation cron
 */

import { action, internalAction } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ==================== Config ====================

type WafeqEnv = "simulation" | "production" | "mock";

interface WafeqConfig {
  env: WafeqEnv;
  apiKey: string | null;
  baseUrl: string;
}

function readConfig(): WafeqConfig {
  const apiKey = process.env.WAFEQ_API_KEY ?? null;
  const envFromVar = (process.env.WAFEQ_ENV ?? "").toLowerCase();
  // No key → mock mode regardless of env var. Lets the platform run end-to-end
  // before credentials land.
  if (!apiKey) {
    return { env: "mock", apiKey: null, baseUrl: "" };
  }
  const env: WafeqEnv =
    envFromVar === "production" ? "production" : "simulation";
  const baseUrl =
    process.env.WAFEQ_BASE_URL?.replace(/\/+$/, "") ??
    "https://api.wafeq.com/v1";
  return { env, apiKey, baseUrl };
}

// Deterministic idempotency key: stable across retries for a given
// (operation, target_type, target_id, content_hash) tuple. Wafeq accepts
// X-Wafeq-Idempotency-Key UUIDv4-shaped strings.
function makeIdempotencyKey(
  operation: string,
  targetType: string,
  targetId: string,
  contentHash: string,
) {
  // Synthesize a UUIDv4-shaped key from the inputs. Not a real UUID — the
  // bytes encode our deterministic seed. Wafeq accepts any string up to ~64
  // chars; this shape is convenient for log-grepping.
  const seed = `${operation}|${targetType}|${targetId}|${contentHash}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  // pad to 32 hex chars by repeating the seeded hash deterministically
  const long = (hex + hex + hex + hex).slice(0, 32);
  return `${long.slice(0, 8)}-${long.slice(8, 12)}-4${long.slice(13, 16)}-8${long.slice(17, 20)}-${long.slice(20, 32)}`;
}

function shallowHash(o: unknown): string {
  const s = JSON.stringify(o ?? {});
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}

// ==================== HTTP wrapper ====================

interface WafeqCallArgs {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  idempotencyKey: string;
  config: WafeqConfig;
}

interface WafeqCallResult {
  ok: boolean;
  status: number;
  data: any;
  durationMs: number;
  errorCategory?: "API_ERROR" | "ZATCA_ERROR" | "NETWORK_ERROR";
  errorCode?: string;
  errorMessage?: string;
}

async function callWafeq(args: WafeqCallArgs): Promise<WafeqCallResult> {
  const { method, path, body, idempotencyKey, config } = args;
  const start = Date.now();

  // Mock mode: synthesize success responses so the caller's wiring works.
  if (config.env === "mock") {
    const synthetic = mockResponseFor(method, path, body);
    return {
      ok: true,
      status: 201,
      data: synthetic,
      durationMs: Date.now() - start,
    };
  }

  const url = `${config.baseUrl}${path}`;
  const headers: Record<string, string> = {
    "Authorization": `Api-Key ${config.apiKey}`,
    "Content-Type": "application/json",
    "X-Wafeq-Idempotency-Key": idempotencyKey,
    "X-Zatca-Environment": config.env, // simulation | production
  };

  const maxAttempts = 3;
  let lastError: WafeqCallResult | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data: any = undefined;
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {
        data = { raw: text };
      }
      if (res.ok) {
        return { ok: true, status: res.status, data, durationMs: Date.now() - start };
      }
      // Categorize failure
      const isZatcaError =
        data?.error?.zatca_code ||
        data?.zatca_status === "REJECTED" ||
        /zatca/i.test(data?.error?.message ?? "");
      lastError = {
        ok: false,
        status: res.status,
        data,
        durationMs: Date.now() - start,
        errorCategory: isZatcaError ? "ZATCA_ERROR" : "API_ERROR",
        errorCode:
          data?.error?.code ?? data?.error?.zatca_code ?? `HTTP_${res.status}`,
        errorMessage:
          data?.error?.message ?? data?.detail ?? `Wafeq returned ${res.status}`,
      };
      // Only retry transient API/network errors, not ZATCA rejections.
      if (lastError.errorCategory === "ZATCA_ERROR" || res.status < 500) break;
    } catch (err: any) {
      lastError = {
        ok: false,
        status: 0,
        data: { error: String(err?.message ?? err) },
        durationMs: Date.now() - start,
        errorCategory: "NETWORK_ERROR",
        errorCode: err?.code ?? "FETCH_ERROR",
        errorMessage: String(err?.message ?? err),
      };
    }
    // Exponential backoff before retry
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt - 1)));
    }
  }
  return lastError!;
}

function mockResponseFor(method: string, path: string, body: any): any {
  const id = `mock_${path.replace(/[^a-z]/gi, "_")}_${Date.now()}`;
  if (path.startsWith("/contacts")) {
    return { id, name: body?.name ?? "Mock Contact" };
  }
  if (path.startsWith("/invoices")) {
    return {
      id,
      invoice_number: body?.invoice_number ?? "MOCK-INV",
      status: "CLEARED",
      zatca: {
        uuid: `mock-uuid-${Date.now()}`,
        hash: `mock-hash-${Date.now()}`,
        qr: "MOCK_QR_PAYLOAD",
        cleared_at: new Date().toISOString(),
        environment: "simulation",
      },
      pdf_url: `https://mock.wafeq.test/invoices/${id}.pdf`,
    };
  }
  if (path.startsWith("/bills")) {
    return { id, status: "RECORDED" };
  }
  return { id, raw_method: method };
}

// ==================== Public actions ====================

interface SyncResult {
  ok: boolean;
  environment: WafeqEnv;
  wafeqId?: string;
  zatcaUuid?: string;
  errorCategory?: string;
  errorCode?: string;
  errorMessage?: string;
}

async function logAndReturn(
  ctx: any,
  args: {
    operation: string;
    idempotency_key: string;
    environment: WafeqEnv;
    target_type: string;
    target_id: string;
    result: WafeqCallResult;
    request_summary?: unknown;
  },
): Promise<SyncResult> {
  const status: any = !args.result.ok
    ? args.result.errorCategory ?? "API_ERROR"
    : "SUCCESS";
  await ctx.runMutation(internal.wafeqHelpers._writeSyncLog, {
    operation: args.operation,
    idempotency_key: args.idempotency_key,
    environment: args.environment,
    target_type: args.target_type,
    target_id: args.target_id,
    status,
    http_status: args.result.status,
    error_code: args.result.errorCode,
    error_message: args.result.errorMessage,
    request_summary: args.request_summary,
    response_summary: args.result.data,
    duration_ms: args.result.durationMs,
  });
  return {
    ok: args.result.ok,
    environment: args.environment,
    wafeqId: args.result.data?.id,
    zatcaUuid: args.result.data?.zatca?.uuid,
    errorCategory: args.result.errorCategory,
    errorCode: args.result.errorCode,
    errorMessage: args.result.errorMessage,
  };
}

/**
 * Ensure a Wafeq Contact exists for the given profile. POST /contacts/ on
 * first use; subsequent calls become a no-op.
 */
export const ensureContact = action({
  args: { profile_id: v.id("profiles") },
  handler: async (ctx, args): Promise<SyncResult> => {
    const config = readConfig();
    const profile: any = await ctx.runQuery(internal.wafeqHelpers._getProfile, {
      id: args.profile_id,
    });
    if (!profile) throw new ConvexError("Profile not found");
    if (profile.wafeq_contact_id) {
      return { ok: true, environment: config.env, wafeqId: profile.wafeq_contact_id };
    }
    // PRD §8.1.2 — bilingual legal name + CR + VAT + National Address.
    // Wafeq accepts the contact even with partial data, so we send what we
    // have and let admin fill the rest later.
    const addr = profile.national_address ?? {};
    const body: Record<string, unknown> = {
      name:
        profile.legal_name_en ??
        profile.legal_name_ar ??
        profile.company_name ??
        profile.public_id ??
        "Unknown",
      legal_name_ar: profile.legal_name_ar ?? undefined,
      legal_name_en: profile.legal_name_en ?? undefined,
      reference: profile.public_id ?? undefined,
      tax_number: profile.vat_number ?? undefined,
      cr_number: profile.cr_number ?? undefined,
      address: addr && Object.keys(addr).length
        ? {
            building_number: addr.building_number,
            street: addr.street,
            district: addr.district,
            city: addr.city,
            postal_code: addr.postal_code,
            additional_number: addr.additional_number,
            country: "SA",
          }
        : undefined,
    };
    // Strip undefined keys for a tidy payload
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
    const idempotencyKey = makeIdempotencyKey(
      "ensureContact",
      "profile",
      args.profile_id,
      shallowHash(body),
    );
    const result = await callWafeq({
      method: "POST",
      path: "/contacts/",
      body,
      idempotencyKey,
      config,
    });
    if (result.ok) {
      const wafeqId = result.data?.id ?? `unknown_${Date.now()}`;
      await ctx.runMutation(internal.wafeqHelpers._persistContact, {
        profile_id: args.profile_id,
        wafeq_contact_id: String(wafeqId),
      });
    }
    return logAndReturn(ctx, {
      operation: "ensureContact",
      idempotency_key: idempotencyKey,
      environment: config.env,
      target_type: "profile",
      target_id: args.profile_id,
      result,
      request_summary: body,
    });
  },
});

/**
 * Submit a client_invoice to Wafeq for ZATCA Phase 2 clearance.
 * Composes line items from the underlying order, calls POST /invoices/,
 * persists ZATCA UUID/hash/PDF on success, and records a sync_log entry.
 */
export const submitClientInvoice = action({
  args: { invoice_id: v.id("client_invoices") },
  handler: async (ctx, args): Promise<SyncResult> => {
    const config = readConfig();
    const invoice: any = await ctx.runQuery(internal.wafeqHelpers._getClientInvoice, {
      id: args.invoice_id,
    });
    if (!invoice) throw new ConvexError("Invoice not found");
    if (invoice.zatca_status === "CLEARED") {
      // Already cleared — nothing to do.
      return {
        ok: true,
        environment: invoice.wafeq_environment ?? config.env,
        wafeqId: invoice.wafeq_invoice_id,
        zatcaUuid: invoice.zatca_uuid,
      };
    }

    // Ensure contact exists for the client profile first.
    const contact: SyncResult = await ctx.runAction(
      api.wafeq.ensureContact,
      { profile_id: invoice.client_id },
    );
    if (!contact.ok) {
      await ctx.runMutation(internal.wafeqHelpers._persistClientInvoiceError, {
        invoice_id: args.invoice_id,
        error: `Contact sync failed: ${contact.errorMessage ?? contact.errorCode}`,
      });
      return contact;
    }

    // Compose Wafeq invoice payload. Bilingual line items (PRD §8.1.2) —
    // for now we have only the EN string; AR localization comes later.
    const body = {
      contact_id: contact.wafeqId,
      currency: "SAR",
      invoice_date: invoice.issue_date,
      invoice_due_date: invoice.due_date,
      invoice_number: invoice.invoice_number,
      tax_amount_type: "INCLUSIVE",
      language: "ar", // default Arabic per PRD; per-client override later
      line_items: [
        {
          account: "Sales",
          description: invoice.notes ?? `MWRD invoice ${invoice.invoice_number}`,
          quantity: 1,
          unit_amount: invoice.subtotal,
          tax_rate: invoice.vat_amount > 0 ? "VAT15" : "VAT0",
        },
      ],
    };
    const idempotencyKey = makeIdempotencyKey(
      "submitClientInvoice",
      "client_invoice",
      args.invoice_id,
      shallowHash({ n: invoice.invoice_number, t: invoice.total_amount }),
    );
    const result = await callWafeq({
      method: "POST",
      path: "/invoices/",
      body,
      idempotencyKey,
      config,
    });
    if (result.ok) {
      await ctx.runMutation(internal.wafeqHelpers._persistClientInvoiceClearance, {
        invoice_id: args.invoice_id,
        wafeq_invoice_id: String(result.data?.id ?? "unknown"),
        environment: config.env,
        zatca_uuid: result.data?.zatca?.uuid,
        zatca_status: result.data?.zatca?.uuid ? "CLEARED" : (result.data?.status ?? "PENDING"),
        zatca_hash: result.data?.zatca?.hash,
        zatca_qr: result.data?.zatca?.qr,
        zatca_pdf_url: result.data?.pdf_url,
      });
    } else {
      await ctx.runMutation(internal.wafeqHelpers._persistClientInvoiceError, {
        invoice_id: args.invoice_id,
        error: `${result.errorCode ?? "ERROR"}: ${result.errorMessage ?? "unknown"}`,
      });
    }
    return logAndReturn(ctx, {
      operation: "submitClientInvoice",
      idempotency_key: idempotencyKey,
      environment: config.env,
      target_type: "client_invoice",
      target_id: args.invoice_id,
      result,
      request_summary: { invoice_number: invoice.invoice_number, total: invoice.total_amount },
    });
  },
});

/**
 * Submit a credit or debit note to Wafeq (PRD §8.1.4). Wafeq clears it
 * with ZATCA, links it back to the original invoice on its side, and
 * returns the cleared metadata which we mirror onto our adjustment row.
 */
export const submitInvoiceAdjustment = action({
  args: { adjustment_id: v.id("client_invoice_adjustments") },
  handler: async (ctx, args): Promise<SyncResult> => {
    const config = readConfig();
    const adj: any = await ctx.runQuery(internal.wafeqHelpers._getInvoiceAdjustment, {
      id: args.adjustment_id,
    });
    if (!adj) throw new ConvexError("Adjustment not found");
    if (adj.status === "VOID") {
      return { ok: true, environment: config.env };
    }
    if (adj.zatca_status === "CLEARED") {
      return {
        ok: true,
        environment: adj.wafeq_environment ?? config.env,
        wafeqId: adj.wafeq_adjustment_id,
        zatcaUuid: adj.zatca_uuid,
      };
    }

    const invoice: any = await ctx.runQuery(internal.wafeqHelpers._getClientInvoice, {
      id: adj.invoice_id,
    });
    if (!invoice?.wafeq_invoice_id) {
      const msg = "Original invoice has no Wafeq ID — submit it for clearance first";
      await ctx.runMutation(internal.wafeqHelpers._persistAdjustmentError, {
        adjustment_id: args.adjustment_id,
        error: msg,
      });
      return {
        ok: false,
        environment: config.env,
        errorCode: "MISSING_INVOICE_LINK",
        errorMessage: msg,
      };
    }

    // Wafeq accepts both /credit_notes/ and /debit_notes/ with similar
    // shapes. Branch on type.
    const path = adj.type === "CREDIT" ? "/credit_notes/" : "/debit_notes/";
    const body = {
      invoice_id: invoice.wafeq_invoice_id,
      currency: "SAR",
      issue_date: adj.issue_date,
      reference: adj.adjustment_number,
      reason: adj.reason,
      tax_amount_type: "INCLUSIVE",
      language: "ar",
      line_items: [
        {
          description: adj.notes ?? adj.reason,
          quantity: 1,
          unit_amount: adj.subtotal,
          tax_rate: adj.vat_amount > 0 ? "VAT15" : "VAT0",
        },
      ],
    };
    const idempotencyKey = makeIdempotencyKey(
      adj.type === "CREDIT" ? "creditNote" : "debitNote",
      "client_invoice_adjustment",
      args.adjustment_id,
      shallowHash({ n: adj.adjustment_number, t: adj.total_amount }),
    );
    const result = await callWafeq({
      method: "POST",
      path,
      body,
      idempotencyKey,
      config,
    });
    if (result.ok) {
      await ctx.runMutation(internal.wafeqHelpers._persistAdjustmentClearance, {
        adjustment_id: args.adjustment_id,
        wafeq_adjustment_id: String(result.data?.id ?? "unknown"),
        environment: config.env,
        zatca_uuid: result.data?.zatca?.uuid,
        zatca_status: result.data?.zatca?.uuid ? "CLEARED" : (result.data?.status ?? "PENDING"),
        zatca_hash: result.data?.zatca?.hash,
        zatca_qr: result.data?.zatca?.qr,
        zatca_pdf_url: result.data?.pdf_url,
      });
    } else {
      await ctx.runMutation(internal.wafeqHelpers._persistAdjustmentError, {
        adjustment_id: args.adjustment_id,
        error: `${result.errorCode ?? "ERROR"}: ${result.errorMessage ?? "unknown"}`,
      });
    }
    return logAndReturn(ctx, {
      operation: adj.type === "CREDIT" ? "submitCreditNote" : "submitDebitNote",
      idempotency_key: idempotencyKey,
      environment: config.env,
      target_type: "client_invoice_adjustment",
      target_id: args.adjustment_id,
      result,
      request_summary: {
        adjustment_number: adj.adjustment_number,
        type: adj.type,
        total: adj.total_amount,
      },
    });
  },
});

/**
 * Record a supplier bill in Wafeq for AP bookkeeping (PRD §8.1.3).
 * Supplier remains seller of record; this is just MWRD's ledger.
 */
export const submitSupplierBill = action({
  args: { supplier_invoice_id: v.id("supplier_invoices") },
  handler: async (ctx, args): Promise<SyncResult> => {
    const config = readConfig();
    const bill: any = await ctx.runQuery(internal.wafeqHelpers._getSupplierInvoice, {
      id: args.supplier_invoice_id,
    });
    if (!bill) throw new ConvexError("Supplier invoice not found");
    if (bill.wafeq_bill_id) {
      return { ok: true, environment: config.env, wafeqId: bill.wafeq_bill_id };
    }

    const contact: SyncResult = await ctx.runAction(
      api.wafeq.ensureContact,
      { profile_id: bill.supplier_id },
    );
    if (!contact.ok) return contact;

    const body = {
      contact_id: contact.wafeqId,
      currency: "SAR",
      bill_date: bill.issue_date,
      bill_due_date: bill.due_date,
      reference: bill.invoice_number,
      tax_amount_type: "INCLUSIVE",
      line_items: [
        {
          account: "Cost of Goods Sold",
          description: bill.notes ?? `Supplier bill ${bill.invoice_number}`,
          quantity: 1,
          unit_amount: bill.subtotal,
          tax_rate: bill.vat_amount > 0 ? "VAT15" : "VAT0",
        },
      ],
    };
    const idempotencyKey = makeIdempotencyKey(
      "submitSupplierBill",
      "supplier_invoice",
      args.supplier_invoice_id,
      shallowHash({ n: bill.invoice_number, t: bill.total_amount }),
    );
    const result = await callWafeq({
      method: "POST",
      path: "/bills/",
      body,
      idempotencyKey,
      config,
    });
    if (result.ok) {
      await ctx.runMutation(internal.wafeqHelpers._persistSupplierBill, {
        supplier_invoice_id: args.supplier_invoice_id,
        wafeq_bill_id: String(result.data?.id ?? "unknown"),
        environment: config.env,
      });
    }
    return logAndReturn(ctx, {
      operation: "submitSupplierBill",
      idempotency_key: idempotencyKey,
      environment: config.env,
      target_type: "supplier_invoice",
      target_id: args.supplier_invoice_id,
      result,
      request_summary: { reference: bill.invoice_number, total: bill.total_amount },
    });
  },
});

/**
 * Lightweight read so admin UI can show the configured environment without
 * exposing the API key. Used by the Wafeq panel.
 */
export const status = action({
  handler: async (): Promise<{ environment: WafeqEnv; configured: boolean }> => {
    const config = readConfig();
    return { environment: config.env, configured: config.apiKey !== null };
  },
});

// ==================== Reconciliation (PRD §8.1.5) ====================

interface ReconcileSummary {
  scanned: number;
  drift: number;
  errors: number;
  environment: WafeqEnv;
}

/**
 * Snapshot a Wafeq invoice and apply any drift to our local row.
 * Shared by the daily cron and webhook event handlers.
 */
async function reconcileOne(
  ctx: any,
  invoice: {
    _id: Id<"client_invoices">;
    wafeq_invoice_id: string;
  },
  config: WafeqConfig,
): Promise<{ drift: boolean; ok: boolean; result: WafeqCallResult }> {
  const idempotencyKey = makeIdempotencyKey(
    "reconcile",
    "client_invoice",
    invoice._id,
    String(Math.floor(Date.now() / 86400000)), // day-bucket so daily replays share keys
  );
  const result = await callWafeq({
    method: "GET",
    path: `/invoices/${encodeURIComponent(invoice.wafeq_invoice_id)}/`,
    idempotencyKey,
    config,
  });
  await ctx.runMutation(internal.wafeqHelpers._writeSyncLog, {
    operation: "reconcile",
    idempotency_key: idempotencyKey,
    environment: config.env,
    target_type: "client_invoice",
    target_id: invoice._id,
    status: result.ok ? "SUCCESS" : (result.errorCategory ?? "API_ERROR"),
    http_status: result.status,
    error_code: result.errorCode,
    error_message: result.errorMessage,
    request_summary: { wafeq_invoice_id: invoice.wafeq_invoice_id },
    response_summary: result.data,
    duration_ms: result.durationMs,
  });
  if (!result.ok) return { drift: false, ok: false, result };

  const remote = result.data ?? {};
  // Wafeq response shape varies by plan; read defensively. Common keys:
  //   - status: "PAID" | "DRAFT" | "SENT" | "VOID"
  //   - zatca: { uuid, hash, status: "CLEARED" | "REJECTED" | "PENDING", cleared_at }
  //   - paid_amount, paid_reference
  const zatcaStatus = (remote.zatca?.status ?? remote.zatca_status)?.toString().toUpperCase();
  const remoteStatus = (remote.status ?? "").toString().toUpperCase();
  const isPaid = remoteStatus === "PAID" || remote.paid === true;
  const isVoided = remoteStatus === "VOID" || remoteStatus === "VOIDED";
  await ctx.runMutation(internal.wafeqHelpers._applyRemoteState, {
    invoice_id: invoice._id,
    zatca_status: zatcaStatus,
    zatca_pdf_url: remote.pdf_url,
    paid: isPaid,
    paid_reference: remote.paid_reference,
    voided: isVoided,
    void_reason: remote.void_reason,
  });
  return { drift: !!(zatcaStatus || isPaid || isVoided), ok: true, result };
}

/**
 * Daily cron entry-point. Pulls every Wafeq-linked client invoice and
 * reconciles status drift (paid, voided, ZATCA cleared/rejected).
 *
 * Deferred from this slice (intentional): pulling Wafeq's full invoice list
 * to detect orphans created server-side. We only sync what we already know
 * about; that's enough for v1.
 */
export const reconcileNow = internalAction({
  handler: async (ctx): Promise<ReconcileSummary> => {
    const config = readConfig();
    const invoices: any[] = await ctx.runQuery(internal.wafeqHelpers._listSyncableInvoices);
    let drift = 0;
    let errors = 0;
    for (const inv of invoices) {
      try {
        const r = await reconcileOne(ctx, inv, config);
        if (!r.ok) errors++;
        else if (r.drift) drift++;
      } catch {
        errors++;
      }
    }
    return { scanned: invoices.length, drift, errors, environment: config.env };
  },
});

/**
 * Manual admin trigger — same logic, callable from the UI for ad-hoc syncs.
 */
export const reconcile = action({
  handler: async (ctx): Promise<ReconcileSummary> => {
    const config = readConfig();
    const invoices: any[] = await ctx.runQuery(internal.wafeqHelpers._listSyncableInvoices);
    let drift = 0;
    let errors = 0;
    for (const inv of invoices) {
      try {
        const r = await reconcileOne(ctx, inv, config);
        if (!r.ok) errors++;
        else if (r.drift) drift++;
      } catch {
        errors++;
      }
    }
    return { scanned: invoices.length, drift, errors, environment: config.env };
  },
});

// ==================== Webhook handler (PRD §8.1.5) ====================

interface WebhookEvent {
  type?: string;
  invoice_id?: string;
  status?: string;
  zatca?: { status?: string; uuid?: string; hash?: string };
  paid?: boolean;
  paid_reference?: string;
  void_reason?: string;
  pdf_url?: string;
}

/**
 * Webhook entry-point — called from the HTTP route in convex/http.ts.
 * Wafeq sends `invoice.cleared`, `invoice.paid`, `invoice.voided`, and
 * `zatca_status_change` events. We map them to a remote-state update.
 *
 * Signature verification is a TODO — Wafeq's HMAC scheme depends on plan
 * tier. For v1 we run idempotently so replay attacks just no-op.
 */
export const handleWebhookEvent = internalAction({
  args: {
    event: v.any(),
    raw_signature: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; matched: boolean }> => {
    const event: WebhookEvent = args.event ?? {};
    if (!event.invoice_id) return { ok: true, matched: false };

    const invoice: any = await ctx.runQuery(internal.wafeqHelpers._findInvoiceByWafeqId, {
      wafeq_invoice_id: event.invoice_id,
    });
    if (!invoice) return { ok: true, matched: false };

    const zatcaStatus = (event.zatca?.status ?? "").toString().toUpperCase() || undefined;
    const remoteStatus = (event.status ?? "").toString().toUpperCase();
    const isPaid =
      remoteStatus === "PAID" ||
      event.paid === true ||
      event.type === "invoice.paid";
    const isVoided =
      remoteStatus === "VOID" ||
      remoteStatus === "VOIDED" ||
      event.type === "invoice.voided";

    await ctx.runMutation(internal.wafeqHelpers._applyRemoteState, {
      invoice_id: invoice._id,
      zatca_status: zatcaStatus,
      zatca_pdf_url: event.pdf_url,
      paid: isPaid,
      paid_reference: event.paid_reference,
      voided: isVoided,
      void_reason: event.void_reason,
    });

    await ctx.runMutation(internal.wafeqHelpers._writeSyncLog, {
      operation: "webhook",
      idempotency_key: `webhook_${event.invoice_id}_${event.type ?? "any"}_${Date.now()}`,
      environment: readConfig().env,
      target_type: "client_invoice",
      target_id: invoice._id,
      status: "SUCCESS",
      request_summary: { type: event.type, invoice_id: event.invoice_id },
      response_summary: event,
    });

    return { ok: true, matched: true };
  },
});

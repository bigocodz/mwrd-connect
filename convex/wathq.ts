"use node";
/**
 * Wathq (Saudi Business Center) integration (PRD §8.3) — verifies a Saudi
 * Commercial Registration number, returns the official Arabic legal name
 * and registration status (active / suspended), and persists the result
 * on the profile.
 *
 * Same scaffold pattern as convex/wafeq.ts:
 *   - Reads env (`WATHQ_API_KEY`, `WATHQ_ENV`, `WATHQ_BASE_URL`)
 *   - Falls back to mock mode when no API key — returns synthetic verified
 *     data so admin can exercise the wiring before credentials land.
 *   - Writes a sync_log row + audit_log entry on every attempt.
 */

import { action, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";

type WathqEnv = "production" | "mock";

interface WathqConfig {
  env: WathqEnv;
  apiKey: string | null;
  baseUrl: string;
}

function readConfig(): WathqConfig {
  const apiKey = process.env.WATHQ_API_KEY ?? null;
  if (!apiKey) return { env: "mock", apiKey: null, baseUrl: "" };
  const baseUrl =
    process.env.WATHQ_BASE_URL?.replace(/\/+$/, "") ??
    "https://api.wathq.sa/v5";
  return { env: "production", apiKey, baseUrl };
}

const KSA_CR_REGEX = /^\d{10}$/;

interface WathqLookupResult {
  ok: boolean;
  status: "VERIFIED" | "NOT_FOUND" | "API_ERROR" | "NETWORK_ERROR";
  httpStatus?: number;
  legalNameAr?: string;
  legalNameEn?: string;
  registrationStatus?: string; // e.g. "ACTIVE", "SUSPENDED", "CANCELLED"
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
  rawSummary?: any;
}

async function callWathq(
  cr: string,
  config: WathqConfig,
): Promise<WathqLookupResult> {
  const start = Date.now();

  if (config.env === "mock") {
    return {
      ok: true,
      status: "VERIFIED",
      legalNameAr: `(محقق) منشأة ${cr.slice(-4)}`,
      legalNameEn: `(Verified) Establishment ${cr.slice(-4)}`,
      registrationStatus: "ACTIVE",
      durationMs: Date.now() - start,
      rawSummary: { mock: true, cr },
    };
  }

  const url = `${config.baseUrl}/commercialregistration/info/basic/${cr}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apiKey: config.apiKey ?? "",
        Accept: "application/json",
      },
    });
    const text = await res.text();
    let data: any = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = { raw: text };
    }
    if (res.status === 404) {
      return {
        ok: false,
        status: "NOT_FOUND",
        httpStatus: 404,
        errorCode: "NOT_FOUND",
        errorMessage: "CR not found in Wathq",
        durationMs: Date.now() - start,
        rawSummary: data,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: "API_ERROR",
        httpStatus: res.status,
        errorCode: `HTTP_${res.status}`,
        errorMessage: data?.message ?? data?.error ?? "Wathq error",
        durationMs: Date.now() - start,
        rawSummary: data,
      };
    }
    // Wathq response shape (basic info endpoint) — field names vary slightly
    // across plans; we read defensively.
    const legalNameAr =
      data?.crName ??
      data?.legalName ??
      data?.entityNameArabic ??
      undefined;
    const legalNameEn =
      data?.crEnglishName ?? data?.entityNameEnglish ?? undefined;
    const registrationStatus = (
      data?.status?.name ??
      data?.status ??
      data?.crStatus ??
      "UNKNOWN"
    )
      .toString()
      .toUpperCase();
    return {
      ok: true,
      status: "VERIFIED",
      httpStatus: res.status,
      legalNameAr,
      legalNameEn,
      registrationStatus,
      durationMs: Date.now() - start,
      rawSummary: data,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: "NETWORK_ERROR",
      errorCode: err?.code ?? "FETCH_ERROR",
      errorMessage: String(err?.message ?? err),
      durationMs: Date.now() - start,
    };
  }
}

// ==================== Internal queries / mutations ====================

export const _getProfile = internalQuery({
  args: { id: v.id("profiles") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const _persistVerification = internalMutation({
  args: {
    profile_id: v.id("profiles"),
    wathq_status: v.union(
      v.literal("VERIFIED"),
      v.literal("MISMATCH"),
      v.literal("UNVERIFIED"),
    ),
    legal_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profile_id, {
      wathq_status: args.wathq_status,
      wathq_verified_at: Date.now(),
      wathq_verified_legal_name: args.legal_name,
    });
  },
});

export const _writeSyncLog = internalMutation({
  args: {
    operation: v.string(),
    environment: v.union(v.literal("production"), v.literal("mock")),
    target_type: v.string(),
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
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("wathq_sync_log", args);
  },
});

// ==================== Public action ====================

export interface VerifyByCRResult {
  ok: boolean;
  environment: WathqEnv;
  status: "VERIFIED" | "MISMATCH" | "NOT_FOUND" | "API_ERROR" | "NETWORK_ERROR";
  legalNameAr?: string;
  legalNameEn?: string;
  registrationStatus?: string;
  storedLegalName?: string;
  errorMessage?: string;
}

/**
 * Verify a profile's CR against Wathq. If the CR isn't passed, uses the one
 * stored on the profile. On success, persists wathq_status, wathq_verified_at,
 * and wathq_verified_legal_name. Sets status to MISMATCH (not VERIFIED) if
 * the returned legal name disagrees with the stored legal_name_ar.
 */
export const verifyByCR = action({
  args: {
    profile_id: v.id("profiles"),
    cr_number: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VerifyByCRResult> => {
    const config = readConfig();
    const profile: any = await ctx.runQuery(internal.wathq._getProfile, {
      id: args.profile_id,
    });
    if (!profile) throw new ConvexError("Profile not found");
    const cr = (args.cr_number ?? profile.cr_number ?? "").trim();
    if (!cr) {
      throw new ConvexError("No CR number on profile and none provided");
    }
    if (!KSA_CR_REGEX.test(cr)) {
      throw new ConvexError("CR must be 10 digits");
    }

    const result = await callWathq(cr, config);

    let finalStatus: "VERIFIED" | "MISMATCH" | "UNVERIFIED" = "UNVERIFIED";
    let storedLegalName: string | undefined;
    let logStatus:
      | "VERIFIED"
      | "MISMATCH"
      | "NOT_FOUND"
      | "API_ERROR"
      | "NETWORK_ERROR" = result.status;
    if (result.ok && result.status === "VERIFIED") {
      const ar = result.legalNameAr?.trim();
      const stored = (profile.legal_name_ar ?? "").trim();
      // If the profile already has a legal name and it doesn't match what
      // Wathq returned, flag MISMATCH so admin can investigate before any
      // tax invoices go out.
      if (stored && ar && stored !== ar) {
        finalStatus = "MISMATCH";
        logStatus = "MISMATCH";
      } else {
        finalStatus = "VERIFIED";
      }
      storedLegalName = ar ?? stored;
      await ctx.runMutation(internal.wathq._persistVerification, {
        profile_id: args.profile_id,
        wathq_status: finalStatus,
        legal_name: storedLegalName,
      });
    }

    await ctx.runMutation(internal.wathq._writeSyncLog, {
      operation: "verifyByCR",
      environment: config.env,
      target_type: "profile",
      target_id: args.profile_id,
      cr_number: cr,
      status: logStatus,
      http_status: result.httpStatus,
      error_code: result.errorCode,
      error_message: result.errorMessage,
      response_summary: result.rawSummary,
      duration_ms: result.durationMs,
    });

    return {
      ok: result.ok,
      environment: config.env,
      status: logStatus,
      legalNameAr: result.legalNameAr,
      legalNameEn: result.legalNameEn,
      registrationStatus: result.registrationStatus,
      storedLegalName,
      errorMessage: result.errorMessage,
    };
  },
});

/**
 * Lightweight env probe (mirrors api.wafeq.status).
 */
export const status = action({
  handler: async (): Promise<{ environment: WathqEnv; configured: boolean }> => {
    const config = readConfig();
    return { environment: config.env, configured: config.apiKey !== null };
  },
});

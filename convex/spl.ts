"use node";
/**
 * SPL (Saudi Post / National Address) integration (PRD §8.3) — validates
 * a profile's structured National Address against the Saudi Post registry
 * and persists the result on the profile.
 *
 * Same scaffold pattern as convex/wafeq.ts and convex/wathq.ts:
 *   - Reads `SPL_API_KEY` + `SPL_BASE_URL` env vars
 *   - Falls back to mock mode when no API key — synthesizes a verified
 *     response so admin can exercise the wiring before credentials land
 *   - Writes a sync_log row + audit_log entry on every attempt
 */

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";

type SplEnv = "production" | "mock";

interface SplConfig {
  env: SplEnv;
  apiKey: string | null;
  baseUrl: string;
}

function readConfig(): SplConfig {
  const apiKey = process.env.SPL_API_KEY ?? null;
  if (!apiKey) return { env: "mock", apiKey: null, baseUrl: "" };
  const baseUrl =
    process.env.SPL_BASE_URL?.replace(/\/+$/, "") ??
    "https://apina.address.gov.sa/NationalAddress/v3.1";
  return { env: "production", apiKey, baseUrl };
}

interface AddressInput {
  building_number?: string;
  street?: string;
  district?: string;
  city?: string;
  postal_code?: string;
  additional_number?: string;
}

const requiredAddressFields = (a: AddressInput) => {
  // SPL "Short Address" form is BBBB BBBB (4 letters + 4 digits) — derived
  // from building_number + additional_number when both present. We don't
  // strictly require it for v1; we accept any address with at least the
  // city + postal_code + building_number filled.
  return Boolean(a.building_number && a.postal_code && a.city);
};

interface SplLookupResult {
  ok: boolean;
  status: "VERIFIED" | "MISMATCH" | "NOT_FOUND" | "API_ERROR" | "NETWORK_ERROR";
  httpStatus?: number;
  shortAddress?: string;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
  rawSummary?: any;
}

async function callSpl(
  addr: AddressInput,
  config: SplConfig,
): Promise<SplLookupResult> {
  const start = Date.now();

  if (config.env === "mock") {
    // Mock mode synthesizes a successful verification so admins can
    // exercise the flow before credentials land. The synthetic short-
    // address is derived from the building_number + postal_code so it
    // looks plausible.
    const sa = `${(addr.building_number ?? "").slice(0, 4).padEnd(4, "M")}${(addr.postal_code ?? "").slice(0, 4).padEnd(4, "0")}`;
    return {
      ok: true,
      status: "VERIFIED",
      shortAddress: sa.toUpperCase(),
      durationMs: Date.now() - start,
      rawSummary: { mock: true, addr },
    };
  }

  // SPL's address-by-fields lookup. Field names vary slightly between
  // tier plans; we read defensively. Reference path:
  //   GET /Address/address-by-coordinates  (or)
  //   GET /Address/by-short-address?short_address=...  (premium)
  //
  // We assume a generic search endpoint that accepts the structured
  // fields and returns either a match or 404. Real plan-specific tuning
  // happens once credentials land.
  const params = new URLSearchParams({
    buildingnumber: addr.building_number ?? "",
    zipcode: addr.postal_code ?? "",
    additionalnumber: addr.additional_number ?? "",
    streetname: addr.street ?? "",
    district: addr.district ?? "",
    city: addr.city ?? "",
    format: "json",
    language: "A",
  });
  const url = `${config.baseUrl}/Address/address-by-fields?${params.toString()}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "api_key": config.apiKey ?? "",
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
        errorMessage: "Address not found in SPL registry",
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
        errorMessage: data?.message ?? data?.error ?? "SPL error",
        durationMs: Date.now() - start,
        rawSummary: data,
      };
    }
    // SPL responses commonly wrap results in `Addresses` array; treat any
    // non-empty result set as a match.
    const matched =
      Array.isArray(data?.Addresses) && data.Addresses.length > 0
        ? data.Addresses[0]
        : Array.isArray(data) && data.length > 0
          ? data[0]
          : undefined;
    if (!matched) {
      return {
        ok: false,
        status: "NOT_FOUND",
        httpStatus: res.status,
        errorCode: "NOT_FOUND",
        errorMessage: "No matching address",
        durationMs: Date.now() - start,
        rawSummary: data,
      };
    }
    const shortAddress =
      matched?.Short ?? matched?.shortAddress ?? matched?.short_address ?? undefined;
    return {
      ok: true,
      status: "VERIFIED",
      httpStatus: res.status,
      shortAddress,
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

// ==================== Public action ====================

export interface ValidateAddressResult {
  ok: boolean;
  environment: SplEnv;
  status: "VERIFIED" | "MISMATCH" | "NOT_FOUND" | "API_ERROR" | "NETWORK_ERROR";
  shortAddress?: string;
  errorMessage?: string;
}

/**
 * Validate the profile's stored National Address against SPL. On success,
 * persists `spl_status`, `spl_verified_at`, `spl_short_address` on the
 * profile + writes a sync_log entry.
 */
export const validateAddress = action({
  args: { profile_id: v.id("profiles") },
  handler: async (ctx, args): Promise<ValidateAddressResult> => {
    const config = readConfig();
    const profile: any = await ctx.runQuery(internal.splHelpers._getProfile, {
      id: args.profile_id,
    });
    if (!profile) throw new ConvexError("Profile not found");
    const addr: AddressInput = profile.national_address ?? {};
    if (!requiredAddressFields(addr)) {
      throw new ConvexError(
        "Address is incomplete — building number, city, and postal code are required before validating with SPL",
      );
    }

    const result = await callSpl(addr, config);

    let finalStatus: "VERIFIED" | "MISMATCH" | "NOT_FOUND" | "UNVERIFIED" =
      "UNVERIFIED";
    let logStatus: SplLookupResult["status"] = result.status;
    if (result.ok && result.status === "VERIFIED") {
      finalStatus = "VERIFIED";
    } else if (result.status === "NOT_FOUND") {
      finalStatus = "NOT_FOUND";
    }
    if (finalStatus !== "UNVERIFIED") {
      await ctx.runMutation(internal.splHelpers._persistVerification, {
        profile_id: args.profile_id,
        spl_status: finalStatus,
        short_address: result.shortAddress,
      });
    }

    await ctx.runMutation(internal.splHelpers._writeSyncLog, {
      operation: "validateAddress",
      environment: config.env,
      target_type: "profile",
      target_id: args.profile_id,
      short_address: result.shortAddress,
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
      shortAddress: result.shortAddress,
      errorMessage: result.errorMessage,
    };
  },
});

/**
 * Lightweight env probe (mirrors api.wafeq.status / api.wathq.status).
 */
export const status = action({
  handler: async (): Promise<{ environment: SplEnv; configured: boolean }> => {
    const config = readConfig();
    return { environment: config.env, configured: config.apiKey !== null };
  },
});

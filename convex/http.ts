import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

http.route({
  path: "/submit-lead",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
    }

    const full_name = String(body.full_name ?? "").trim();
    const email = String(body.email ?? "").trim();
    if (!full_name || !email) {
      return new Response("full_name and email are required", {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const account_type =
      body.account_type === "CLIENT" || body.account_type === "SUPPLIER"
        ? body.account_type
        : undefined;

    await ctx.runMutation(api.leads.submit, {
      full_name,
      email,
      company_name: body.company_name ? String(body.company_name).trim() : undefined,
      cr_number: body.cr_number ? String(body.cr_number).trim() : undefined,
      vat_number: body.vat_number ? String(body.vat_number).trim() : undefined,
      phone: body.phone ? String(body.phone).trim() : undefined,
      notes: body.notes ? String(body.notes).trim() : undefined,
      account_type,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }),
});

http.route({
  path: "/submit-lead",
  method: "OPTIONS",
  handler: httpAction(
    async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
  ),
});

// Wafeq webhook receiver (PRD §8.1.5). Handles invoice.cleared,
// invoice.paid, invoice.voided, and zatca_status_change events.
//
// Auth: when WAFEQ_WEBHOOK_SECRET is set, the request must include a
// matching X-Wafeq-Signature header. We do a constant-time string compare
// for now; HMAC-SHA256 over the raw body is a follow-on once Wafeq's exact
// signing scheme is confirmed against their plan-specific docs.
http.route({
  path: "/wafeq/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.WAFEQ_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers.get("X-Wafeq-Signature") ?? "";
      // Constant-time compare to avoid timing side-channels.
      if (sig.length !== secret.length) {
        return new Response("Forbidden", { status: 403 });
      }
      let diff = 0;
      for (let i = 0; i < sig.length; i++) {
        diff |= sig.charCodeAt(i) ^ secret.charCodeAt(i);
      }
      if (diff !== 0) return new Response("Forbidden", { status: 403 });
    }

    let event: any;
    try {
      event = await req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const result = await ctx.runAction(internal.wafeq.handleWebhookEvent, {
      event,
      raw_signature: req.headers.get("X-Wafeq-Signature") ?? undefined,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;

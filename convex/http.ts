import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
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

export default http;

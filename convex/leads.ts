import { query, mutation, action, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { requireAdmin } from "./lib";

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("interest_submissions").order("desc").collect();
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("interest_submissions"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("REVIEWED"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const submit = mutation({
  args: {
    full_name: v.string(),
    company_name: v.optional(v.string()),
    cr_number: v.optional(v.string()),
    vat_number: v.optional(v.string()),
    email: v.string(),
    phone: v.optional(v.string()),
    account_type: v.optional(v.union(v.literal("CLIENT"), v.literal("SUPPLIER"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("interest_submissions", { ...args, status: "PENDING" });
  },
});

export const getByIdInternal = internalQuery({
  args: { id: v.id("interest_submissions") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const approveAndCreateAccount = action({
  args: {
    id: v.id("interest_submissions"),
    role: v.union(v.literal("CLIENT"), v.literal("SUPPLIER")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ email: string; public_id: string | null }> => {
    const profile = await ctx.runQuery(internal.users.getMyProfileInternal);
    if (!profile || profile.role !== "ADMIN") throw new ConvexError("Forbidden");

    const lead = await ctx.runQuery(internal.leads.getByIdInternal, { id: args.id });
    if (!lead) throw new ConvexError("Lead not found");

    const password = generateTempPassword();
    const company_name = lead.company_name || lead.full_name;

    await ctx.runAction(api.auth.signIn, {
      provider: "password",
      params: {
        email: lead.email,
        password,
        flow: "signUp",
        name: JSON.stringify({ role: args.role, company_name }),
      },
    });

    const newProfile = await ctx.runQuery(internal.admin.getProfileByEmail, {
      email: lead.email,
    });

    if (newProfile) {
      await ctx.runMutation(internal.users.activateAndFlagPasswordChange, {
        userId: newProfile.userId,
      });
    }

    const loginUrl = process.env.APP_URL ?? "https://mwrd.app/login";
    await ctx.runAction(internal.email.send, {
      to: lead.email,
      subject: "Your MWRD account is ready",
      html: buildCredentialsEmail({
        name: lead.full_name,
        email: lead.email,
        password,
        loginUrl,
      }),
    });

    await ctx.runMutation(api.leads.updateStatus, { id: args.id, status: "APPROVED" });

    return { email: lead.email, public_id: newProfile?.public_id ?? null };
  },
});

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < buf.length; i++) out += chars[buf[i] % chars.length];
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function buildCredentialsEmail(args: {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}): string {
  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 16px">Welcome to MWRD</h2>
  <p>Hi ${escapeHtml(args.name)},</p>
  <p>Your registration has been reviewed and your MWRD account is now active. You can sign in using the credentials below:</p>
  <table cellpadding="8" style="background:#f6f6f6;border-radius:8px;margin:16px 0">
    <tr><td style="font-weight:600">Email</td><td><code>${escapeHtml(args.email)}</code></td></tr>
    <tr><td style="font-weight:600">Temporary password</td><td><code>${escapeHtml(args.password)}</code></td></tr>
  </table>
  <p><a href="${escapeHtml(args.loginUrl)}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Sign in to MWRD</a></p>
  <p style="color:#555;font-size:14px">For security, please change your password after your first sign-in.</p>
  <p style="color:#555;font-size:14px">— The MWRD Team</p>
</body></html>`;
}

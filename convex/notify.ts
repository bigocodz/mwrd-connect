"use node";
/**
 * Cross-channel notification dispatch (PRD §10.1, §10.2).
 *
 * Pattern (matches Wafeq / Wathq scaffolds):
 *   - mutations call `enqueueNotification` from convex/notifyHelpers.ts (V8)
 *   - that helper inserts the in-app notification row, then schedules
 *     `internal.notify.dispatch` on the next tick
 *   - this Node-runtime action reads the user's email + sends via Resend
 *   - mock mode kicks in when RESEND_API_KEY is unset — the dispatch_log
 *     row is written with status="MOCK" so admin sees what would have sent
 *
 * Auth: every entry point is internal — only triggered from server-side.
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { renderTemplate } from "./documentRenderer";

// Internal queries / mutations live in notifyHelpers.ts (V8 runtime) — Convex
// forbids non-action functions in "use node" modules. The dispatch action
// below reaches them via ctx.runQuery / ctx.runMutation.

// ==================== Provider: email (Resend) ====================

interface EmailResult {
  ok: boolean;
  status: "SUCCESS" | "FAILED" | "SKIPPED" | "MOCK";
  errorMessage?: string;
  durationMs: number;
}

async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const start = Date.now();
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Mock mode: log the would-be send so admin can verify routing during
    // dev. No external call.
    return { ok: true, status: "MOCK", durationMs: Date.now() - start };
  }
  const from = process.env.RESEND_FROM ?? "MWRD <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: args.to, subject: args.subject, html: args.html }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        status: "FAILED",
        errorMessage: `Resend ${res.status}: ${text.slice(0, 200)}`,
        durationMs: Date.now() - start,
      };
    }
    return { ok: true, status: "SUCCESS", durationMs: Date.now() - start };
  } catch (err: any) {
    return {
      ok: false,
      status: "FAILED",
      errorMessage: String(err?.message ?? err),
      durationMs: Date.now() - start,
    };
  }
}

// ==================== Templating ====================

const PORTAL_BASE = process.env.MWRD_PORTAL_URL ?? "https://app.mwrd.sa";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const absolutize = (link?: string | null): string | null => {
  if (!link) return null;
  if (link.startsWith("http")) return link;
  return `${PORTAL_BASE.replace(/\/+$/, "")}${link}`;
};

/**
 * Wrap rendered body content in a branded mobile-friendly HTML email shell.
 * Direction respects the recipient's preferred language.
 */
function emailShell(args: {
  subject: string;
  bodyHtml: string;
  link?: string;
  language: "ar" | "en";
}): string {
  const linkAbsolute = absolutize(args.link);
  const dir = args.language === "ar" ? "rtl" : "ltr";
  const ctaLabel = args.language === "ar" ? "فتح في MWRD" : "Open in MWRD";
  const footer =
    args.language === "ar"
      ? "تتلقى هذا الإشعار لأن لديك حسابًا على MWRD."
      : "You're receiving this because you have an account at MWRD.";
  return `<!DOCTYPE html>
<html lang="${args.language}" dir="${dir}"><body style="font-family: -apple-system, system-ui, 'IBM Plex Sans', 'Tajawal', 'Noto Sans Arabic', sans-serif; background: #f5f5f0; padding: 24px; color: #1a1a1a;">
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px;" dir="${dir}">
    <tr><td>
      <p style="margin: 0 0 8px; color: #8a8a85; font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px;">MWRD</p>
      <h1 style="margin: 0 0 12px; font-size: 20px; font-weight: 700;">${escapeHtml(args.subject)}</h1>
      <div style="line-height: 1.55; color: #3a3a3a;">${args.bodyHtml}</div>
      ${
        linkAbsolute
          ? `<p style="margin: 16px 0;"><a href="${linkAbsolute}" style="display: inline-block; padding: 10px 20px; background: #ff6d43; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">${escapeHtml(ctaLabel)}</a></p>`
          : ""
      }
      <hr style="border: none; border-top: 1px solid #ece7e1; margin: 24px 0;">
      <p style="margin: 0; color: #8a8a85; font-size: 12px;">${escapeHtml(footer)}</p>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Pick the right subject + body for the recipient. When a per-event
 * template exists, render its language-specific body via the doc engine's
 * handlebars-lite. Otherwise fall back to the generic subject = title,
 * body = message shape.
 */
function renderEmail(args: {
  notif: { title: string; message?: string; link?: string; event_type?: string };
  template: any;
  language: "ar" | "en";
}): { subject: string; html: string } {
  const ctx = {
    title: args.notif.title,
    message: args.notif.message ?? "",
    link: absolutize(args.notif.link) ?? "",
    event_type: args.notif.event_type ?? "",
  };
  if (args.template) {
    const subject =
      args.language === "ar" ? args.template.subject_ar : args.template.subject_en;
    const body =
      args.language === "ar" ? args.template.body_ar : args.template.body_en;
    return {
      subject: renderTemplate(subject, ctx),
      html: emailShell({
        subject: renderTemplate(subject, ctx),
        bodyHtml: renderTemplate(body, ctx),
        link: args.notif.link,
        language: args.language,
      }),
    };
  }
  // No template — generic shell with the raw title + message
  return {
    subject: args.notif.title,
    html: emailShell({
      subject: args.notif.title,
      bodyHtml: args.notif.message ? `<p>${escapeHtml(args.notif.message)}</p>` : "",
      link: args.notif.link,
      language: args.language,
    }),
  };
}

// ==================== Main dispatch action ====================

export const dispatch = internalAction({
  args: { notification_id: v.id("notifications") },
  handler: async (ctx, args): Promise<{ channels: string[] }> => {
    const ctxData: any = await ctx.runQuery(internal.notifyHelpers._getNotificationContext, {
      id: args.notification_id,
    });
    if (!ctxData?.notif) return { channels: [] };
    const { notif, email, template, preferred_language, pref } = ctxData;
    const language: "ar" | "en" = preferred_language === "en" ? "en" : "ar";
    const dispatched: string[] = ["IN_APP"]; // in-app always succeeds (the row was just inserted)

    // EMAIL channel — gated by:
    //   1. user opt-in for this event_type (default true if no pref row)
    //   2. user has a real email address
    const emailOptIn = pref?.email !== false;
    if (!emailOptIn) {
      await ctx.runMutation(internal.notifyHelpers._writeDispatchLog, {
        notification_id: args.notification_id,
        user_id: notif.user_id,
        channel: "EMAIL",
        status: "SKIPPED",
        error_message: "User opted out of this event",
      });
    } else if (email && typeof email === "string" && email.includes("@")) {
      const { subject, html } = renderEmail({ notif, template, language });
      const result = await sendEmail({ to: email, subject, html });
      await ctx.runMutation(internal.notifyHelpers._writeDispatchLog, {
        notification_id: args.notification_id,
        user_id: notif.user_id,
        channel: "EMAIL",
        status: result.status,
        target: email,
        error_message: result.errorMessage,
        duration_ms: result.durationMs,
      });
      if (result.ok) dispatched.push("EMAIL");
    } else {
      await ctx.runMutation(internal.notifyHelpers._writeDispatchLog, {
        notification_id: args.notification_id,
        user_id: notif.user_id,
        channel: "EMAIL",
        status: "SKIPPED",
        error_message: email ? "Invalid email address" : "No email on profile",
      });
    }

    // SMS / WhatsApp providers go here once configured (PRD §10.1 phased).

    await ctx.runMutation(internal.notifyHelpers._markDispatched, {
      id: args.notification_id,
      channels: dispatched,
    });
    return { channels: dispatched };
  },
});

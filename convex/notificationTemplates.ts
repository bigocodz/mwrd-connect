/**
 * Bilingual notification templates (PRD §10.2). Rendered by the doc engine's
 * handlebars-lite renderer — same `{{path}}`, `{{#if}}`, `{{#each}}` subset.
 *
 * Each template carries subject + body in AR/EN. The dispatch action picks
 * the right pair based on the recipient's preferred_language.
 */
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin, requireAdminRead, getAuthenticatedProfile } from "./lib";
import { logAction } from "./audit";

// ==================== Defaults ====================

// Templates use {{title}}, {{message}}, {{link}} as the universal context
// passed by the dispatcher. Authors can also reference {{public_id}},
// {{event_type}}. Future events will pass richer per-event context.
const DEFAULT_TEMPLATES = [
  {
    event_type: "invoice.issued",
    subject_ar: "فاتورة جديدة من MWRD",
    subject_en: "New invoice from MWRD",
    body_ar: "<p>تم إصدار فاتورة جديدة لحسابك.</p><p><strong>{{title}}</strong></p>{{#if message}}<p>{{message}}</p>{{/if}}",
    body_en: "<p>A new invoice has been issued on your account.</p><p><strong>{{title}}</strong></p>{{#if message}}<p>{{message}}</p>{{/if}}",
    description: "Sent when a client invoice is created (createForOrder / createManual)",
  },
  {
    event_type: "invoice.paid",
    subject_ar: "تم استلام الدفعة",
    subject_en: "Payment received",
    body_ar: "<p>تم تأكيد الدفع للفاتورة.</p><p><strong>{{title}}</strong></p>{{#if message}}<p>{{message}}</p>{{/if}}",
    body_en: "<p>Payment confirmed for the invoice.</p><p><strong>{{title}}</strong></p>{{#if message}}<p>{{message}}</p>{{/if}}",
    description: "Sent when an invoice is marked paid",
  },
  {
    event_type: "approval.required",
    subject_ar: "موافقة مطلوبة",
    subject_en: "Approval required",
    body_ar: "<p>هناك طلب يحتاج إلى موافقتك على بوابة MWRD.</p>{{#if message}}<p>{{message}}</p>{{/if}}",
    body_en: "<p>A request is awaiting your decision on the MWRD portal.</p>{{#if message}}<p>{{message}}</p>{{/if}}",
    description: "Sent to admins when a quote acceptance triggers an approval rule",
  },
  {
    event_type: "approval.granted",
    subject_ar: "تمت الموافقة على طلبك",
    subject_en: "Your request was approved",
    body_ar: "<p>تمت الموافقة على طلبك. يمكنك متابعة التنفيذ.</p>{{#if message}}<p>{{message}}</p>{{/if}}",
    body_en: "<p>Your request has been approved. You can proceed with fulfillment.</p>{{#if message}}<p>{{message}}</p>{{/if}}",
    description: "Sent to clients when an approval workflow completes successfully",
  },
  {
    event_type: "approval.rejected",
    subject_ar: "تم رفض طلبك",
    subject_en: "Your request was rejected",
    body_ar: "<p>تم رفض طلب الموافقة.</p>{{#if message}}<blockquote>{{message}}</blockquote>{{/if}}",
    body_en: "<p>Your approval request has been rejected.</p>{{#if message}}<blockquote>{{message}}</blockquote>{{/if}}",
    description: "Sent to clients when an approval is denied",
  },
  {
    event_type: "approval.escalated",
    subject_ar: "تصعيد خطوة موافقة",
    subject_en: "Approval step escalated",
    body_ar: "<p>تجاوزت إحدى خطوات الموافقة المهلة المحددة. يُرجى المراجعة.</p>{{#if message}}<p>{{message}}</p>{{/if}}",
    body_en: "<p>An approval step has passed its SLA. Please review.</p>{{#if message}}<p>{{message}}</p>{{/if}}",
    description: "Sent to admins when a step exceeds escalation_hours",
  },
  {
    event_type: "grn.discrepancy",
    subject_ar: "تباين في إيصال استلام",
    subject_en: "Receipt discrepancy reported",
    body_ar: "<p>أبلغ العميل عن تباين في إيصال الاستلام. يحتاج الأمر إلى وساطة من MWRD.</p>{{#if message}}<p>{{message}}</p>{{/if}}",
    body_en: "<p>A client reported a discrepancy on a goods receipt. MWRD mediation needed.</p>{{#if message}}<p>{{message}}</p>{{/if}}",
    description: "Sent to admins when a GRN is created with non-GOOD lines",
  },
  {
    event_type: "comment.mention",
    subject_ar: "تم ذِكرك في تعليق",
    subject_en: "You were mentioned in a comment",
    body_ar: "<p><strong>{{title}}</strong></p>{{#if message}}<blockquote>{{message}}</blockquote>{{/if}}",
    body_en: "<p><strong>{{title}}</strong></p>{{#if message}}<blockquote>{{message}}</blockquote>{{/if}}",
    description: "Sent when someone @-mentions you in an entity comment thread",
  },
];

// ==================== Mutations ====================

export const seed = mutation({
  // Idempotent — installs only the templates that aren't already present.
  // Admin runs this once per environment.
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    let inserted = 0;
    for (const t of DEFAULT_TEMPLATES) {
      const existing = await ctx.db
        .query("notification_templates")
        .withIndex("by_event_type", (q) => q.eq("event_type", t.event_type))
        .unique();
      if (existing) continue;
      await ctx.db.insert("notification_templates", { ...t, is_default: true });
      inserted++;
    }
    await logAction(ctx, {
      action: "notification_template.seed",
      target_type: "notification_template",
      details: { inserted, total: DEFAULT_TEMPLATES.length, admin_id: admin._id },
    });
    return { inserted, total: DEFAULT_TEMPLATES.length };
  },
});

// ==================== Queries ====================

export const list = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    return ctx.db.query("notification_templates").collect();
  },
});

export const getByEventType = query({
  args: { event_type: v.string() },
  handler: async (ctx, args) => {
    await requireAdminRead(ctx);
    return ctx.db
      .query("notification_templates")
      .withIndex("by_event_type", (q) => q.eq("event_type", args.event_type))
      .unique();
  },
});

export const update = mutation({
  args: {
    id: v.id("notification_templates"),
    subject_ar: v.optional(v.string()),
    subject_en: v.optional(v.string()),
    body_ar: v.optional(v.string()),
    body_en: v.optional(v.string()),
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
      action: "notification_template.update",
      target_type: "notification_template",
      target_id: id,
      details: {
        event_type: existing.event_type,
        fields: Object.keys(patch),
        admin_id: admin._id,
      },
    });
    return id;
  },
});

// ==================== Per-user channel preferences (PRD §10.2) ====================

type Channel = "in_app" | "email" | "sms" | "whatsapp";

export const listForPrefsUI = query({
  // Public-readable list of available event types (subject + description
  // only, no body). Used by the per-user prefs UI to enumerate the events
  // a user can opt in/out of. Authentication required so anonymous
  // visitors can't enumerate the catalog.
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) return [];
    const rows = await ctx.db.query("notification_templates").collect();
    return rows
      .map((t) => ({
        _id: t._id,
        event_type: t.event_type,
        subject_ar: t.subject_ar,
        subject_en: t.subject_en,
        description: t.description,
      }))
      .sort((a, b) => a.event_type.localeCompare(b.event_type));
  },
});

export const getMyChannelPrefs = query({
  // Returns the caller's prefs map keyed by event_type. Callers compose
  // this with the templates list to render a settings UI.
  handler: async (ctx) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) return [];
    return ctx.db
      .query("notification_channel_prefs")
      .withIndex("by_user", (q) => q.eq("user_id", profile._id))
      .collect();
  },
});

export const setMyChannelPref = mutation({
  args: {
    event_type: v.string(),
    channel: v.union(
      v.literal("in_app"),
      v.literal("email"),
      v.literal("sms"),
      v.literal("whatsapp"),
    ),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const profile = await getAuthenticatedProfile(ctx);
    if (!profile) throw new ConvexError("Unauthorized");
    const existing = await ctx.db
      .query("notification_channel_prefs")
      .withIndex("by_user_and_event", (q) =>
        q.eq("user_id", profile._id).eq("event_type", args.event_type),
      )
      .unique();
    const channel = args.channel as Channel;
    if (existing) {
      await ctx.db.patch(existing._id, { [channel]: args.enabled } as any);
    } else {
      await ctx.db.insert("notification_channel_prefs", {
        user_id: profile._id,
        event_type: args.event_type,
        [channel]: args.enabled,
      } as any);
    }
  },
});

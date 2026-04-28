import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin, requireAdminRead, requireClient } from "./lib";
import { createFromQuote as createOrderFromQuote } from "./orders";
import { logAction } from "./audit";
import { enqueueNotification } from "./notifyHelpers";
import { businessHoursElapsed } from "./dateHelpers";

const computeQuoteTotal = async (ctx: any, quoteId: Id<"quotes">) => {
  const items = await ctx.db
    .query("quote_items")
    .withIndex("by_quote", (q: any) => q.eq("quote_id", quoteId))
    .collect();
  let total = 0;
  for (const item of items) {
    if (!item.is_quoted) continue;
    const rfqItem = await ctx.db.get(item.rfq_item_id);
    const qty = rfqItem?.quantity ?? 1;
    total += (item.final_price_with_vat ?? 0) * qty;
  }
  return total;
};

const findMatchingRule = async (
  ctx: any,
  clientId: Id<"profiles">,
  rfq: any,
  total: number,
) => {
  const rules = await ctx.db
    .query("approval_rules")
    .withIndex("by_client", (q: any) => q.eq("client_id", clientId))
    .collect();
  return rules.find((rule: any) => {
    if (!rule.enabled) return false;
    if (total < rule.min_amount) return false;
    if (rule.max_amount != null && total > rule.max_amount) return false;
    if (rule.category && rule.category !== rfq.category) return false;
    if (rule.cost_center_id && rule.cost_center_id !== rfq.cost_center_id) return false;
    if (rule.branch_id && rule.branch_id !== rfq.branch_id) return false;
    if (rule.department_id && rule.department_id !== rfq.department_id) return false;
    return true;
  });
};

const fetchOrderedSteps = async (ctx: any, ruleId: Id<"approval_rules">) => {
  const steps = await ctx.db
    .query("approval_steps")
    .withIndex("by_rule", (q: any) => q.eq("rule_id", ruleId))
    .collect();
  return steps.sort((a: any, b: any) => a.step_index - b.step_index);
};

const groupsOf = (steps: any[]) => {
  const seen = new Set<number>();
  const groups: number[] = [];
  for (const s of steps) {
    if (!seen.has(s.parallel_group)) {
      seen.add(s.parallel_group);
      groups.push(s.parallel_group);
    }
  }
  return groups.sort((a, b) => a - b);
};

const notifyApproversForGroup = async (
  ctx: any,
  ruleName: string,
  total: number,
  decisions: any[],
) => {
  // Targeted notifications when an approver is named; fan out to all admins
  // when the step is "any admin".
  const targets = new Set<string>();
  const named: any[] = [];
  for (const d of decisions) {
    if (d.approver_admin_id) named.push(d.approver_admin_id);
  }
  if (named.length) {
    for (const id of named) targets.add(id);
  } else {
    const admins = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q: any) => q.eq("role", "ADMIN"))
      .collect();
    for (const a of admins) targets.add(a._id);
  }
  await Promise.all(
    [...targets].map((id) =>
      enqueueNotification(ctx, {
        user_id: id as any,
        event_type: "approval.required",
        title: "Approval required",
        message: `${ruleName} triggered for SAR ${total.toFixed(2)}`,
        link: `/admin/approvals`,
      }),
    ),
  );
};

export const checkApprovalForQuote = async (
  ctx: any,
  quoteId: Id<"quotes">,
  clientId: Id<"profiles">,
) => {
  const quote = await ctx.db.get(quoteId);
  if (!quote) return null;
  const rfq = await ctx.db.get(quote.rfq_id);
  if (!rfq) return null;
  const total = await computeQuoteTotal(ctx, quoteId);
  const rule = await findMatchingRule(ctx, clientId, rfq, total);
  if (!rule) return null;

  // Auto-approve below threshold (PRD §6.6.1) — quote slips past the
  // approval gate; caller proceeds to create the order normally.
  if (rule.auto_approve_threshold != null && total <= rule.auto_approve_threshold) {
    return null;
  }

  const steps = await fetchOrderedSteps(ctx, rule._id);
  const groups = groupsOf(steps);

  const requestId = await ctx.db.insert("approval_requests", {
    quote_id: quoteId,
    rfq_id: quote.rfq_id,
    client_id: clientId,
    rule_id: rule._id,
    rule_name: rule.name,
    quote_total: total,
    status: "PENDING",
    requested_at: Date.now(),
    current_group: steps.length > 0 ? groups[0] : undefined,
    total_groups: steps.length > 0 ? groups.length : undefined,
  });

  if (steps.length > 0) {
    // Materialize step decisions for every step in the workflow. The first
    // group is PENDING + activated immediately; later groups stay PENDING
    // but unactivated until earlier groups complete.
    const firstGroup = groups[0];
    const now = Date.now();
    const firstGroupDecisions: any[] = [];
    for (const s of steps) {
      const isFirst = s.parallel_group === firstGroup;
      const decisionId = await ctx.db.insert("approval_step_decisions", {
        request_id: requestId,
        step_id: s._id,
        rule_id: rule._id,
        parallel_group: s.parallel_group,
        label: s.label,
        approver_admin_id: s.approver_admin_id,
        status: "PENDING",
        activated_at: isFirst ? now : undefined,
      });
      if (isFirst) {
        firstGroupDecisions.push({ ...s, _id: decisionId });
      }
    }
    await notifyApproversForGroup(ctx, rule.name, total, firstGroupDecisions);
  } else {
    // Legacy single-step rule with no template steps. Notify all admins so
    // the existing approve/reject mutations still drive the request.
    await notifyApproversForGroup(ctx, rule.name, total, []);
  }
  return requestId;
};

export const listMyRules = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    return ctx.db
      .query("approval_rules")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("asc")
      .collect();
  },
});

export const upsertRule = mutation({
  args: {
    id: v.optional(v.id("approval_rules")),
    name: v.string(),
    min_amount: v.number(),
    max_amount: v.optional(v.number()),
    category: v.optional(v.string()),
    cost_center_id: v.optional(v.id("cost_centers")),
    branch_id: v.optional(v.id("branches")),
    department_id: v.optional(v.id("departments")),
    enabled: v.boolean(),
    notes: v.optional(v.string()),
    auto_approve_threshold: v.optional(v.number()),
    escalation_hours: v.optional(v.number()),
    // Workflow steps; null = leave existing alone, [] = clear, otherwise replace.
    steps: v.optional(
      v.array(
        v.object({
          label: v.string(),
          parallel_group: v.number(),
          approver_admin_id: v.optional(v.id("profiles")),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    if (!args.name.trim()) throw new ConvexError("Name is required");
    if (args.min_amount < 0) throw new ConvexError("Minimum amount must be non-negative");
    if (args.max_amount != null && args.max_amount < args.min_amount) {
      throw new ConvexError("Maximum must be greater than minimum");
    }
    if (args.auto_approve_threshold != null && args.auto_approve_threshold < 0) {
      throw new ConvexError("Auto-approve threshold must be non-negative");
    }
    if (args.escalation_hours != null && args.escalation_hours <= 0) {
      throw new ConvexError("Escalation hours must be positive");
    }
    const verifyOwn = async (table: "cost_centers" | "branches" | "departments", id: any) => {
      const doc = (await ctx.db.get(id)) as { client_id?: any } | null;
      if (!doc || doc.client_id !== profile._id) throw new ConvexError(`Invalid ${table}`);
    };
    if (args.cost_center_id) await verifyOwn("cost_centers", args.cost_center_id);
    if (args.branch_id) await verifyOwn("branches", args.branch_id);
    if (args.department_id) await verifyOwn("departments", args.department_id);

    const { id: existingId, steps, ...rest } = args;
    let ruleId: Id<"approval_rules">;
    if (existingId) {
      const existing = await ctx.db.get(existingId);
      if (!existing || existing.client_id !== profile._id) throw new ConvexError("Forbidden");
      await ctx.db.patch(existingId, rest);
      ruleId = existingId;
    } else {
      ruleId = await ctx.db.insert("approval_rules", { ...rest, client_id: profile._id });
    }

    if (steps !== undefined) {
      // Replace existing step template wholesale. Pre-existing step
      // decisions on in-flight requests keep referencing their old step
      // rows by id, which we don't delete — so in-flight requests aren't
      // disrupted by edits to the template.
      const existingSteps = await ctx.db
        .query("approval_steps")
        .withIndex("by_rule", (q) => q.eq("rule_id", ruleId))
        .collect();
      // Soft-replace: only delete steps that aren't currently referenced by
      // any decision row. Convex doesn't track FKs so we check manually.
      const allDecisions = await ctx.db.query("approval_step_decisions").collect();
      const referencedStepIds = new Set(allDecisions.map((d) => d.step_id as any));
      for (const s of existingSteps) {
        if (!referencedStepIds.has(s._id)) {
          await ctx.db.delete(s._id);
        }
      }
      // Insert new steps with sequential step_index
      let i = 0;
      for (const s of steps) {
        if (!s.label.trim()) throw new ConvexError("Each step needs a label");
        await ctx.db.insert("approval_steps", {
          rule_id: ruleId,
          step_index: i++,
          parallel_group: s.parallel_group,
          label: s.label.trim(),
          approver_admin_id: s.approver_admin_id,
        });
      }
    }
    return ruleId;
  },
});

export const listStepsForRule = query({
  args: { rule_id: v.id("approval_rules") },
  handler: async (ctx, args) => {
    // Owner-only read
    const profile = await requireClient(ctx);
    const rule = await ctx.db.get(args.rule_id);
    if (!rule || rule.client_id !== profile._id) return [];
    const steps = await ctx.db
      .query("approval_steps")
      .withIndex("by_rule", (q) => q.eq("rule_id", args.rule_id))
      .collect();
    return steps.sort((a, b) => a.step_index - b.step_index);
  },
});

export const deleteRule = mutation({
  args: { id: v.id("approval_rules") },
  handler: async (ctx, args) => {
    const profile = await requireClient(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.client_id !== profile._id) throw new ConvexError("Forbidden");
    await ctx.db.delete(args.id);
  },
});

export const listMyRequests = query({
  handler: async (ctx) => {
    const profile = await requireClient(ctx);
    const requests = await ctx.db
      .query("approval_requests")
      .withIndex("by_client", (q) => q.eq("client_id", profile._id))
      .order("desc")
      .collect();
    return Promise.all(
      requests.map(async (r) => ({
        ...r,
        decided_by_profile: r.decided_by ? await ctx.db.get(r.decided_by) : null,
      })),
    );
  },
});

export const listPending = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const requests = await ctx.db
      .query("approval_requests")
      .withIndex("by_status", (q) => q.eq("status", "PENDING"))
      .order("desc")
      .collect();
    return Promise.all(
      requests.map(async (r) => {
        const client = await ctx.db.get(r.client_id);
        const quote = await ctx.db.get(r.quote_id);
        const rfq = await ctx.db.get(r.rfq_id);
        return {
          ...r,
          client_public_id: client?.public_id ?? "—",
          client_company_name: (client as any)?.company_name,
          quote_status: quote?.status,
          rfq_category: rfq?.category,
        };
      }),
    );
  },
});

export const listAll = query({
  handler: async (ctx) => {
    await requireAdminRead(ctx);
    const requests = await ctx.db.query("approval_requests").order("desc").collect();
    return Promise.all(
      requests.map(async (r) => {
        const client = await ctx.db.get(r.client_id);
        return {
          ...r,
          client_public_id: client?.public_id ?? "—",
          client_company_name: (client as any)?.company_name,
        };
      }),
    );
  },
});

export const approve = mutation({
  args: { id: v.id("approval_requests"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const request = await ctx.db.get(args.id);
    if (!request) throw new ConvexError("Not found");
    if (request.status !== "PENDING") throw new ConvexError("Already decided");
    await ctx.db.patch(args.id, {
      status: "APPROVED",
      decided_at: Date.now(),
      decided_by: admin._id,
      decision_note: args.note,
    });
    await createOrderFromQuote(ctx, request.quote_id, request.client_id);
    await enqueueNotification(ctx, {
      user_id: request.client_id,
      event_type: "approval.granted",
      title: "Approval granted",
      message: `${request.rule_name} approved.`,
      link: "/client/orders",
    });
    await logAction(ctx, {
      action: "approval_request.approve",
      target_type: "approval_request",
      target_id: args.id,
      before: { status: "PENDING" },
      after: { status: "APPROVED" },
      details: {
        quote_id: request.quote_id,
        client_id: request.client_id,
        rule_name: request.rule_name,
        note: args.note,
      },
    });
  },
});

export const reject = mutation({
  args: { id: v.id("approval_requests"), note: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const request = await ctx.db.get(args.id);
    if (!request) throw new ConvexError("Not found");
    if (request.status !== "PENDING") throw new ConvexError("Already decided");
    await ctx.db.patch(args.id, {
      status: "REJECTED",
      decided_at: Date.now(),
      decided_by: admin._id,
      decision_note: args.note,
    });
    const quote = await ctx.db.get(request.quote_id);
    if (quote && quote.status === "ACCEPTED") {
      await ctx.db.patch(request.quote_id, { status: "REJECTED" });
    }
    await enqueueNotification(ctx, {
      user_id: request.client_id,
      event_type: "approval.rejected",
      title: "Approval rejected",
      message: args.note,
      link: "/client/quotes",
    });
    await logAction(ctx, {
      action: "approval_request.reject",
      target_type: "approval_request",
      target_id: args.id,
      before: { status: "PENDING" },
      after: { status: "REJECTED" },
      details: {
        quote_id: request.quote_id,
        client_id: request.client_id,
        note: args.note,
      },
    });
  },
});

// ==================== Multi-step (PRD §6.6) ====================

export const listMyPendingSteps = query({
  // Steps awaiting the current admin's decision: either explicitly assigned
  // to them, or unassigned (any-admin) within the active group.
  handler: async (ctx) => {
    const admin = await requireAdminRead(ctx);
    const all = await ctx.db
      .query("approval_step_decisions")
      .withIndex("by_status", (q) => q.eq("status", "PENDING"))
      .collect();
    const enriched = await Promise.all(
      all
        .filter((d) => !!d.activated_at) // only currently-active steps
        .filter((d) => !d.approver_admin_id || d.approver_admin_id === admin._id)
        .map(async (d) => {
          const request = await ctx.db.get(d.request_id);
          if (!request) return null;
          const quote = await ctx.db.get(request.quote_id);
          const rfq = await ctx.db.get(request.rfq_id);
          const client = await ctx.db.get(request.client_id);
          return {
            ...d,
            request_id: request._id,
            quote_id: request.quote_id,
            quote_status: quote?.status,
            rfq_id: request.rfq_id,
            rfq_category: rfq?.category,
            client_public_id: client?.public_id ?? "—",
            client_company_name: (client as any)?.company_name,
            quote_total: request.quote_total,
            rule_name: request.rule_name,
          };
        }),
    );
    return enriched.filter(Boolean) as any[];
  },
});

const advanceRequest = async (
  ctx: any,
  requestId: Id<"approval_requests">,
) => {
  // Called after a step decision flips to APPROVED. If every step in the
  // current parallel_group is APPROVED, activate the next group; if no more
  // groups, mark the request APPROVED and create the order.
  const request = await ctx.db.get(requestId);
  if (!request || request.status !== "PENDING") return;
  if (request.current_group == null) return; // legacy single-step path

  const decisions = await ctx.db
    .query("approval_step_decisions")
    .withIndex("by_request", (q: any) => q.eq("request_id", requestId))
    .collect();

  const currentGroupDecisions = decisions.filter(
    (d: any) => d.parallel_group === request.current_group,
  );
  const allCurrentApproved = currentGroupDecisions.every(
    (d: any) => d.status === "APPROVED",
  );
  if (!allCurrentApproved) return;

  const remainingGroups = ([
    ...new Set(
      decisions
        .filter((d: any) => d.status === "PENDING")
        .map((d: any) => d.parallel_group as number),
    ),
  ] as number[]).sort((a, b) => a - b);

  if (remainingGroups.length === 0) {
    // All groups complete → request APPROVED, create the order.
    await ctx.db.patch(requestId, {
      status: "APPROVED",
      decided_at: Date.now(),
    });
    await createOrderFromQuote(ctx, request.quote_id, request.client_id);
    await enqueueNotification(ctx, {
      user_id: request.client_id,
      event_type: "approval.granted",
      title: "Approval granted",
      message: `${request.rule_name} approved.`,
      link: "/client/orders",
    });
    return;
  }

  const nextGroup = remainingGroups[0];
  await ctx.db.patch(requestId, { current_group: nextGroup });
  const now = Date.now();
  const activated: any[] = [];
  for (const d of decisions) {
    if (d.parallel_group === nextGroup && d.status === "PENDING" && !d.activated_at) {
      await ctx.db.patch(d._id, { activated_at: now });
      activated.push(d);
    }
  }
  if (activated.length) {
    await notifyApproversForGroup(ctx, request.rule_name, request.quote_total, activated);
  }
};

export const approveStep = mutation({
  args: { decision_id: v.id("approval_step_decisions"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const decision = await ctx.db.get(args.decision_id);
    if (!decision) throw new ConvexError("Not found");
    if (decision.status !== "PENDING") throw new ConvexError("Already decided");
    if (!decision.activated_at) {
      throw new ConvexError("This step is not yet active in the workflow");
    }
    if (decision.approver_admin_id && decision.approver_admin_id !== admin._id) {
      throw new ConvexError("Assigned to a different approver");
    }
    // Snapshot the approver's signature into the decision row at sign time
    // (PRD §6.6.3) — historical artifacts shouldn't change if the user
    // later replaces their signature image.
    const approverProfile = await ctx.db.get(admin._id);
    await ctx.db.patch(args.decision_id, {
      status: "APPROVED",
      decided_at: Date.now(),
      decided_by: admin._id,
      decision_note: args.note,
      signature_storage_id: (approverProfile as any)?.signature_storage_id ?? undefined,
    });
    await logAction(ctx, {
      action: "approval_step.approve",
      target_type: "approval_step_decision",
      target_id: args.decision_id,
      before: { status: "PENDING" },
      after: { status: "APPROVED" },
      details: {
        request_id: decision.request_id,
        label: decision.label,
        parallel_group: decision.parallel_group,
        note: args.note,
      },
    });
    await advanceRequest(ctx, decision.request_id);
  },
});

export const rejectStep = mutation({
  args: { decision_id: v.id("approval_step_decisions"), note: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const decision = await ctx.db.get(args.decision_id);
    if (!decision) throw new ConvexError("Not found");
    if (decision.status !== "PENDING") throw new ConvexError("Already decided");
    if (!decision.activated_at) {
      throw new ConvexError("This step is not yet active in the workflow");
    }
    if (decision.approver_admin_id && decision.approver_admin_id !== admin._id) {
      throw new ConvexError("Assigned to a different approver");
    }
    if (!args.note.trim()) throw new ConvexError("A reason is required to reject");
    await ctx.db.patch(args.decision_id, {
      status: "REJECTED",
      decided_at: Date.now(),
      decided_by: admin._id,
      decision_note: args.note.trim(),
    });
    // Cascade: any rejection fails the whole request. Skip remaining
    // pending decisions so they don't sit in queues forever.
    const request = await ctx.db.get(decision.request_id);
    if (request && request.status === "PENDING") {
      await ctx.db.patch(decision.request_id, {
        status: "REJECTED",
        decided_at: Date.now(),
        decided_by: admin._id,
        decision_note: args.note.trim(),
      });
      const quote = await ctx.db.get(request.quote_id);
      if (quote && quote.status === "ACCEPTED") {
        await ctx.db.patch(request.quote_id, { status: "REJECTED" });
      }
      const remaining = await ctx.db
        .query("approval_step_decisions")
        .withIndex("by_request", (q) => q.eq("request_id", decision.request_id))
        .collect();
      for (const r of remaining) {
        if (r._id !== decision._id && r.status === "PENDING") {
          await ctx.db.patch(r._id, { status: "SKIPPED" });
        }
      }
      await enqueueNotification(ctx, {
        user_id: request.client_id,
        event_type: "approval.rejected",
        title: "Approval rejected",
        message: args.note.trim(),
        link: "/client/quotes",
      });
    }
    await logAction(ctx, {
      action: "approval_step.reject",
      target_type: "approval_step_decision",
      target_id: args.decision_id,
      before: { status: "PENDING" },
      after: { status: "REJECTED" },
      details: {
        request_id: decision.request_id,
        label: decision.label,
        parallel_group: decision.parallel_group,
        note: args.note,
      },
    });
  },
});

export const listDecisionsForRequest = query({
  args: { request_id: v.id("approval_requests") },
  handler: async (ctx, args) => {
    await requireAdminRead(ctx);
    const decisions = await ctx.db
      .query("approval_step_decisions")
      .withIndex("by_request", (q) => q.eq("request_id", args.request_id))
      .collect();
    return decisions.sort((a, b) =>
      a.parallel_group !== b.parallel_group
        ? a.parallel_group - b.parallel_group
        : a._creationTime - b._creationTime,
    );
  },
});

// Cron entry-point — escalate steps that have been pending past their
// rule's escalation_hours threshold. Fan out a notification to admins so
// nothing rots in queues. Marks the decision row to avoid re-pinging.
export const escalateStaleSteps = internalMutation({
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("approval_step_decisions")
      .withIndex("by_status", (q) => q.eq("status", "PENDING"))
      .collect();
    const now = Date.now();
    let escalated = 0;
    for (const d of pending) {
      if (!d.activated_at || d.escalated_at) continue;
      const rule = await ctx.db.get(d.rule_id);
      if (!rule?.escalation_hours) continue;
      // Saudi business-hour SLA (PRD §8.4): only Sun-Thu working hours
      // and non-holiday time count toward the threshold.
      const elapsed = businessHoursElapsed(d.activated_at, now);
      if (elapsed < rule.escalation_hours) continue;
      await ctx.db.patch(d._id, { escalated_at: now });
      const admins = await ctx.db
        .query("profiles")
        .withIndex("by_role", (q) => q.eq("role", "ADMIN"))
        .collect();
      for (const a of admins) {
        await enqueueNotification(ctx, {
          user_id: a._id,
          event_type: "approval.escalated",
          title: "Approval step escalated",
          message: `${d.label} on ${rule.name} has been pending past its SLA.`,
          link: "/admin/approvals",
        });
      }
      escalated++;
    }
    return { escalated };
  },
});

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "run due rfq schedules",
  { hours: 1 },
  internal.schedules.runDue,
);

crons.daily(
  "flag overdue client invoices",
  { hourUTC: 1, minuteUTC: 0 },
  internal.clientInvoices.flagOverdueDue,
);

// PRD §8.1.5 — daily reconciliation pulls Wafeq invoice state to catch
// status drift the webhook may have missed. 2am UTC ≈ 5am Riyadh; off-peak.
crons.daily(
  "wafeq invoice reconciliation",
  { hourUTC: 2, minuteUTC: 0 },
  internal.wafeq.reconcileNow,
);

// PRD §6.6.1 — escalate stale approval steps that have been pending past
// their rule's escalation_hours threshold. Hourly cadence is plenty given
// SLAs are typically configured in hours, not minutes.
crons.interval(
  "escalate stale approval steps",
  { hours: 1 },
  internal.approvals.escalateStaleSteps,
);

// Phase 2 auto-quote: catch any AUTO_DRAFT whose review_until passed without
// the scheduled flip firing (dev resets, scheduler hiccups). 5-minute cadence
// because the shortest review window is INSTANT — anything longer is fine
// with a 5-min slip.
crons.interval(
  "release expired auto-quote drafts",
  { minutes: 5 },
  internal.autoQuote.sweepExpiredDrafts,
);

// Saved Cart 7-day TTL — clear cart_quantity on entries past their expiry.
// Hourly cadence is plenty for a 7-day timeout.
crons.interval(
  "expire stale carts",
  { hours: 1 },
  internal.clientCatalog.sweepExpiredCarts,
);

export default crons;

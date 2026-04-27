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

export default crons;

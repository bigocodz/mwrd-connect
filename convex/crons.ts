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

export default crons;

/**
 * Saudi calendar helpers (PRD §8.4).
 *
 * - Working week: Sunday–Thursday (Friday & Saturday are weekend)
 * - Public holidays: hardcoded for v1; admin overrides come later in a
 *   system_settings table.
 * - Business hours: a 24-hour business day (no fixed cutoff). Switching
 *   to a window like 09:00–17:00 is a one-line change once we know the
 *   client's preference.
 *
 * All functions are pure — no Convex DB access — so callers can use them
 * from queries, mutations, actions, or React components.
 */

// Saudi Standard Time is UTC+3 with no DST. Working-day boundaries are
// computed in this offset so a 17:00 KSA time on Thursday rolls correctly
// into the weekend rather than treating things as UTC midnight.
const KSA_OFFSET_HOURS = 3;

/** Saudi public holidays in YYYY-MM-DD (Gregorian, KSA local). */
const SAUDI_PUBLIC_HOLIDAYS_2026: ReadonlySet<string> = new Set([
  "2026-02-22",   // Founding Day
  "2026-03-20",   // Eid Al-Fitr (approx — moon-based)
  "2026-03-21",
  "2026-03-22",
  "2026-05-26",   // Eid Al-Adha (approx — moon-based)
  "2026-05-27",
  "2026-05-28",
  "2026-05-29",
  "2026-09-23",   // National Day
]);

const SAUDI_PUBLIC_HOLIDAYS_2027: ReadonlySet<string> = new Set([
  "2027-02-22",
  "2027-03-09",
  "2027-03-10",
  "2027-03-11",
  "2027-05-15",
  "2027-05-16",
  "2027-05-17",
  "2027-05-18",
  "2027-09-23",
]);

const ALL_HOLIDAYS = [
  ...SAUDI_PUBLIC_HOLIDAYS_2026,
  ...SAUDI_PUBLIC_HOLIDAYS_2027,
];

const KSA_DATE_FMT: ReadonlySet<string> = new Set(ALL_HOLIDAYS);

/** Get YYYY-MM-DD in KSA local time. */
function toKsaDateString(ts: number): string {
  const ksaMs = ts + KSA_OFFSET_HOURS * 3600 * 1000;
  const d = new Date(ksaMs);
  // d.getUTC* are now KSA-local because we shifted the timestamp.
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Day-of-week in KSA local time. 0 = Sunday … 6 = Saturday. */
function ksaDayOfWeek(ts: number): number {
  const ksaMs = ts + KSA_OFFSET_HOURS * 3600 * 1000;
  return new Date(ksaMs).getUTCDay();
}

/** Saudi weekend = Friday (5) or Saturday (6). */
export function isSaudiWeekend(ts: number): boolean {
  const dow = ksaDayOfWeek(ts);
  return dow === 5 || dow === 6;
}

export function isSaudiHoliday(ts: number): boolean {
  return KSA_DATE_FMT.has(toKsaDateString(ts));
}

export function isWorkingDay(ts: number): boolean {
  return !isSaudiWeekend(ts) && !isSaudiHoliday(ts);
}

/**
 * How many business hours have elapsed between `start` and `end`?
 *
 * Counts only time that falls on Sun-Thu and outside Saudi public holidays.
 * Hours within a single working day count fully (no business-hour window
 * for v1).
 *
 * Implementation: walk in 1-hour increments. Cheap given typical SLA
 * windows are <= 100 hours. If we ever need to compute over weeks, swap
 * for a closed-form day-counter + minute remainder.
 */
export function businessHoursElapsed(start: number, end: number): number {
  if (end <= start) return 0;
  const HOUR_MS = 3600 * 1000;
  let counted = 0;
  let cursor = start;
  while (cursor < end) {
    const next = Math.min(cursor + HOUR_MS, end);
    const slice = next - cursor;
    if (isWorkingDay(cursor)) counted += slice;
    cursor = next;
  }
  return counted / HOUR_MS;
}

/**
 * Add `hours` business hours to `start`, returning a wall-clock timestamp.
 * Skips weekends + Saudi holidays. Useful for SLA target computation.
 */
export function addBusinessHours(start: number, hours: number): number {
  if (hours <= 0) return start;
  const HOUR_MS = 3600 * 1000;
  let cursor = start;
  let remaining = hours;
  while (remaining > 0) {
    const next = cursor + HOUR_MS;
    if (isWorkingDay(cursor)) {
      remaining -= 1;
      if (remaining <= 0) {
        // Overshot — interpolate the partial last hour
        const overshoot = -remaining; // 0..1
        return next - overshoot * HOUR_MS;
      }
    }
    cursor = next;
  }
  return cursor;
}

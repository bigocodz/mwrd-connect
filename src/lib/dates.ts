/**
 * Date formatting helpers for Saudi-first UX (PRD §8.4).
 *
 * Browsers expose Hijri dates via `Intl.DateTimeFormat` with the
 * `islamic-umalqura` calendar — the official Saudi calendar variant.
 */

export type DateLocale = "ar-SA" | "en-SA";

const HIJRI_LOCALE_AR = "ar-SA-u-ca-islamic-umalqura-nu-arab";
const HIJRI_LOCALE_EN = "en-US-u-ca-islamic-umalqura";

const GREG_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const HIJRI_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

const DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

export function formatGregorian(
  ts: number | string | Date | null | undefined,
  locale: DateLocale = "en-SA",
  options: Intl.DateTimeFormatOptions = GREG_OPTIONS,
): string {
  if (ts == null) return "—";
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(ts));
  } catch {
    return "—";
  }
}

export function formatGregorianDateTime(
  ts: number | string | Date | null | undefined,
  locale: DateLocale = "en-SA",
): string {
  return formatGregorian(ts, locale, DATETIME_OPTIONS);
}

export function formatHijri(
  ts: number | string | Date | null | undefined,
  locale: "ar" | "en" = "ar",
): string {
  if (ts == null) return "—";
  try {
    const fmt = new Intl.DateTimeFormat(
      locale === "ar" ? HIJRI_LOCALE_AR : HIJRI_LOCALE_EN,
      HIJRI_OPTIONS,
    );
    return fmt.format(new Date(ts));
  } catch {
    return "—";
  }
}

/**
 * "12 Apr 2026 · 24 Ramadan 1447" — Gregorian + Hijri side by side.
 */
export function formatDualDate(
  ts: number | string | Date | null | undefined,
  args: { lang: "ar" | "en"; showHijri: boolean; withTime?: boolean },
): string {
  const gregLocale: DateLocale = args.lang === "ar" ? "ar-SA" : "en-SA";
  const greg = args.withTime
    ? formatGregorianDateTime(ts, gregLocale)
    : formatGregorian(ts, gregLocale);
  if (!args.showHijri) return greg;
  return `${greg} · ${formatHijri(ts, args.lang)}`;
}

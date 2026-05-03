/**
 * R14 — Locale primitives.
 *
 * Spec: full RTL support for AR. The `dir` attribute on <html> flips on
 * locale change so CSS logical properties / Tailwind RTL plugins react
 * correctly without per-component knowledge.
 */
export const SUPPORTED_LOCALES = ["en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export type Direction = "ltr" | "rtl";

export function directionFor(locale: Locale): Direction {
  return locale === "ar" ? "rtl" : "ltr";
}

const LOCALE_KEY = "mwrd.locale";

export function loadStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const raw = window.localStorage.getItem(LOCALE_KEY);
  return SUPPORTED_LOCALES.includes(raw as Locale)
    ? (raw as Locale)
    : DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALE_KEY, locale);
}

/**
 * Apply the `dir` and `lang` attributes to `<html>`. Called by the
 * LocaleProvider on mount and on every change.
 */
export function applyHtmlDir(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = directionFor(locale);
}

/**
 * R14 — Locale React context.
 *
 * Wrap the app once at the top:
 *
 *     <LocaleProvider>
 *       <App />
 *     </LocaleProvider>
 *
 * Then any component can do:
 *
 *     const { t, locale, dir, setLocale } = useLocale();
 *     <button>{t("app.signIn")}</button>
 *
 * Persistence: the chosen locale is stored in localStorage so a refresh
 * keeps it. The `<html dir>` and `<html lang>` attributes are kept in
 * sync so CSS logical properties + Tailwind RTL plugins respond.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyHtmlDir,
  DEFAULT_LOCALE,
  directionFor,
  loadStoredLocale,
  persistLocale,
  type Direction,
  type Locale,
} from "./locale";
import { translations, type TranslationKey } from "./translations";

interface LocaleContextValue {
  locale: Locale;
  dir: Direction;
  setLocale: (locale: Locale) => void;
  toggle: () => void;
  /**
   * Look up a translation. Falls back to English when the AR string is
   * missing so the UI never crashes mid-feature. Supports `{var}`
   * interpolation: `t("cart.expiresInDays", { days: 5 })`.
   */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function LocaleProvider({
  children,
  initialLocale,
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? loadStoredLocale(),
  );

  // Sync <html dir|lang> on mount + on every change.
  useEffect(() => {
    applyHtmlDir(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next);
    setLocaleState(next);
  }, []);

  const toggle = useCallback(() => {
    setLocale(locale === "en" ? "ar" : "en");
  }, [locale, setLocale]);

  const t = useCallback<LocaleContextValue["t"]>(
    (key, vars) => {
      const dict = translations[locale];
      const fallback = translations[DEFAULT_LOCALE];
      const raw = dict?.[key] ?? fallback[key] ?? key;
      if (!vars) return raw;
      return Object.entries(vars).reduce(
        (acc, [name, value]) => acc.replace(`{${name}}`, String(value)),
        raw,
      );
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: directionFor(locale),
      setLocale,
      toggle,
      t,
    }),
    [locale, setLocale, toggle, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used inside <LocaleProvider>");
  }
  return ctx;
}

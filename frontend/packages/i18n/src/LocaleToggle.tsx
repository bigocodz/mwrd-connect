/**
 * R14 — Locale toggle button.
 *
 * The label of the button is the OPPOSITE language ("العربية" when the
 * current locale is en, "English" when ar) — clicking it switches.
 * Lives in the page footer per spec.
 */
import { useLocale } from "./LocaleProvider";

export function LocaleToggle({ className }: { className?: string }) {
  const { t, toggle, locale } = useLocale();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("app.toggleLanguage")}
      data-current-locale={locale}
      className={className}
    >
      {t("app.toggleLanguage")}
    </button>
  );
}

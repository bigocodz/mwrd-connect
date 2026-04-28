import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDualDate, formatGregorian, formatGregorianDateTime } from "@/lib/dates";

interface DualDateProps {
  /** Anything Date-constructable, or null/undefined which renders an em-dash. */
  value: number | string | Date | null | undefined;
  /** Render time (HH:MM) alongside the date. */
  withTime?: boolean;
  /** Force showing/hiding Hijri irrespective of profile preference. */
  showHijri?: boolean;
  className?: string;
}

/**
 * Bilingual date renderer (PRD §8.4). Reads the calling user's
 * `show_hijri` preference from their profile when available; otherwise
 * defaults to true (Saudi-first). Honors the active LanguageContext for
 * locale and direction.
 */
export const DualDate = ({ value, withTime, showHijri, className }: DualDateProps) => {
  const { lang } = useLanguage();
  const profile = useQuery(api.users.getMyProfile);
  // Default-on for Saudi-first per PRD §8.4. Explicit prop wins.
  const wantHijri =
    showHijri ??
    ((profile as any)?.show_hijri ?? true);

  if (value == null) return <span className={className}>—</span>;

  if (!wantHijri) {
    const greg = withTime
      ? formatGregorianDateTime(value, lang === "ar" ? "ar-SA" : "en-SA")
      : formatGregorian(value, lang === "ar" ? "ar-SA" : "en-SA");
    return <span className={className}>{greg}</span>;
  }

  return (
    <span className={className}>
      {formatDualDate(value, { lang, showHijri: true, withTime })}
    </span>
  );
};

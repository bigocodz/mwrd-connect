import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

export const VatBadge = ({ className }: { className?: string }) => (
  <Badge variant="outline" className={`text-[10px] font-normal text-[#5e5d59] ${className || ""}`}>
    <VatBadgeText />
  </Badge>
);

const VatBadgeText = () => {
  const { tr } = useLanguage();
  return <>{tr("15% VAT incl.")}</>;
};

const getSarLocale = () => {
  if (typeof document === "undefined") return "en-SA";
  return document.documentElement.lang === "ar" ? "ar-SA" : "en-SA";
};

export const formatSAR = (amount: number) =>
  new Intl.NumberFormat(getSarLocale(), {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

import { Badge } from "@/components/ui/badge";

export const VatBadge = ({ className }: { className?: string }) => (
  <Badge variant="outline" className={`text-[10px] font-normal text-[#5e5d59] ${className || ""}`}>
    15% VAT incl.
  </Badge>
);

export const formatSAR = (amount: number) =>
  new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

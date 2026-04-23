import { Badge } from "@/components/ui/badge";

export const VatBadge = ({ className }: { className?: string }) => (
  <Badge variant="outline" className={`text-[10px] font-normal border-muted-foreground/30 text-muted-foreground ${className || ""}`}>
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

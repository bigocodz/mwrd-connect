import { FileText, Package, CreditCard, Star, ScrollText, Banknote, Users, Receipt } from "lucide-react";

const icons: Record<string, React.ElementType> = {
  rfqs: FileText,
  products: Package,
  payments: CreditCard,
  reviews: Star,
  audit: ScrollText,
  payouts: Banknote,
  users: Users,
  quotes: Receipt,
};

export const EmptyState = ({
  icon = "rfqs",
  title,
  description,
  action,
}: {
  icon?: string | React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) => {
  const Icon = typeof icon === "string" ? icons[icon] || FileText : icon;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-[#c6e4ee] text-[#1a1a1a] shadow-[0_0_0_1px_rgba(117,218,234,0.45)]">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="mb-1 font-display text-[1.2rem] font-semibold text-[#1a1a1a]">{title}</h3>
      {description && <p className="max-w-sm text-center text-sm leading-relaxed text-[#5f625f]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

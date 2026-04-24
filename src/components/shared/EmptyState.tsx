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
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8e6dc] text-[#4d4c48] shadow-[0_0_0_1px_#d1cfc5]">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="mb-1 font-display text-[1.3rem] font-medium text-[#141413]">{title}</h3>
      {description && <p className="max-w-sm text-center text-sm leading-relaxed text-[#5e5d59]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

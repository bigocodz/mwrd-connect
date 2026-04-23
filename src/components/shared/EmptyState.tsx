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
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) => {
  const Icon = icons[icon] || FileText;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground text-center max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

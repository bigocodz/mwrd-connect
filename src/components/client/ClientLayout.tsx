import { BarChartSquareUp, Building02, FileQuestion02, HomeLine, PackageCheck, Receipt, RefreshCcw01, ShoppingBag03, ShoppingCart01, Wallet02 } from "@untitledui/icons";
import AppShell from "@/components/app/AppShell";

const navItems = [
  { label: "Dashboard", href: "/client/dashboard", icon: HomeLine },
  { label: "Product Catalog", href: "/client/catalog", icon: ShoppingBag03 },
  { label: "Cart", href: "/client/cart", icon: ShoppingCart01 },
  { label: "My RFQs", href: "/client/rfqs", icon: FileQuestion02 },
  { label: "Repeat RFQs", href: "/client/schedules", icon: RefreshCcw01 },
  { label: "Quotes", href: "/client/quotes", icon: Receipt },
  { label: "Orders", href: "/client/orders", icon: PackageCheck },
  { label: "Invoices", href: "/client/invoices", icon: Receipt },
  { label: "Reports", href: "/client/reports", icon: BarChartSquareUp },
  { label: "Organization", href: "/client/organization", icon: Building02 },
  { label: "Account & Billing", href: "/client/account", icon: Wallet02 },
];

const ClientLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <AppShell navItems={navItems} portalLabel="Client Portal" portalTone="client">
      {children}
    </AppShell>
  );
};

export default ClientLayout;

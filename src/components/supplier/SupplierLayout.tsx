import { BankNote01, BarChartSquareUp, FileCheck02, FileShield02, HomeLine, Package, PackageCheck, PackageSearch, Receipt, Star01, Lightning01 } from "@untitledui/icons";
import AppShell from "@/components/app/AppShell";

const navItems = [
  { label: "Dashboard", href: "/supplier/dashboard", icon: HomeLine },
  { label: "Browse Catalog", href: "/supplier/catalog", icon: PackageSearch },
  { label: "My Products", href: "/supplier/products", icon: Package },
  { label: "Auto-Quote Queue", href: "/supplier/auto-quotes", icon: Lightning01 },
  { label: "Assigned RFQs", href: "/supplier/rfqs", icon: FileCheck02 },
  { label: "Orders", href: "/supplier/orders", icon: PackageCheck },
  { label: "Delivery Notes", href: "/supplier/delivery-notes", icon: FileCheck02 },
  { label: "Invoices", href: "/supplier/invoices", icon: Receipt },
  { label: "Payouts", href: "/supplier/payouts", icon: BankNote01 },
  { label: "Performance", href: "/supplier/analytics", icon: BarChartSquareUp },
  { label: "KYC Documents", href: "/supplier/kyc", icon: FileShield02 },
  { label: "Reviews", href: "/supplier/reviews", icon: Star01 },
];

const SupplierLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <AppShell navItems={navItems} portalLabel="Supplier Portal" portalTone="supplier">
      {children}
    </AppShell>
  );
};

export default SupplierLayout;

import { BankNote01, FileCheck02, HomeLine, Package, Star01 } from "@untitledui/icons";
import AppShell from "@/components/app/AppShell";

const navItems = [
  { label: "Dashboard", href: "/supplier/dashboard", icon: HomeLine },
  { label: "My Products", href: "/supplier/products", icon: Package },
  { label: "Assigned RFQs", href: "/supplier/rfqs", icon: FileCheck02 },
  { label: "Payouts", href: "/supplier/payouts", icon: BankNote01 },
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

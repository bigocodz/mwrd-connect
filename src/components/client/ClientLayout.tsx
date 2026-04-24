import { FileQuestion02, HomeLine, Receipt, ShoppingBag03, Wallet02 } from "@untitledui/icons";
import AppShell from "@/components/app/AppShell";

const navItems = [
  { label: "Dashboard", href: "/client/dashboard", icon: HomeLine },
  { label: "Product Catalog", href: "/client/catalog", icon: ShoppingBag03 },
  { label: "My RFQs", href: "/client/rfqs", icon: FileQuestion02 },
  { label: "Quotes", href: "/client/quotes", icon: Receipt },
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

import {
  BankNote01,
  BarChartSquareUp,
  CreditCard01,
  FileQuestion02,
  FileSearch01,
  HomeLine,
  Inbox01,
  PackageSearch,
  Percent03,
  Receipt,
  Star01,
  Users01,
} from "@untitledui/icons";
import AppShell from "@/components/app/AppShell";

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: HomeLine },
  { label: "Leads", href: "/admin/leads", icon: Inbox01 },
  { label: "Users", href: "/admin/users", icon: Users01 },
  { label: "Products", href: "/admin/products/pending", icon: PackageSearch },
  { label: "Margins", href: "/admin/margin-settings", icon: Percent03 },
  { label: "RFQs", href: "/admin/rfqs", icon: FileQuestion02 },
  { label: "Quotes", href: "/admin/quotes/pending", icon: Receipt },
  { label: "Payments", href: "/admin/payments", icon: CreditCard01 },
  { label: "Credit", href: "/admin/credit", icon: BarChartSquareUp },
  { label: "Payouts", href: "/admin/payouts", icon: BankNote01 },
  { label: "Reviews", href: "/admin/reviews", icon: Star01 },
  { label: "Audit Log", href: "/admin/audit-log", icon: FileSearch01 },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <AppShell navItems={navItems} portalLabel="Admin Portal" portalTone="admin">
      {children}
    </AppShell>
  );
};

export default AdminLayout;

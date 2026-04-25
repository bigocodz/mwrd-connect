import {
  AlertCircle,
  BankNote01,
  BarChartSquareUp,
  ClockRefresh,
  CreditCard01,
  FileLock02,
  FileQuestion02,
  FileSearch01,
  HomeLine,
  Inbox01,
  PackageCheck,
  PackageSearch,
  Percent03,
  Receipt,
  ReceiptCheck,
  ShieldTick,
  Star01,
  Users01,
} from "@untitledui/icons";
import AppShell from "@/components/app/AppShell";

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: HomeLine },
  { label: "Lifecycle & SLA", href: "/admin/lifecycle", icon: ClockRefresh },
  { label: "Leads", href: "/admin/leads", icon: Inbox01 },
  { label: "Users", href: "/admin/users", icon: Users01 },
  { label: "Products", href: "/admin/products/pending", icon: PackageSearch },
  { label: "Margins", href: "/admin/margin-settings", icon: Percent03 },
  { label: "RFQs", href: "/admin/rfqs", icon: FileQuestion02 },
  { label: "Quotes", href: "/admin/quotes/pending", icon: Receipt },
  { label: "Approvals", href: "/admin/approvals", icon: ShieldTick },
  { label: "Orders", href: "/admin/orders", icon: PackageCheck },
  { label: "Disputes", href: "/admin/disputes", icon: AlertCircle },
  { label: "Contracts", href: "/admin/contracts", icon: FileLock02 },
  { label: "Client Invoices", href: "/admin/client-invoices", icon: Receipt },
  { label: "Supplier Invoices", href: "/admin/supplier-invoices", icon: ReceiptCheck },
  { label: "Payments", href: "/admin/payments", icon: CreditCard01 },
  { label: "Credit", href: "/admin/credit", icon: BarChartSquareUp },
  { label: "Payouts", href: "/admin/payouts", icon: BankNote01 },
  { label: "Preferred Suppliers", href: "/admin/preferred-suppliers", icon: Star01 },
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

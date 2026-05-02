import {
  AlertCircle,
  BankNote01,
  BarChartSquareUp,
  ClockRefresh,
  CreditCard01,
  FileLock02,
  FileQuestion02,
  FileSearch01,
  FolderCode,
  HomeLine,
  Inbox01,
  Package,
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
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: HomeLine },
  { label: "Lifecycle & SLA", href: "/admin/lifecycle", icon: ClockRefresh },
  { label: "Leads", href: "/admin/leads", icon: Inbox01 },
  { label: "Users", href: "/admin/users", icon: Users01 },
  { label: "Categories", href: "/admin/categories", icon: FolderCode },
  { label: "Master Catalog", href: "/admin/master-catalog", icon: Package },
  { label: "Product Requests", href: "/admin/product-requests", icon: Inbox01 },
  { label: "Pending Offers", href: "/admin/products/pending", icon: PackageSearch },
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
  { label: "Templates", href: "/admin/templates", icon: FileLock02 },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile } = useAuth();
  // PRD §13.4 — auditors share every admin route but in a read-only mode.
  // Surface that explicitly via the portal label so they (and anyone in a
  // shared screen) see they're on the audit-only viewer.
  const isAuditor = profile?.role === "AUDITOR";
  const portalLabel = isAuditor ? "Audit Portal (read-only)" : "Admin Portal";
  return (
    <AppShell navItems={navItems} portalLabel={portalLabel} portalTone="admin">
      {children}
    </AppShell>
  );
};

export default AdminLayout;

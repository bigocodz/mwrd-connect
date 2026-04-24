import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Package, Percent, FileText, Receipt, CreditCard, DollarSign, Banknote, Star, ScrollText, LogOut, Inbox } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/admin/leads", icon: Inbox },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Products", href: "/admin/products/pending", icon: Package },
  { label: "Margins", href: "/admin/margin-settings", icon: Percent },
  { label: "RFQs", href: "/admin/rfqs", icon: FileText },
  { label: "Quotes", href: "/admin/quotes/pending", icon: Receipt },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Credit", href: "/admin/credit", icon: DollarSign },
  { label: "Payouts", href: "/admin/payouts", icon: Banknote },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Audit Log", href: "/admin/audit-log", icon: ScrollText },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, profile } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-4 border-b border-border">
          <Link to="/admin/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-sm">M</span>
            </div>
            <span className="font-display font-bold text-lg text-foreground">MWRD</span>
          </Link>
          <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full mt-2 inline-block">Admin Portal</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground truncate px-3">{profile?.public_id}</p>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2 text-muted-foreground">
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="border-b border-border bg-card px-6 h-14 flex items-center justify-end gap-2 shrink-0">
          <NotificationBell />
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;

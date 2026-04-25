import type { ComponentType, ReactNode, SVGProps } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut01 } from "@untitledui/icons";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/NotificationBell";

type ShellIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number; color?: string }>;

export type AppShellNavItem = {
  label: string;
  href: string;
  icon: ShellIcon;
};

type AppShellProps = {
  children: ReactNode;
  navItems: AppShellNavItem[];
  portalLabel: string;
  portalTone: "client" | "supplier" | "admin";
};

const toneClasses = {
  client: "bg-[#f7e9e1] text-[#8d422d] shadow-[0_0_0_1px_#eed1c5]",
  supplier: "bg-[#eef4e8] text-[#556b45] shadow-[0_0_0_1px_#d9e4cf]",
  admin: "bg-[#f7e9e1] text-[#8d422d] shadow-[0_0_0_1px_#eed1c5]",
};

const AppShell = ({ children, navItems, portalLabel, portalTone }: AppShellProps) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#f5f4ed] text-[#141413] lg:flex">
      <aside className="hidden w-72 shrink-0 bg-[#faf9f5] shadow-[inset_-1px_0_0_#e8e6dc] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-[#f0eee6] px-5 py-5">
          <Link to={navItems[0]?.href ?? "/"} className="flex items-center gap-3">
            <img src="/logo.png" alt="MWRD" className="h-10 w-10 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="font-display text-xl font-medium leading-6 text-[#141413]">MWRD</p>
              <p className="text-xs leading-5 text-[#5e5d59]">Procurement workspace</p>
            </div>
          </Link>
          <span className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-medium tracking-[0.12px] ${toneClasses[portalTone]}`}>
            {portalLabel}
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#30302e] text-[#faf9f5] shadow-[0_0_0_1px_#30302e]"
                    : "text-[#5e5d59] hover:bg-[#e8e6dc] hover:text-[#141413]"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#f0eee6] p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#f5f4ed] p-3 shadow-[0_0_0_1px_#e8e6dc]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8e6dc] text-sm font-medium text-[#4d4c48]">
              {(profile?.company_name || profile?.public_id || "M").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#141413]">{profile?.company_name || "MWRD account"}</p>
              <p className="truncate text-xs text-[#87867f]">{profile?.public_id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#5e5d59] transition-colors hover:bg-[#e8e6dc] hover:text-[#141413]"
          >
            <LogOut01 className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[#e8e6dc] bg-[#faf9f5]/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <img src="/logo.png" alt="MWRD" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0">
                <p className="truncate font-display text-base font-medium text-[#141413]">MWRD</p>
                <p className="truncate text-xs text-[#5e5d59]">{portalLabel}</p>
              </div>
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="text-sm font-medium text-[#141413]">{profile?.company_name || portalLabel}</p>
              <p className="text-xs text-[#87867f]">{profile?.public_id}</p>
            </div>
            <NotificationBell />
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-[#f0eee6] px-4 py-2 lg:hidden">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? "bg-[#30302e] text-[#faf9f5]" : "text-[#5e5d59]"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;

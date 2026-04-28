import { useEffect, useState } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { Link, useLocation } from "react-router-dom";
import { Globe01, LogOut01 } from "@untitledui/icons";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/NotificationBell";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

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
  client: "bg-[#eaf8fb] text-[#1a1a1a]",
  supplier: "bg-[#e7f8f2] text-[#246b55]",
  admin: "bg-[#fff1eb] text-[#ba4424]",
};

const SIDEBAR_COLLAPSED_KEY = "mwrd_sidebar_collapsed";

const buildNavSections = (portalTone: AppShellProps["portalTone"], navItems: AppShellNavItem[]) => {
  if (portalTone === "admin") {
    return [
      { label: "Workspace", items: navItems.slice(0, 6) },
      { label: "Operations", items: navItems.slice(6, 13) },
      { label: "Finance & Compliance", items: navItems.slice(13, 19) },
      { label: "Governance", items: navItems.slice(19) },
    ].filter((section) => section.items.length > 0);
  }

  if (portalTone === "supplier") {
    return [
      { label: "Supply Desk", items: navItems.slice(0, 5) },
      { label: "Business", items: navItems.slice(5) },
    ].filter((section) => section.items.length > 0);
  }

  return [
    { label: "Procurement", items: navItems.slice(0, 6) },
    { label: "Company", items: navItems.slice(6) },
  ].filter((section) => section.items.length > 0);
};

const AppShell = ({ children, navItems, portalLabel, portalTone }: AppShellProps) => {
  const { profile, signOut } = useAuth();
  const { lang, setLang, tr, dir } = useLanguage();
  const location = useLocation();
  const navSections = buildNavSections(portalTone, navItems);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // Ignore persistence errors.
    }
  }, [collapsed]);

  const activeLabel = navItems.find((item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`))?.label ?? portalLabel;

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#1a1a1a] lg:flex" dir={dir}>
      <aside
        className={cn(
          "relative hidden shrink-0 overflow-hidden border-e border-[#eef0f3] bg-white text-[#1a1a1a] transition-[width] duration-300 ease-out lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col",
          collapsed ? "w-[5.5rem]" : "w-[280px]",
        )}
      >
        <div className={cn("relative px-5 py-5", collapsed && "px-3")}>
          <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "justify-between")}>
            <Link to={navItems[0]?.href ?? "/"} className={cn("block min-w-0", collapsed && "pointer-events-auto")}>
              <span
                className={cn(
                  "inline-flex bg-white",
                  collapsed ? "h-11 w-11 items-center justify-center overflow-hidden rounded-lg p-2 shadow-[0_0_0_1px_rgba(238,240,243,1)]" : "rounded-lg",
                )}
              >
                <img src="/logos/asset-2.svg" alt="MWRD" className={cn("h-9 w-auto max-w-[138px]", collapsed && "h-7 max-w-none scale-[1.85]")} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className={cn(
                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#e4e7ec] bg-white text-[#98a2b3] transition-colors hover:bg-[#ff6d43] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75daea]",
                collapsed && "absolute -end-3 top-6 z-10 shadow-sm",
              )}
              aria-label={tr(collapsed ? "Expand sidebar" : "Collapse sidebar")}
              title={tr(collapsed ? "Expand sidebar" : "Collapse sidebar")}
            >
              {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            </button>
          </div>
          {!collapsed && (
            <>
              <p className="mt-3 text-xs leading-5 text-[#667085]">{tr("Managed procurement workspace")}</p>
              <span className={`mt-4 inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold tracking-normal ${toneClasses[portalTone]}`}>
                {tr(portalLabel)}
              </span>
            </>
          )}
        </div>

        <nav className={cn("relative flex-1 overflow-y-auto pb-5", collapsed ? "px-3" : "px-5")}>
          <div className="space-y-6">
            {navSections.map((section) => (
              <div key={section.label}>
                {!collapsed && (
                  <p className="mb-2 px-0.5 text-xs font-medium uppercase tracking-normal text-[#667085]">
                    {tr(section.label)}
                  </p>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        title={collapsed ? tr(item.label) : undefined}
                        className={cn(
                          "group relative flex items-center rounded-xl text-sm font-medium transition-colors",
                          collapsed ? "h-12 justify-center px-0" : "gap-3 px-3 py-3",
                          isActive
                            ? "bg-[#ff6d43] text-white"
                            : "text-[#344054] hover:bg-[#fff1eb] hover:text-[#1a1a1a]",
                        )}
                      >
                        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", isActive ? "text-white" : "text-[#475467] group-hover:text-[#ff6d43]")}>
                          <item.icon className="h-5 w-5" />
                        </span>
                        {!collapsed && <span className="truncate">{tr(item.label)}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className={cn("relative border-t border-[#eef0f3] p-4", collapsed && "px-3")}>
          <Link
            to="/account"
            className={cn(
              "mb-2 flex items-center rounded-xl bg-[#f9fafb] transition-colors hover:bg-[#f1f3f6]",
              collapsed ? "justify-center p-2" : "gap-3 p-2",
            )}
            title={collapsed ? tr("My account") : undefined}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1a1a1a] text-sm font-semibold text-white">
              {(profile?.company_name || profile?.public_id || "M").slice(0, 1).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1d2939]">{profile?.company_name || tr("MWRD account")}</p>
                <p className="truncate text-xs text-[#667085]">{profile?.public_id || tr(portalLabel)}</p>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={signOut}
            title={collapsed ? tr("Sign out") : undefined}
            className={cn(
              "flex w-full items-center rounded-xl text-sm font-semibold text-[#667085] transition-colors hover:bg-[#fff1eb] hover:text-[#ba4424]",
              collapsed ? "h-10 justify-center" : "gap-2 px-3 py-2",
            )}
          >
            <LogOut01 className="h-5 w-5" />
            {!collapsed && tr("Sign out")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 bg-[#f5f6f8]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-20 w-full max-w-[1560px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <div className="min-w-0">
                <img src="/logos/asset-2.svg" alt="MWRD" className="h-8 w-auto max-w-[118px]" />
                <p className="truncate text-xs text-[#5f625f]">{tr(portalLabel)}</p>
              </div>
            </div>
            <div className="hidden min-w-0 flex-1 items-center gap-4 lg:flex">
              <label className="flex h-12 w-full max-w-[340px] items-center gap-3 rounded-xl border border-transparent bg-white px-4 text-[#98a2b3] transition-colors focus-within:border-[#ff6d43]">
                <Search className="h-5 w-5 shrink-0" />
                <input
                  type="search"
                  className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[#344054] outline-none placeholder:text-[#98a2b3] focus:ring-0"
                  placeholder={tr("Search")}
                  aria-label={tr("Search")}
                />
                <span className="inline-flex h-[27px] min-w-9 items-center justify-center rounded-lg border border-[#e4e7ec] px-2 text-xs font-semibold text-[#98a2b3]">
                  ⌘ K
                </span>
              </label>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-normal text-[#667085]">{tr(portalLabel)}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-[#1d2939]">{tr(activeLabel)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-[#667085] transition-colors hover:bg-[#fff1eb] hover:text-[#1a1a1a]"
                aria-label={tr("Toggle language")}
              >
                <Globe01 className="h-5 w-5" />
                {lang === "en" ? "عربي" : "EN"}
              </button>
              <NotificationBell />
              <Link
                to="/account"
                className="hidden items-center gap-3 rounded-xl bg-white p-1.5 transition-colors hover:bg-[#fff1eb] sm:flex"
                title={tr("My account")}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ff6d43] text-sm font-semibold text-white">
                  {(profile?.company_name || profile?.public_id || "M").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 pe-1">
                  <p className="max-w-36 truncate text-sm font-semibold leading-tight text-[#1d2939]">{profile?.company_name || tr("MWRD account")}</p>
                  <p className="max-w-36 truncate text-xs text-[#667085]">{profile?.public_id || tr(portalLabel)}</p>
                </div>
                <ChevronDown className="me-2 h-4 w-4 shrink-0 text-[#667085]" />
              </Link>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-[#eef0f3] px-4 py-2 lg:hidden">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
                    isActive ? "bg-[#ff6d43] text-white" : "bg-white text-[#667085]",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {tr(item.label)}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto flex w-full max-w-[1560px] flex-1 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
          <div className="min-w-0 flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;

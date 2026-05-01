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

const portalChip = {
  client: "bg-information-lighter text-information-base ring-information-light/60",
  supplier: "bg-success-lighter text-success-base ring-success-light/60",
  admin: "bg-primary-light text-primary-dark ring-primary-alpha-16",
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
    <div className="min-h-screen bg-bg-shell text-strong-950 lg:flex" dir={dir}>
      <aside
        className={cn(
          "relative hidden shrink-0 overflow-hidden border-e border-stroke-soft-200 bg-bg-shell text-strong-950 shadow-[var(--shadow-regular-inset)] transition-[width] duration-300 ease-out lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col",
          collapsed ? "w-[5.5rem]" : "w-[272px]",
        )}
      >
        <div className={cn("relative px-5 pt-5 pb-4", collapsed && "px-3")}>
          <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "justify-between")}>
            <Link to={navItems[0]?.href ?? "/"} className={cn("block min-w-0", collapsed && "pointer-events-auto")}>
              <span
                className={cn(
                  "inline-flex bg-bg-panel shadow-[var(--shadow-regular-xs)]",
                  collapsed
                    ? "h-11 w-11 items-center justify-center overflow-hidden rounded-10 p-2 ring-1 ring-stroke-soft-200"
                    : "rounded-10 px-2 py-1.5",
                )}
              >
                <img
                  src="/logos/primary-logo-orange.svg"
                  alt="MWRD"
                  className={cn("h-9 w-auto max-w-[138px]", collapsed && "h-7 max-w-none scale-[1.85]")}
                />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-8 border border-stroke-soft-200 bg-bg-panel text-soft-400 transition-colors hover:border-stroke-sub-300 hover:text-strong-950 focus-visible:outline-none focus-visible:shadow-[var(--shadow-button-neutral-focus)]",
                collapsed && "absolute -end-3.5 top-6 z-10 shadow-[var(--shadow-regular-sm)]",
              )}
              aria-label={tr(collapsed ? "Expand sidebar" : "Collapse sidebar")}
              title={tr(collapsed ? "Expand sidebar" : "Collapse sidebar")}
            >
              {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            </button>
          </div>
          {!collapsed && (
            <>
              <p className="mt-3 text-xs leading-5 text-soft-400">{tr("Procurement workspace")}</p>
              <span
                className={cn(
                  "mt-3 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1",
                  portalChip[portalTone],
                )}
              >
                {tr(portalLabel)}
              </span>
            </>
          )}
        </div>

        <nav className={cn("relative flex-1 overflow-y-auto pb-5", collapsed ? "px-3" : "px-3")}>
          <div className="flex flex-col gap-5">
            {navSections.map((section) => (
              <div key={section.label}>
                {!collapsed && (
                  <p className="mb-1.5 px-2 text-[11px] font-semibold text-soft-400">
                    {tr(section.label)}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => {
                    const isActive =
                      location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        title={collapsed ? tr(item.label) : undefined}
                        className={cn(
                          "group relative flex items-center rounded-10 text-sm font-medium transition-[background-color,color,box-shadow]",
                          collapsed ? "h-11 justify-center px-0" : "gap-3 px-2.5 py-2",
                          isActive
                            ? "bg-bg-panel text-strong-950 shadow-[var(--shadow-regular-sm)] before:absolute before:inset-y-2 before:start-0 before:w-1 before:rounded-full before:bg-primary-base"
                            : "text-sub-600 hover:bg-bg-panel hover:text-strong-950",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center",
                            isActive ? "text-primary-base" : "text-soft-400 group-hover:text-strong-950",
                          )}
                        >
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

        <div className={cn("relative border-t border-stroke-soft-200 p-3", collapsed && "px-2")}>
          <Link
            to="/account"
            className={cn(
              "mb-1.5 flex items-center rounded-10 transition-colors hover:bg-bg-panel",
              collapsed ? "justify-center p-1.5" : "gap-3 p-2",
            )}
            title={collapsed ? tr("My account") : undefined}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-10 bg-strong-950 text-sm font-semibold text-white-0">
              {(profile?.company_name || profile?.public_id || "M").slice(0, 1).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-strong-950">
                  {profile?.company_name || tr("MWRD account")}
                </p>
                <p className="truncate text-xs text-soft-400">{profile?.public_id || tr(portalLabel)}</p>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={signOut}
            title={collapsed ? tr("Sign out") : undefined}
            className={cn(
              "flex w-full items-center rounded-10 text-sm font-medium text-sub-600 transition-colors hover:bg-bg-panel hover:text-strong-950",
              collapsed ? "h-10 justify-center" : "gap-2 px-2.5 py-2",
            )}
          >
            <LogOut01 className="h-4 w-4" />
            {!collapsed && tr("Sign out")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-stroke-soft-200 bg-bg-shell/88 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1560px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <div className="min-w-0">
                <img src="/logos/primary-logo-orange.svg" alt="MWRD" className="h-7 w-auto max-w-[112px]" />
                <p className="truncate text-xs text-soft-400">{tr(portalLabel)}</p>
              </div>
            </div>
            <div className="hidden min-w-0 flex-1 items-center gap-4 lg:flex">
              <label className="flex h-10 w-full max-w-[360px] items-center gap-2.5 rounded-10 border border-stroke-soft-200 bg-bg-panel px-3 text-soft-400 shadow-[var(--shadow-regular-xs)] transition-colors focus-within:border-primary-base focus-within:shadow-[var(--shadow-button-primary-focus)]">
                <Search className="h-4 w-4 shrink-0" />
                <input
                  type="search"
                  className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-strong-950 outline-none placeholder:text-soft-400 focus:ring-0"
                  placeholder={tr("Search")}
                  aria-label={tr("Search")}
                />
                <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-6 border border-stroke-soft-200 bg-bg-weak-50 px-1.5 text-[11px] font-medium text-soft-400">
                  ⌘ K
                </span>
              </label>
              <div className="min-w-0 border-s border-stroke-soft-200 ps-4">
                <p className="text-[11px] font-semibold text-soft-400">
                  {tr(portalLabel)}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-strong-950">{tr(activeLabel)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="inline-flex h-10 items-center gap-2 rounded-10 border border-stroke-soft-200 bg-bg-panel px-3 text-sm font-medium text-sub-600 shadow-[var(--shadow-regular-xs)] transition-colors hover:bg-bg-white-0 hover:text-strong-950"
                aria-label={tr("Toggle language")}
              >
                <Globe01 className="h-4 w-4" />
                {lang === "en" ? "عربي" : "EN"}
              </button>
              <NotificationBell />
              <Link
                to="/account"
                className="hidden items-center gap-3 rounded-10 border border-stroke-soft-200 bg-bg-panel p-1 pe-2 shadow-[var(--shadow-regular-xs)] transition-colors hover:bg-bg-white-0 sm:flex"
                title={tr("My account")}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-8 bg-primary-base text-sm font-semibold text-white-0">
                  {(profile?.company_name || profile?.public_id || "M").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 pe-1">
                  <p className="max-w-36 truncate text-sm font-medium leading-tight text-strong-950">
                    {profile?.company_name || tr("MWRD account")}
                  </p>
                  <p className="max-w-36 truncate text-[11px] text-soft-400">
                    {profile?.public_id || tr(portalLabel)}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-soft-400" />
              </Link>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-stroke-soft-200 px-4 py-2 lg:hidden">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-10 px-3 py-1.5 text-sm font-medium",
                    isActive
                      ? "bg-primary-base text-white-0 shadow-[var(--shadow-regular-xs)]"
                      : "border border-stroke-soft-200 bg-bg-panel text-sub-600",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {tr(item.label)}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto flex w-full max-w-[1560px] flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <div className="min-w-0 flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { Link, useLocation } from "react-router-dom";
import { Globe01, LogOut01 } from "@untitledui/icons";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
  client: "bg-[#c6e4ee] text-[#1a1a1a] shadow-[0_0_0_1px_rgba(117,218,234,0.38)]",
  supplier: "bg-[#e7f8f2] text-[#246b55] shadow-[0_0_0_1px_rgba(36,107,85,0.14)]",
  admin: "bg-[#fff1eb] text-[#ba4424] shadow-[0_0_0_1px_rgba(255,109,67,0.18)]",
};

const SIDEBAR_COLLAPSED_KEY = "mwrd_sidebar_collapsed";

const AppShell = ({ children, navItems, portalLabel, portalTone }: AppShellProps) => {
  const { profile, signOut } = useAuth();
  const { lang, setLang, tr } = useLanguage();
  const location = useLocation();
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

  return (
    <div className="min-h-screen bg-[#f7f8f7] text-[#1a1a1a] lg:flex">
      <aside
        className={cn(
          "relative hidden shrink-0 overflow-hidden border-e border-[#272724] bg-[#151615] text-white transition-[width] duration-300 ease-out lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col",
          collapsed ? "w-[5.75rem]" : "w-72",
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(255,109,67,0.85),rgba(117,218,234,0.65),rgba(190,184,174,0))]" />
        <div className={cn("relative border-b border-white/[0.08] px-4 py-4", collapsed && "px-3")}>
          <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "justify-between")}>
            <Link to={navItems[0]?.href ?? "/"} className={cn("block min-w-0", collapsed && "pointer-events-auto")}>
              <span
                className={cn(
                  "inline-flex bg-white shadow-[inset_0_0_0_1px_rgba(190,184,174,0.38)]",
                  collapsed ? "h-11 w-11 items-center justify-center overflow-hidden rounded-md p-2" : "rounded-md px-3 py-2",
                )}
              >
                <img src="/logos/asset-2.svg" alt="MWRD" className={cn("h-8 w-auto max-w-[142px]", collapsed && "h-7 max-w-none scale-[1.8]")} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75daea]",
                collapsed && "absolute -end-3 top-5 z-10 bg-[#20211f] shadow-[0_0_0_1px_rgba(255,255,255,0.1)]",
              )}
              aria-label={tr(collapsed ? "Expand sidebar" : "Collapse sidebar")}
              title={tr(collapsed ? "Expand sidebar" : "Collapse sidebar")}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          {!collapsed && (
            <>
              <p className="mt-3 text-xs leading-5 text-white/50">{tr("Procurement workspace")}</p>
              <span className={`mt-4 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold tracking-normal ${toneClasses[portalTone]}`}>
                {tr(portalLabel)}
              </span>
            </>
          )}
        </div>

        <nav className={cn("relative flex-1 space-y-1 overflow-y-auto py-3", collapsed ? "px-3" : "px-3")}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                to={item.href}
                title={collapsed ? tr(item.label) : undefined}
                className={cn(
                  "group relative flex items-center rounded-md text-sm font-semibold transition-all",
                  collapsed ? "h-11 justify-center px-0" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-[#252622] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
                    : "text-white/62 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "absolute start-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-e-full transition-opacity",
                    isActive ? "bg-[#ff6d43] opacity-100" : "bg-white/30 opacity-0 group-hover:opacity-100",
                  )}
                />
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
                    isActive ? "bg-[#ff6d43] text-white" : "bg-white/[0.06] text-white/58 group-hover:text-white",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                {!collapsed && <span className="truncate">{tr(item.label)}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={cn("relative border-t border-white/[0.08] p-3", collapsed && "px-3")}>
          <div
            className={cn(
              "mb-2 flex items-center rounded-md bg-white/[0.045] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
              collapsed ? "justify-center p-2" : "gap-3 p-3",
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#ff6d43] text-sm font-semibold text-white">
              {(profile?.company_name || profile?.public_id || "M").slice(0, 1).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{profile?.company_name || tr("MWRD account")}</p>
                <p className="truncate text-xs text-white/42">{profile?.public_id}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={signOut}
            title={collapsed ? tr("Sign out") : undefined}
            className={cn(
              "flex w-full items-center rounded-md text-sm font-semibold text-white/58 transition-colors hover:bg-white/[0.06] hover:text-white",
              collapsed ? "h-10 justify-center" : "gap-2 px-3 py-2",
            )}
          >
            <LogOut01 className="h-5 w-5" />
            {!collapsed && tr("Sign out")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[#ded8d0] bg-white/[0.92] backdrop-blur-xl">
          <div className="mx-auto flex h-[4.35rem] w-full max-w-[1560px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <div className="min-w-0">
                <img src="/logos/asset-2.svg" alt="MWRD" className="h-8 w-auto max-w-[118px]" />
                <p className="truncate text-xs text-[#5f625f]">{tr(portalLabel)}</p>
              </div>
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="text-xs font-semibold uppercase tracking-normal text-[#8a8a85]">{tr(portalLabel)}</p>
              <p className="mt-0.5 text-sm font-semibold text-[#1a1a1a]">{profile?.company_name || tr("MWRD account")}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#f7f8f7] px-3 text-sm font-semibold text-[#5f625f] shadow-[inset_0_0_0_1px_rgba(190,184,174,0.48)] transition-colors hover:bg-[#eef7f8] hover:text-[#1a1a1a]"
                aria-label={tr("Toggle language")}
              >
                <Globe01 className="h-5 w-5" />
                {lang === "en" ? "عربي" : "EN"}
              </button>
              <NotificationBell />
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-[#ece7e1] px-4 py-2 lg:hidden">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                    isActive ? "bg-[#1a1a1a] text-white" : "text-[#5f625f]"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {tr(item.label)}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto flex w-full max-w-[1560px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="min-w-0 flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;

import type { ComponentType, ReactNode, SVGProps } from "react";
import { Link, useLocation } from "react-router-dom";
import { Globe01, LogOut01 } from "@untitledui/icons";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/NotificationBell";
import { useLanguage } from "@/contexts/LanguageContext";

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
  client: "bg-[#c6e4ee] text-[#1a1a1a] shadow-[0_0_0_1px_rgba(117,218,234,0.5)]",
  supplier: "bg-[#e7f8f2] text-[#246b55] shadow-[0_0_0_1px_rgba(36,107,85,0.16)]",
  admin: "bg-[#fff1eb] text-[#ba4424] shadow-[0_0_0_1px_rgba(255,109,67,0.22)]",
};

const AppShell = ({ children, navItems, portalLabel, portalTone }: AppShellProps) => {
  const { profile, signOut } = useAuth();
  const { lang, setLang, tr } = useLanguage();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#f7f8f7] text-[#1a1a1a] lg:flex">
      <aside className="relative hidden w-72 shrink-0 overflow-hidden border-e border-black bg-[#1a1a1a] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(135deg,rgba(198,228,238,0.13),rgba(255,109,67,0.16))]" />
        <div className="pointer-events-none absolute -end-32 top-10 h-72 w-72 rounded-full border border-white/10" />
        <div className="relative border-b border-white/10 px-5 py-5">
          <Link to={navItems[0]?.href ?? "/"} className="block">
            <span className="inline-flex rounded-lg bg-white px-3 py-2.5 shadow-[0_14px_30px_rgba(0,0,0,0.22),inset_0_0_0_1px_rgba(190,184,174,0.45)]">
              <img src="/logos/asset-2.svg" alt="MWRD" className="h-9 w-auto max-w-[150px]" />
            </span>
          </Link>
          <p className="mt-3 text-xs leading-5 text-white/60">{tr("Procurement workspace")}</p>
          <span className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tracking-normal ${toneClasses[portalTone]}`}>
            {tr(portalLabel)}
          </span>
        </div>

        <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-white text-[#1a1a1a] shadow-[0_12px_26px_rgba(0,0,0,0.22)]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span
                  className={`absolute start-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-e-full transition-opacity ${
                    isActive ? "bg-[#ff6d43] opacity-100" : "bg-white/30 opacity-0 group-hover:opacity-100"
                  }`}
                />
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
                    isActive ? "bg-[#fff1eb] text-[#ff6d43]" : "bg-white/[0.06] text-white/70 group-hover:text-white"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="truncate">{tr(item.label)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="relative border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-white/[0.07] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff6d43] text-sm font-semibold text-white">
              {(profile?.company_name || profile?.public_id || "M").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{profile?.company_name || tr("MWRD account")}</p>
              <p className="truncate text-xs text-white/50">{profile?.public_id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut01 className="h-5 w-5" />
            {tr("Sign out")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[#ded8d0] bg-white/92 backdrop-blur-xl">
          <div className="flex h-[4.35rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
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
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#f7f8f7] px-3 text-sm font-semibold text-[#5f625f] shadow-[inset_0_0_0_1px_rgba(190,184,174,0.48)] transition-colors hover:bg-[#eef7f8] hover:text-[#1a1a1a]"
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
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
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
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;

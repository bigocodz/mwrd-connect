import type { ComponentType, ReactNode, SVGProps } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export type AppIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number; color?: string }>;

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export const PageHeader = ({ title, description, actions }: PageHeaderProps) => (
  <div className="mb-8 flex flex-col gap-4 border-b border-[#ded8d0] pb-6 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <div className="mb-3 h-1 w-11 rounded-full bg-[#ff6d43]" />
      <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-normal text-[#1a1a1a] sm:text-[2.35rem]">{title}</h1>
      {description && <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[#5f625f]">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);

type PanelProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  icon?: AppIcon;
  className?: string;
  actions?: ReactNode;
};

export const Panel = ({ children, title, description, icon: Icon, className, actions }: PanelProps) => (
  <section className={cn("rounded-lg bg-white shadow-[0_18px_44px_rgba(26,26,26,0.045),0_0_0_1px_rgba(190,184,174,0.34)]", className)}>
    {(title || description || actions) && (
      <div className="flex flex-col gap-3 border-b border-[#ece7e1] px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#c6e4ee] text-[#1a1a1a] shadow-[0_0_0_1px_rgba(117,218,234,0.45)]">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            {title && <h2 className="font-display text-[1.15rem] font-semibold leading-tight text-[#1a1a1a]">{title}</h2>}
            {description && <p className="mt-1 text-[15px] leading-relaxed text-[#5f625f]">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </section>
);

type MetricCardProps = {
  label: string;
  value: ReactNode;
  icon: AppIcon;
  helper?: ReactNode;
  loading?: boolean;
  tone?: "default" | "success" | "warning" | "danger";
};

const metricTone = {
  default: "bg-[#c6e4ee] text-[#1a1a1a] shadow-[0_0_0_1px_rgba(117,218,234,0.45)]",
  success: "bg-[#e7f8f2] text-[#246b55] shadow-[0_0_0_1px_rgba(36,107,85,0.14)]",
  warning: "bg-[#fff7d6] text-[#8c5f00] shadow-[0_0_0_1px_rgba(248,200,67,0.34)]",
  danger: "bg-[#ffe9ec] text-[#b91f2e] shadow-[0_0_0_1px_rgba(235,79,93,0.22)]",
};

export const MetricCard = ({ label, value, icon: Icon, helper, loading, tone = "default" }: MetricCardProps) => (
  <div className="rounded-lg bg-white p-6 shadow-[0_18px_44px_rgba(26,26,26,0.045),0_0_0_1px_rgba(190,184,174,0.34)]">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-normal text-[#6c6f6c]">{label}</p>
        {loading ? <SkeletonLine className="mt-3 h-8 w-28" /> : <div className="mt-2 font-display text-[2rem] font-semibold leading-tight text-[#1a1a1a]">{value}</div>}
      </div>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", metricTone[tone])}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
    {helper && !loading && <div className="mt-3 text-sm leading-relaxed text-[#5f625f]">{helper}</div>}
  </div>
);

type LinkCardProps = {
  title: string;
  description: string;
  href: string;
  icon: AppIcon;
  meta?: ReactNode;
};

export const LinkCard = ({ title, description, href, icon: Icon, meta }: LinkCardProps) => (
  <Link
    to={href}
    className="group flex h-full items-start gap-4 rounded-lg bg-white p-5 shadow-[0_0_0_1px_rgba(190,184,174,0.34)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(26,26,26,0.08),0_0_0_1px_rgba(255,109,67,0.36)]"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#c6e4ee] text-[#1a1a1a] shadow-[0_0_0_1px_rgba(117,218,234,0.45)] transition-colors group-hover:bg-[#ff6d43] group-hover:text-white">
      <Icon className="h-5 w-5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center justify-between gap-3">
        <span className="font-display text-[1.15rem] font-semibold leading-tight text-[#1a1a1a]">{title}</span>
        <DirectionalArrow />
      </span>
      <span className="mt-2 block text-[15px] leading-relaxed text-[#5f625f]">{description}</span>
      {meta && <span className="mt-3 block text-sm font-semibold text-[#1a1a1a]">{meta}</span>}
    </span>
  </Link>
);

const DirectionalArrow = () => {
  const { dir } = useLanguage();
  return (
    <ArrowRight
      className={cn(
        "h-4 w-4 shrink-0 text-[#8a8a85] transition-transform group-hover:text-[#ff6d43]",
        dir === "rtl" ? "rotate-180 group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5",
      )}
    />
  );
};

type SkeletonLineProps = {
  className?: string;
};

export const SkeletonLine = ({ className }: SkeletonLineProps) => (
  <div className={cn("animate-pulse rounded-lg bg-[#e9eef0]", className)} />
);

export const EmptyMessage = ({ children }: { children: ReactNode }) => (
  <p className="rounded-lg bg-[#f7f8f7] px-4 py-6 text-center text-sm leading-relaxed text-[#5f625f] shadow-[inset_0_0_0_1px_rgba(190,184,174,0.38)]">
    {children}
  </p>
);

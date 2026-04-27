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
  <div className="relative mb-5 sm:flex sm:items-start sm:justify-between sm:gap-6">
    <div className="min-w-0">
      <h1 className="font-display text-[1.65rem] font-semibold leading-tight tracking-normal text-[#1d2939] sm:text-[2rem]">{title}</h1>
      {description && <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[#667085]">{description}</p>}
    </div>
    {actions && <div className="relative mt-4 flex shrink-0 items-center gap-2 sm:mt-0">{actions}</div>}
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
  <section className={cn("overflow-hidden rounded-xl border-2 border-white bg-white/80", className)}>
    {(title || description || actions) && (
      <div className="relative flex flex-col gap-3 border-b border-[#eef0f3] px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {Icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff1eb] text-[#ff6d43]">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            {title && <h2 className="font-display text-[1.2rem] font-semibold leading-tight text-[#1d2939]">{title}</h2>}
            {description && <p className="mt-1 text-[15px] leading-relaxed text-[#667085]">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className="p-5 [&_table]:w-full [&_table]:text-sm [&_thead_tr]:border-b [&_thead_tr]:border-[#eef0f3] [&_tbody_tr]:border-b [&_tbody_tr]:border-[#eef0f3] [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-white/70 [&_td]:px-4 [&_td]:py-4 [&_th]:h-12 [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-[#667085]">{children}</div>
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
  default: "bg-[#eaf8fb] text-[#1a1a1a]",
  success: "bg-[#e7f8f2] text-[#246b55]",
  warning: "bg-[#fff7d6] text-[#8c5f00]",
  danger: "bg-[#ffe9ec] text-[#b91f2e]",
};

export const MetricCard = ({ label, value, icon: Icon, helper, loading, tone = "default" }: MetricCardProps) => (
  <div className="group relative overflow-hidden rounded-xl border-2 border-white bg-white/80 p-5 transition-colors hover:bg-white">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium tracking-normal text-[#344054]">{label}</p>
        {loading ? <SkeletonLine className="mt-5 h-8 w-28" /> : <div className="mt-5 font-display text-[2.25rem] font-semibold leading-none text-[#1d2939]">{value}</div>}
      </div>
      <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", metricTone[tone])}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
    {helper && !loading && <div className="mt-3 text-sm leading-relaxed text-[#667085]">{helper}</div>}
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
    className="group relative flex h-full items-start gap-4 overflow-hidden rounded-xl border-2 border-white bg-white/70 p-5 transition-colors hover:bg-white"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff1eb] text-[#ff6d43] transition-colors group-hover:bg-[#ff6d43] group-hover:text-white">
      <Icon className="h-5 w-5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center justify-between gap-3">
        <span className="font-display text-[1.05rem] font-semibold leading-tight text-[#1d2939]">{title}</span>
        <DirectionalArrow />
      </span>
      <span className="mt-2 block text-[15px] leading-relaxed text-[#667085]">{description}</span>
      {meta && <span className="mt-3 block text-sm font-semibold text-[#1d2939]">{meta}</span>}
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
  <div className={cn("animate-pulse rounded-lg bg-[#e4e7ec]", className)} />
);

export const EmptyMessage = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl bg-white px-4 py-6 text-center text-sm leading-relaxed text-[#667085]">
    {children}
  </p>
);

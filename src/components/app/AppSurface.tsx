import type { ComponentType, ReactNode, SVGProps } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "@untitledui/icons";
import { cn } from "@/lib/utils";

export type AppIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number; color?: string }>;

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export const PageHeader = ({ title, description, actions }: PageHeaderProps) => (
  <div className="mb-8 flex flex-col gap-4 border-b border-[#e8e6dc] pb-6 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <h1 className="font-display text-[2rem] font-medium leading-tight tracking-normal text-[#141413] sm:text-[2.3rem]">{title}</h1>
      {description && <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[#5e5d59]">{description}</p>}
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
  <section className={cn("rounded-xl bg-[#faf9f5] shadow-[0_4px_24px_rgba(20,20,19,0.05),0_0_0_1px_#f0eee6]", className)}>
    {(title || description || actions) && (
      <div className="flex flex-col gap-3 border-b border-[#f0eee6] px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8e6dc] text-[#4d4c48] shadow-[0_0_0_1px_#d1cfc5]">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            {title && <h2 className="font-display text-[1.3rem] font-medium leading-tight text-[#141413]">{title}</h2>}
            {description && <p className="mt-1 text-[15px] leading-relaxed text-[#5e5d59]">{description}</p>}
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
  default: "bg-[#e8e6dc] text-[#4d4c48] shadow-[0_0_0_1px_#d1cfc5]",
  success: "bg-[#eef4e8] text-[#556b45] shadow-[0_0_0_1px_#d9e4cf]",
  warning: "bg-[#fff6e5] text-[#9d5f2b] shadow-[0_0_0_1px_#edd9b7]",
  danger: "bg-[#f7e9e1] text-[#b53333] shadow-[0_0_0_1px_#eed1c5]",
};

export const MetricCard = ({ label, value, icon: Icon, helper, loading, tone = "default" }: MetricCardProps) => (
  <div className="rounded-xl bg-[#faf9f5] p-6 shadow-[0_4px_24px_rgba(20,20,19,0.05),0_0_0_1px_#f0eee6]">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-[0.12px] text-[#87867f]">{label}</p>
        {loading ? <SkeletonLine className="mt-3 h-8 w-28" /> : <div className="mt-2 font-display text-[2rem] font-medium leading-tight text-[#141413]">{value}</div>}
      </div>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", metricTone[tone])}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
    {helper && !loading && <div className="mt-3 text-sm leading-relaxed text-[#5e5d59]">{helper}</div>}
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
    className="group flex h-full items-start gap-4 rounded-xl bg-[#faf9f5] p-5 shadow-[0_0_0_1px_#f0eee6] transition-colors hover:bg-[#fbf3ef] hover:shadow-[0_0_0_1px_#c96442]"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e8e6dc] text-[#4d4c48] shadow-[0_0_0_1px_#d1cfc5] transition-colors group-hover:bg-[#f7e9e1] group-hover:text-[#8d422d]">
      <Icon className="h-5 w-5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center justify-between gap-3">
        <span className="font-display text-[1.3rem] font-medium leading-tight text-[#141413]">{title}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-[#87867f] transition-transform group-hover:translate-x-0.5 group-hover:text-[#c96442]" />
      </span>
      <span className="mt-2 block text-[15px] leading-relaxed text-[#5e5d59]">{description}</span>
      {meta && <span className="mt-3 block text-sm font-medium text-[#141413]">{meta}</span>}
    </span>
  </Link>
);

type SkeletonLineProps = {
  className?: string;
};

export const SkeletonLine = ({ className }: SkeletonLineProps) => (
  <div className={cn("animate-pulse rounded-lg bg-[#e8e6dc]", className)} />
);

export const EmptyMessage = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl bg-[#f5f4ed] px-4 py-6 text-center text-sm leading-relaxed text-[#5e5d59] shadow-[inset_0_0_0_1px_#e8e6dc]">
    {children}
  </p>
);

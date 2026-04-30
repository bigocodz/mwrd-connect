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
  <div className="relative mb-6 border-b border-stroke-soft-200 pb-5 sm:flex sm:items-end sm:justify-between sm:gap-6">
    <div className="flex min-w-0 gap-3">
      <span className="mt-1 hidden h-12 w-1 shrink-0 rounded-full bg-primary-base shadow-[0_0_0_4px_var(--color-primary-alpha-10)] sm:block" />
      <div className="min-w-0">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-sub-600">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-base" />
          MWRD Connect
        </p>
        <h1 className="font-display text-[1.65rem] font-semibold leading-tight text-strong-950 sm:text-[2rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-sub-600">{description}</p>
        )}
      </div>
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
  <section
    className={cn(
      "overflow-hidden rounded-12 border border-stroke-soft-200 bg-bg-panel shadow-[var(--shadow-regular-xs)]",
      className,
    )}
  >
    {(title || description || actions) && (
      <div className="relative flex flex-col gap-3 border-b border-stroke-soft-200 bg-bg-white-0/58 px-5 py-4 shadow-[var(--shadow-regular-inset)] sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-10 bg-primary-light text-primary-dark ring-1 ring-primary-alpha-16">
              <Icon className="h-4.5 w-4.5" />
            </span>
          )}
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-base font-semibold leading-tight text-strong-950">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm leading-5 text-sub-600">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className="p-5 [&_table]:w-full [&_table]:text-sm [&_thead_tr]:border-b [&_thead_tr]:border-stroke-soft-200 [&_tbody_tr]:border-b [&_tbody_tr]:border-stroke-soft-200 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-bg-inset [&_td]:px-3 [&_td]:py-3 [&_th]:h-10 [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:text-soft-400">
      {children}
    </div>
  </section>
);

type Trend = {
  delta: ReactNode;
  direction: "up" | "down" | "neutral";
};

type MetricCardProps = {
  label: string;
  value: ReactNode;
  icon: AppIcon;
  helper?: ReactNode;
  loading?: boolean;
  tone?: "default" | "success" | "warning" | "danger";
  trend?: Trend;
};

const metricTone = {
  default: {
    icon: "bg-information-lighter text-information-base ring-information-light/60",
    rail: "bg-information-base",
  },
  success: {
    icon: "bg-success-lighter text-success-base ring-success-light/60",
    rail: "bg-success-base",
  },
  warning: {
    icon: "bg-warning-lighter text-warning-base ring-warning-light/60",
    rail: "bg-warning-base",
  },
  danger: {
    icon: "bg-error-lighter text-error-base ring-error-light/60",
    rail: "bg-error-base",
  },
};

const trendTone = {
  up: "bg-success-lighter text-success-base",
  down: "bg-error-lighter text-error-base",
  neutral: "bg-bg-weak-50 text-sub-600",
};

export const MetricCard = ({
  label,
  value,
  icon: Icon,
  helper,
  loading,
  tone = "default",
  trend,
}: MetricCardProps) => (
  <div className="group relative overflow-hidden rounded-12 border border-stroke-soft-200 bg-bg-panel p-5 shadow-[var(--shadow-regular-xs)] transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-regular-sm)]">
    <span className={cn("absolute inset-x-0 top-0 h-1", metricTone[tone].rail)} />
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-medium text-sub-600">{label}</p>
      <span
        className={cn(
          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-10 ring-1",
          metricTone[tone].icon,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
    </div>
    {loading ? (
      <SkeletonLine className="mt-4 h-8 w-28" />
    ) : (
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[1.875rem] font-semibold leading-none text-strong-950">
          {value}
        </span>
        {trend && (
          <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium", trendTone[trend.direction])}>
            {trend.delta}
          </span>
        )}
      </div>
    )}
    {helper && !loading && <div className="mt-1.5 text-xs leading-5 text-soft-400">{helper}</div>}
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
    className="group relative flex h-full items-start gap-4 rounded-12 border border-stroke-soft-200 bg-bg-panel p-5 shadow-[var(--shadow-regular-xs)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-stroke-sub-300 hover:shadow-[var(--shadow-regular-sm)]"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-10 bg-primary-light text-primary-dark ring-1 ring-primary-alpha-16 transition-colors group-hover:bg-primary-base group-hover:text-white-0 group-hover:ring-primary-base">
      <Icon className="h-4.5 w-4.5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center justify-between gap-3">
        <span className="font-display text-[15px] font-semibold leading-tight text-strong-950">
          {title}
        </span>
        <DirectionalArrow />
      </span>
      <span className="mt-1 block text-sm leading-5 text-sub-600">{description}</span>
      {meta && <span className="mt-2.5 block text-xs font-medium text-strong-950">{meta}</span>}
    </span>
  </Link>
);

type SurfaceTone = "brand" | "info" | "success" | "warning" | "danger" | "neutral";

const surfaceTone = {
  brand: {
    icon: "bg-primary-light text-primary-dark ring-primary-alpha-16",
    rail: "bg-primary-base",
    meta: "text-primary-dark",
  },
  info: {
    icon: "bg-information-lighter text-information-base ring-information-light/70",
    rail: "bg-information-base",
    meta: "text-information-base",
  },
  success: {
    icon: "bg-success-lighter text-success-base ring-success-light/70",
    rail: "bg-success-base",
    meta: "text-success-base",
  },
  warning: {
    icon: "bg-warning-lighter text-warning-base ring-warning-light/70",
    rail: "bg-warning-base",
    meta: "text-warning-base",
  },
  danger: {
    icon: "bg-error-lighter text-error-base ring-error-light/70",
    rail: "bg-error-base",
    meta: "text-error-base",
  },
  neutral: {
    icon: "bg-bg-inset text-sub-600 ring-stroke-soft-200",
    rail: "bg-stroke-sub-300",
    meta: "text-sub-600",
  },
};

type SignalCardProps = {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  icon?: AppIcon;
  loading?: boolean;
  tone?: SurfaceTone;
};

export const SignalCard = ({
  label,
  value,
  helper,
  icon: Icon,
  loading = false,
  tone = "brand",
}: SignalCardProps) => (
  <div className="relative overflow-hidden rounded-12 border border-stroke-soft-200 bg-bg-panel p-4 shadow-[var(--shadow-regular-xs)]">
    <span className={cn("absolute inset-x-0 top-0 h-1", surfaceTone[tone].rail)} />
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-soft-400">{label}</p>
        {loading ? (
          <SkeletonLine className="mt-2 h-7 w-24" />
        ) : (
          <p className="mt-2 text-xl font-semibold leading-tight text-strong-950">{value}</p>
        )}
      </div>
      {Icon && (
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-10 ring-1",
            surfaceTone[tone].icon,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
    </div>
    {helper && !loading && <div className="mt-2 text-sm leading-6 text-sub-600">{helper}</div>}
  </div>
);

type FlowStepCardProps = {
  label: ReactNode;
  value: ReactNode;
  icon: AppIcon;
  index: number;
  tone?: SurfaceTone;
};

export const FlowStepCard = ({
  label,
  value,
  icon: Icon,
  index,
  tone = "brand",
}: FlowStepCardProps) => (
  <div className="relative overflow-hidden rounded-12 border border-stroke-soft-200 bg-bg-panel p-4 shadow-[var(--shadow-regular-xs)] transition-shadow hover:shadow-[var(--shadow-regular-sm)]">
    <span className={cn("absolute inset-x-0 top-0 h-1", surfaceTone[tone].rail)} />
    <div className="mb-3 flex items-center justify-between gap-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-10 ring-1",
          surfaceTone[tone].icon,
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className={cn("text-[11px] font-semibold", surfaceTone[tone].meta)}>
        {String(index + 1).padStart(2, "0")}
      </span>
    </div>
    <p className="text-sm font-semibold text-strong-950">{label}</p>
    <p className="mt-0.5 text-xs leading-5 text-sub-600">{value}</p>
  </div>
);

const DirectionalArrow = () => {
  const { dir } = useLanguage();
  return (
    <ArrowRight
      className={cn(
        "h-4 w-4 shrink-0 text-soft-400 transition-transform group-hover:text-primary-base",
        dir === "rtl" ? "rotate-180 group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5",
      )}
    />
  );
};

type SkeletonLineProps = {
  className?: string;
};

export const SkeletonLine = ({ className }: SkeletonLineProps) => (
  <div className={cn("animate-pulse rounded-8 bg-bg-soft-200", className)} />
);

export const EmptyMessage = ({ children }: { children: ReactNode }) => (
  <p className="rounded-12 border border-dashed border-stroke-soft-200 bg-bg-weak-50 px-4 py-6 text-center text-sm leading-5 text-sub-600">
    {children}
  </p>
);

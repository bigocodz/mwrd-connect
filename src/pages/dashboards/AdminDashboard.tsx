import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  BankNote01,
  BarChartSquareUp,
  ClockCheck,
  CreditCard01,
  FileQuestion02,
  PackageCheck,
  PackageSearch,
  Percent03,
  Inbox01,
  Receipt,
  ShieldTick,
  Star01,
  Users01,
} from "@untitledui/icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { api } from "@cvx/api";
import { EmptyMessage, MetricCard, PageHeader, Panel, SkeletonLine, type AppIcon } from "@/components/app/AppSurface";
import { useLanguage } from "@/contexts/LanguageContext";

const AdminDashboard = () => {
  const { tr, lang, dir } = useLanguage();
  const stats = useQuery(api.dashboard.adminStats);
  const loading = stats === undefined;
  const pendingTotal = stats ? stats.pendingProducts + stats.pendingQuotes + stats.pendingPayouts : 0;
  const topSupplier = stats?.topSuppliers[0];
  const creditWatchCount = stats?.creditAlerts.length ?? 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);

  return (
    <AdminLayout>
      <PageHeader
        title={tr("Admin Dashboard")}
        description={tr("Monitor revenue, margin, supplier quality, credit utilization, and the operational queues that need attention.")}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CreditCard01} label={tr("GMV This Month")} value={stats ? fmt(stats.monthlyRevenue) : ""} loading={loading} />
        <MetricCard
          icon={BarChartSquareUp}
          label={tr("Margin Collected")}
          value={stats ? fmt(stats.monthlyRevenue - stats.monthlyPayouts) : ""}
          loading={loading}
          tone="success"
        />
        <MetricCard icon={Users01} label={tr("Active Clients")} value={stats ? String(stats.activeClients) : ""} loading={loading} />
        <MetricCard icon={Users01} label={tr("Active Suppliers")} value={stats ? String(stats.activeSuppliers) : ""} loading={loading} />
      </div>

      <Panel
        className="mt-6"
        title={tr("Control Room")}
        description={tr("Fast operational signals before you open a queue.")}
        icon={ShieldTick}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <AdminPulseCard
            label={tr("Open queue")}
            value={String(pendingTotal)}
            helper={tr("Products, quotes, and payouts waiting for admin action.")}
            icon={ClockCheck}
            loading={loading}
            tone="carrot"
          />
          <AdminPulseCard
            label={tr("Credit watch")}
            value={String(creditWatchCount)}
            helper={tr("Clients above the utilization threshold.")}
            icon={Percent03}
            loading={loading}
            tone="cyan"
          />
          <AdminPulseCard
            label={tr("Supplier quality")}
            value={topSupplier ? `${topSupplier.avg_rating.toFixed(1)} / 5` : tr("No reviews")}
            helper={topSupplier ? topSupplier.company_name : tr("Ratings will appear as reviews arrive.")}
            icon={Star01}
            loading={loading}
            tone="sun"
          />
        </div>
      </Panel>

      <Panel className="mt-6" title={tr("Managed Marketplace Loop")} description={tr("The PRD transaction backbone from lead capture to Wafeq-cleared invoice.")}>
        <div className="grid gap-3 md:grid-cols-6">
          {[
            { label: tr("Lead"), value: tr("Qualify account"), icon: Inbox01 },
            { label: tr("Catalog"), value: tr("Approve supply"), icon: PackageSearch },
            { label: tr("RFQ"), value: tr("Route demand"), icon: FileQuestion02 },
            { label: tr("Margin"), value: tr("Assemble offer"), icon: Percent03 },
            { label: tr("PO"), value: tr("Dispatch order"), icon: PackageCheck },
            { label: tr("Invoice"), value: tr("Clear in Wafeq"), icon: Receipt },
          ].map((step, index) => (
            <div key={step.label} className="rounded-xl border-2 border-white bg-white/70 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fff1eb] text-[#ff6d43]">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-[#98a2b3]">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <p className="text-sm font-semibold text-[#1d2939]">{step.label}</p>
              <p className="mt-1 text-xs leading-5 text-[#667085]">{step.value}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title={tr("Top 5 Suppliers by Rating")} icon={Star01}>
          {loading ? (
            <TableSkeleton />
          ) : stats && !stats.topSuppliers.length ? (
            <EmptyMessage>{tr("No reviews yet.")}</EmptyMessage>
          ) : (
            stats && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-sm">
                  <thead>
                    <tr className="border-b border-border-primary text-start text-xs font-semibold uppercase text-text-tertiary">
                      <th className="pb-3">{tr("Supplier")}</th>
                      <th className="pb-3 text-end">{tr("Avg Rating")}</th>
                      <th className="pb-3 text-end">{tr("Reviews")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-primary">
                    {stats.topSuppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td className="py-3 font-medium text-text-primary">{supplier.company_name}</td>
                        <td className="py-3 text-end text-text-primary">{supplier.avg_rating.toFixed(1)}</td>
                        <td className="py-3 text-end text-text-secondary">{supplier.review_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Panel>

        <Panel title={tr("Highest Credit Utilization")} icon={Percent03}>
          {loading ? (
            <TableSkeleton />
          ) : stats && !stats.creditAlerts.length ? (
            <EmptyMessage>{tr("No clients above 80% utilization.")}</EmptyMessage>
          ) : (
            stats && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border-primary text-start text-xs font-semibold uppercase text-text-tertiary">
                      <th className="pb-3">{tr("Client")}</th>
                      <th className="pb-3 text-end">{tr("Limit")}</th>
                      <th className="pb-3 text-end">{tr("Balance")}</th>
                      <th className="pb-3 text-end">{tr("Utilization")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-primary">
                    {stats.creditAlerts.map((client) => (
                      <tr key={client.id}>
                        <td className="py-3 font-medium text-text-primary">{client.company_name}</td>
                        <td className="py-3 text-end text-text-secondary">{fmt(client.credit_limit)}</td>
                        <td className="py-3 text-end text-text-secondary">{fmt(client.current_balance)}</td>
                        <td className="py-3 text-end">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              client.utilization > 90
                                ? "bg-red-50 text-text-error-primary"
                                : "bg-bg-warning-primary text-text-warning-primary"
                            }`}
                          >
                            {client.utilization.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title={tr("Pending Actions")}
        icon={ClockCheck}
        description={tr("The queues that usually block client or supplier progress.")}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <PendingAction
            label={tr("Product Approvals")}
            count={stats?.pendingProducts ?? 0}
            href="/admin/products/pending"
            loading={loading}
            icon={PackageSearch}
            dir={dir}
          />
          <PendingAction
            label={tr("Quote Reviews")}
            count={stats?.pendingQuotes ?? 0}
            href="/admin/quotes/pending"
            loading={loading}
            icon={Receipt}
            dir={dir}
          />
          <PendingAction
            label={tr("Pending Payouts")}
            count={stats?.pendingPayouts ?? 0}
            href="/admin/payouts"
            loading={loading}
            icon={BankNote01}
            dir={dir}
          />
        </div>
      </Panel>
    </AdminLayout>
  );
};

const TableSkeleton = () => (
  <div className="space-y-3">
    <SkeletonLine className="h-5 w-full" />
    <SkeletonLine className="h-5 w-11/12" />
    <SkeletonLine className="h-5 w-10/12" />
    <SkeletonLine className="h-5 w-9/12" />
  </div>
);

const pulseTone = {
  carrot: "bg-[#fff1eb] text-[#ba4424]",
  cyan: "bg-[#eaf8fb] text-[#1a1a1a]",
  sun: "bg-[#fff7d6] text-[#8c5f00]",
};

const AdminPulseCard = ({
  label,
  value,
  helper,
  icon: Icon,
  loading,
  tone,
}: {
  label: string;
  value: ReactNode;
  helper: ReactNode;
  icon: AppIcon;
  loading: boolean;
  tone: keyof typeof pulseTone;
}) => (
  <div className="relative overflow-hidden rounded-xl border-2 border-white bg-white/70 p-4">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#667085]">{label}</p>
        {loading ? <SkeletonLine className="mt-2 h-7 w-24" /> : <p className="mt-2 text-2xl font-semibold leading-tight text-[#1d2939]">{value}</p>}
      </div>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${pulseTone[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
    {!loading && <p className="mt-2 text-sm leading-relaxed text-[#667085]">{helper}</p>}
  </div>
);

const PendingAction = ({
  label,
  count,
  href,
  loading,
  icon: Icon,
  dir,
}: {
  label: string;
  count: number;
  href: string;
  loading: boolean;
  icon: AppIcon;
  dir: "ltr" | "rtl";
}) => (
  <Link
    to={href}
    className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-xl border-2 border-white bg-white/70 p-4 transition-colors hover:bg-white"
  >
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff1eb] text-[#ff6d43] transition-colors group-hover:bg-[#ff6d43] group-hover:text-white">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#667085]">{label}</p>
        {loading ? <SkeletonLine className="mt-1 h-6 w-8" /> : <p className="text-xl font-semibold text-[#1d2939]">{count}</p>}
      </div>
    </div>
    <ArrowRight className={`h-4 w-4 shrink-0 text-[#8a8a85] transition-colors group-hover:text-[#ff6d43] ${dir === "rtl" ? "rotate-180" : ""}`} />
  </Link>
);

export default AdminDashboard;

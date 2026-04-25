import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  BankNote01,
  BarChartSquareUp,
  ClockCheck,
  CreditCard01,
  PackageSearch,
  Percent03,
  Receipt,
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
          />
          <PendingAction
            label={tr("Quote Reviews")}
            count={stats?.pendingQuotes ?? 0}
            href="/admin/quotes/pending"
            loading={loading}
            icon={Receipt}
          />
          <PendingAction
            label={tr("Pending Payouts")}
            count={stats?.pendingPayouts ?? 0}
            href="/admin/payouts"
            loading={loading}
            icon={BankNote01}
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

const PendingAction = ({
  label,
  count,
  href,
  loading,
  icon: Icon,
}: {
  label: string;
  count: number;
  href: string;
  loading: boolean;
  icon: AppIcon;
}) => (
  <Link
    to={href}
    className="group flex items-center justify-between gap-4 rounded-lg border border-border-primary bg-bg-primary p-4 shadow-xs transition-colors hover:border-border-brand hover:bg-brand-25"
  >
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-secondary text-text-secondary group-hover:bg-brand-50 group-hover:text-brand-700">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text-secondary">{label}</p>
        {loading ? <SkeletonLine className="mt-1 h-6 w-8" /> : <p className="text-xl font-semibold text-text-primary">{count}</p>}
      </div>
    </div>
    <ArrowRight className={`h-4 w-4 shrink-0 text-text-tertiary group-hover:text-brand-700 ${dir === "rtl" ? "rotate-180" : ""}`} />
  </Link>
);

export default AdminDashboard;

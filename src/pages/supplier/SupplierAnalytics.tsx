import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import {
  AlertCircle,
  BankNote01,
  BarChartSquareUp,
  ClockCheck,
  PackageCheck,
  Receipt,
  Star01,
  Truck01,
} from "@untitledui/icons";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { EmptyMessage, MetricCard, PageHeader, Panel, SkeletonLine } from "@/components/app/AppSurface";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatSAR } from "@/components/shared/VatBadge";

const WINDOWS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
  { label: "Last 365 days", value: 365 },
];

const fmtHours = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n < 24) return `${n.toFixed(1)} h`;
  return `${(n / 24).toFixed(1)} d`;
};

const fmtPct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(1)}%`);

const fmtRating = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(2)} / 5`);

const SupplierAnalytics = () => {
  const [windowDays, setWindowDays] = useState(90);
  const data = useQuery(api.dashboard.supplierAnalytics, { windowDays });
  const loading = data === undefined;

  return (
    <SupplierLayout>
      <PageHeader
        title="My Performance"
        description="Track how your responsiveness, win rate, and delivery SLA shape MWRD's view of your business."
        actions={
          <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={ClockCheck}
          label="Avg response time"
          value={fmtHours(data?.avgResponseHours)}
          loading={loading}
          helper={data ? `${data.assignedCount} assigned` : undefined}
        />
        <MetricCard
          icon={Receipt}
          label="Response rate"
          value={fmtPct(data?.responseRate)}
          loading={loading}
          tone={data && data.responseRate != null && data.responseRate < 60 ? "warning" : "success"}
        />
        <MetricCard
          icon={BarChartSquareUp}
          label="Win rate"
          value={fmtPct(data?.winRate)}
          loading={loading}
          tone="success"
          helper={data ? `${data.wins} wins of ${data.quotedCount} quotes` : undefined}
        />
        <MetricCard
          icon={Star01}
          label="Average rating"
          value={fmtRating(data?.avgRating)}
          loading={loading}
          helper={data ? `${data.ratingsCount} reviews` : undefined}
        />
        <MetricCard
          icon={PackageCheck}
          label="Completed orders"
          value={data ? String(data.completedOrders) : ""}
          loading={loading}
          helper={data ? `${data.inFlightOrders} in flight` : undefined}
        />
        <MetricCard
          icon={BankNote01}
          label="Completed value"
          value={data ? formatSAR(data.totalCompletedValue) : ""}
          loading={loading}
        />
        <MetricCard
          icon={Truck01}
          label="On-time delivery"
          value={fmtPct(data?.onTimeRate)}
          loading={loading}
          tone={data && data.onTimeRate != null && data.onTimeRate < 80 ? "warning" : "success"}
          helper={data && data.deliveredWithEta ? `${data.lateDeliveries} late of ${data.deliveredWithEta}` : undefined}
        />
        <MetricCard
          icon={AlertCircle}
          label="Dispute rate"
          value={fmtPct(data?.disputeRate)}
          loading={loading}
          tone={data && data.disputeRate != null && data.disputeRate > 5 ? "danger" : "default"}
          helper={data ? `${data.disputedCount} disputed` : undefined}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Payout aging" icon={BankNote01} description="Outstanding payouts by age bucket.">
          {loading ? (
            <SkeletonLine className="h-24 w-full" />
          ) : data && data.payoutPending.count === 0 ? (
            <EmptyMessage>No outstanding payouts.</EmptyMessage>
          ) : (
            data && (
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-[#87867f]">Pending total</p>
                    <p className="font-display text-[1.6rem] font-medium text-[#141413]">
                      {formatSAR(data.payoutPending.total)}
                    </p>
                  </div>
                  <p className="text-sm text-[#5e5d59]">{data.payoutPending.count} pending · {formatSAR(data.paidLast30)} paid (30d)</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(["0-7", "8-14", "15-30", "30+"] as const).map((bucket) => (
                    <div key={bucket} className="rounded-lg bg-[#f5f4ed] p-3 shadow-[inset_0_0_0_1px_#e8e6dc]">
                      <p className="text-xs text-[#87867f]">{bucket} days</p>
                      <p className="mt-1 text-sm font-medium text-[#141413]">
                        {formatSAR(data.payoutPending.buckets[bucket])}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </Panel>

        <Panel title="Invoice status" icon={Receipt} description="Submitted invoices and their current state.">
          {loading ? (
            <SkeletonLine className="h-24 w-full" />
          ) : (
            data && (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-[#87867f]">Submitted</dt>
                  <dd className="mt-1 text-lg font-medium text-[#141413]">{data.invoiceCounts.submitted}</dd>
                </div>
                <div>
                  <dt className="text-[#87867f]">Approved</dt>
                  <dd className="mt-1 text-lg font-medium text-[#141413]">{data.invoiceCounts.approved}</dd>
                </div>
                <div>
                  <dt className="text-[#87867f]">Paid</dt>
                  <dd className="mt-1 text-lg font-medium text-[#141413]">{data.invoiceCounts.paid}</dd>
                </div>
                <div>
                  <dt className="text-[#87867f]">Rejected</dt>
                  <dd className="mt-1 text-lg font-medium text-[#141413]">{data.invoiceCounts.rejected}</dd>
                </div>
              </dl>
            )
          )}
        </Panel>
      </div>
    </SupplierLayout>
  );
};

export default SupplierAnalytics;

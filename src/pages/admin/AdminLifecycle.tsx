import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import {
  AlertCircle,
  BarChartSquareUp,
  ClockCheck,
  Download01,
  PackageCheck,
  Receipt,
  Star01,
  Truck01,
  Users01,
} from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import AdminLayout from "@/components/admin/AdminLayout";
import { EmptyMessage, MetricCard, PageHeader, Panel, SkeletonLine } from "@/components/app/AppSurface";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const TableSkeleton = () => (
  <div className="space-y-2">
    <SkeletonLine className="h-6 w-full" />
    <SkeletonLine className="h-6 w-full" />
    <SkeletonLine className="h-6 w-full" />
  </div>
);

const AdminLifecycle = () => {
  const [windowDays, setWindowDays] = useState(90);
  const data = useQuery(api.dashboard.lifecycleMetrics, { windowDays });
  const loading = data === undefined;

  const funnelStages = data
    ? [
        { label: "RFQs", value: data.funnel.rfqs },
        { label: "With quotes", value: data.funnel.quoted },
        { label: "Accepted", value: data.funnel.accepted },
        { label: "Orders", value: data.funnel.orders },
        { label: "Delivered", value: data.funnel.delivered },
        { label: "Completed", value: data.funnel.completed },
      ]
    : [];
  const funnelPeak = funnelStages.reduce((max, s) => Math.max(max, s.value), 0);

  return (
    <AdminLayout>
      <PageHeader
        title="Lifecycle & SLA"
        description="Cycle times, supplier responsiveness, delivery SLA, and dispute health for the active procurement window."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={!data}
              onClick={() => {
                if (!data) return;
                const summaryHeader = ["metric", "value"];
                const summary: string[][] = [
                  ["window_days", String(data.windowDays)],
                  ["funnel_rfqs", String(data.funnel.rfqs)],
                  ["funnel_quoted", String(data.funnel.quoted)],
                  ["funnel_accepted", String(data.funnel.accepted)],
                  ["funnel_orders", String(data.funnel.orders)],
                  ["funnel_delivered", String(data.funnel.delivered)],
                  ["funnel_completed", String(data.funnel.completed)],
                  ["quote_coverage_pct", data.quoteCoverage != null ? data.quoteCoverage.toFixed(2) : ""],
                  ["supplier_response_rate_pct", data.supplierResponseRate != null ? data.supplierResponseRate.toFixed(2) : ""],
                  ["avg_supplier_response_hours", data.avgSupplierResponseHours != null ? data.avgSupplierResponseHours.toFixed(2) : ""],
                  ["median_rfq_cycle_hours", data.medianRfqCycleHours != null ? data.medianRfqCycleHours.toFixed(2) : ""],
                  ["median_admin_turnaround_hours", data.medianAdminTurnaroundHours != null ? data.medianAdminTurnaroundHours.toFixed(2) : ""],
                  ["median_delivery_hours", data.medianDeliveryHours != null ? data.medianDeliveryHours.toFixed(2) : ""],
                  ["on_time_rate_pct", data.onTimeRate != null ? data.onTimeRate.toFixed(2) : ""],
                  ["late_deliveries", String(data.lateDeliveries)],
                  ["dispute_rate_pct", data.disputeRate != null ? data.disputeRate.toFixed(2) : ""],
                  ["open_disputes", String(data.openDisputes)],
                  ["cancellation_rate_pct", data.cancellationRate != null ? data.cancellationRate.toFixed(2) : ""],
                  ["revision_rate_pct", data.revisionRate != null ? data.revisionRate.toFixed(2) : ""],
                ];
                const leaderboardHeader = [
                  "supplier",
                  "company_name",
                  "assigned",
                  "quoted",
                  "wins",
                  "response_rate_pct",
                  "win_rate_pct",
                  "avg_response_hours",
                ];
                const leaderboard = data.supplierLeaderboard.map((s) => [
                  s.public_id,
                  s.company_name,
                  String(s.assigned),
                  String(s.quoted),
                  String(s.wins),
                  s.response_rate.toFixed(2),
                  s.win_rate.toFixed(2),
                  s.avg_response_hours != null ? s.avg_response_hours.toFixed(2) : "",
                ]);
                const rows: string[][] = [
                  summaryHeader,
                  ...summary,
                  [],
                  leaderboardHeader,
                  ...leaderboard,
                ];
                downloadCsv(`mwrd-lifecycle-${windowDays}d-${new Date().toISOString().slice(0, 10)}.csv`, rows);
              }}
            >
              <Download01 className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v))}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WINDOWS.map((w) => (
                  <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={ClockCheck}
          label="Median RFQ cycle (create → accept)"
          value={fmtHours(data?.medianRfqCycleHours)}
          loading={loading}
        />
        <MetricCard
          icon={Receipt}
          label="Median admin quote turnaround"
          value={fmtHours(data?.medianAdminTurnaroundHours)}
          loading={loading}
        />
        <MetricCard
          icon={Users01}
          label="Avg supplier response time"
          value={fmtHours(data?.avgSupplierResponseHours)}
          loading={loading}
        />
        <MetricCard
          icon={BarChartSquareUp}
          label="Quote coverage"
          value={fmtPct(data?.quoteCoverage)}
          loading={loading}
          tone="success"
        />
        <MetricCard
          icon={Truck01}
          label="Median delivery (dispatch → deliver)"
          value={fmtHours(data?.medianDeliveryHours)}
          loading={loading}
        />
        <MetricCard
          icon={PackageCheck}
          label="On-time delivery"
          value={fmtPct(data?.onTimeRate)}
          loading={loading}
          tone={data && data.onTimeRate != null && data.onTimeRate < 80 ? "warning" : "success"}
          helper={
            data && data.deliveredWithRequiredBy
              ? `${data.lateDeliveries} late of ${data.deliveredWithRequiredBy} with ETA`
              : undefined
          }
        />
        <MetricCard
          icon={AlertCircle}
          label="Dispute rate"
          value={fmtPct(data?.disputeRate)}
          loading={loading}
          tone={data && data.disputeRate != null && data.disputeRate > 5 ? "danger" : "default"}
          helper={data ? `${data.openDisputes} open` : undefined}
        />
        <MetricCard
          icon={AlertCircle}
          label="Cancellation rate"
          value={fmtPct(data?.cancellationRate)}
          loading={loading}
          tone={data && data.cancellationRate != null && data.cancellationRate > 10 ? "warning" : "default"}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Procurement funnel" icon={BarChartSquareUp} description="Counts within the selected window.">
          {loading ? (
            <TableSkeleton />
          ) : data && data.funnel.rfqs === 0 ? (
            <EmptyMessage>No RFQs in this window.</EmptyMessage>
          ) : (
            <div className="space-y-3">
              {funnelStages.map((stage) => {
                const pct = funnelPeak ? (stage.value / funnelPeak) * 100 : 0;
                return (
                  <div key={stage.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#5e5d59]">{stage.label}</span>
                      <span className="font-medium text-[#141413]">{stage.value}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f0eee6]">
                      <div className="h-full rounded-full bg-[#c96442]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Quality & friction" icon={AlertCircle} description="Lower is better.">
          {loading ? (
            <TableSkeleton />
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[#87867f]">Supplier response rate</dt>
                <dd className="mt-1 text-lg font-medium text-[#141413]">{fmtPct(data?.supplierResponseRate)}</dd>
              </div>
              <div>
                <dt className="text-[#87867f]">Quote revision rate</dt>
                <dd className="mt-1 text-lg font-medium text-[#141413]">{fmtPct(data?.revisionRate)}</dd>
              </div>
              <div>
                <dt className="text-[#87867f]">Open disputes</dt>
                <dd className="mt-1 text-lg font-medium text-[#141413]">{data?.openDisputes ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[#87867f]">Late deliveries</dt>
                <dd className="mt-1 text-lg font-medium text-[#141413]">{data?.lateDeliveries ?? "—"}</dd>
              </div>
            </dl>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Supplier responsiveness" icon={Users01} description="Top suppliers ranked by win rate within the window.">
          {loading ? (
            <TableSkeleton />
          ) : data && !data.supplierLeaderboard.length ? (
            <EmptyMessage>No supplier activity in this window.</EmptyMessage>
          ) : (
            data && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-[#e8e6dc] text-left text-xs font-semibold uppercase text-[#87867f]">
                      <th className="pb-3">Supplier</th>
                      <th className="pb-3 text-right">Assigned</th>
                      <th className="pb-3 text-right">Quoted</th>
                      <th className="pb-3 text-right">Response rate</th>
                      <th className="pb-3 text-right">Wins</th>
                      <th className="pb-3 text-right">Win rate</th>
                      <th className="pb-3 text-right">Avg response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.supplierLeaderboard.map((s) => (
                      <tr key={s.id} className="border-b border-[#f0eee6] last:border-0">
                        <td className="py-3">
                          <div className="flex items-center gap-1.5 font-medium text-[#141413]">
                            {s.public_id}
                            {s.is_preferred && <Star01 className="w-3.5 h-3.5 text-amber-500" aria-label="Preferred" />}
                          </div>
                          {s.company_name && (
                            <div className="text-xs text-[#87867f]">{s.company_name}</div>
                          )}
                        </td>
                        <td className="py-3 text-right">{s.assigned}</td>
                        <td className="py-3 text-right">{s.quoted}</td>
                        <td className="py-3 text-right">{fmtPct(s.response_rate)}</td>
                        <td className="py-3 text-right">{s.wins}</td>
                        <td className="py-3 text-right">{fmtPct(s.win_rate)}</td>
                        <td className="py-3 text-right">{fmtHours(s.avg_response_hours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
};

export default AdminLifecycle;

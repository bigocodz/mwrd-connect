import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import ClientLayout from "@/components/client/ClientLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyMessage,
  MetricCard,
  PageHeader,
  Panel,
  SkeletonLine,
} from "@/components/app/AppSurface";
import {
  BarChartSquareUp,
  ClockCheck,
  Coins03,
  CreditCardCheck,
  PackageCheck,
  PieChart02,
  Receipt,
  Truck01,
} from "@untitledui/icons";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatSAR } from "@/components/shared/VatBadge";

const fmtPct = (n: number | null | undefined, digits = 1) =>
  n == null ? "—" : `${n.toFixed(digits)}%`;
const fmtHours = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n < 24) return `${n.toFixed(1)} h`;
  return `${(n / 24).toFixed(1)} d`;
};

const TableSkeleton = () => (
  <div className="space-y-2">
    <SkeletonLine className="h-6 w-full" />
    <SkeletonLine className="h-6 w-full" />
    <SkeletonLine className="h-6 w-full" />
  </div>
);

const ClientReports = () => {
  const { tr } = useLanguage();
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const range = useMemo(() => {
    const f = from ? new Date(from + "T00:00:00").getTime() : undefined;
    const t = to ? new Date(to + "T23:59:59").getTime() : undefined;
    return { from: f, to: t };
  }, [from, to]);

  const spend = useQuery(api.reports.clientSpend, range);
  const funnel = useQuery(api.reports.clientRfqFunnel, range);
  const loadingSpend = spend === undefined;
  const loadingFunnel = funnel === undefined;

  return (
    <ClientLayout>
      <PageHeader
        title={tr("Reports")}
        description={tr("Spend trends and procurement funnel for your account.")}
        actions={
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs">{tr("From")}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs">{tr("To")}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Receipt}
          label={tr("Invoices issued")}
          value={spend ? String(spend.totals.invoiceCount) : "—"}
          loading={loadingSpend}
        />
        <MetricCard
          icon={Coins03}
          label={tr("Total invoiced")}
          value={spend ? formatSAR(spend.totals.issued) : "—"}
          loading={loadingSpend}
        />
        <MetricCard
          icon={CreditCardCheck}
          label={tr("Paid")}
          value={spend ? formatSAR(spend.totals.paid) : "—"}
          loading={loadingSpend}
          tone="success"
        />
        <MetricCard
          icon={CreditCardCheck}
          label={tr("Outstanding")}
          value={spend ? formatSAR(spend.totals.outstanding) : "—"}
          loading={loadingSpend}
          tone={spend && spend.totals.outstanding > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title={tr("Spend by category")} icon={PieChart02} description={tr("Invoiced totals grouped by RFQ category.")}>
          {loadingSpend ? (
            <TableSkeleton />
          ) : !spend || spend.byCategory.length === 0 ? (
            <EmptyMessage>{tr("No invoiced spend in this window.")}</EmptyMessage>
          ) : (
            <BarTable
              rows={spend.byCategory.map((c) => ({
                label: c.category,
                value: c.invoiced,
                count: c.count,
              }))}
            />
          )}
        </Panel>

        <Panel title={tr("Spend by branch")} icon={BarChartSquareUp} description={tr("Invoiced totals grouped by originating branch.")}>
          {loadingSpend ? (
            <TableSkeleton />
          ) : !spend || spend.byBranch.length === 0 ? (
            <EmptyMessage>{tr("No invoiced spend in this window.")}</EmptyMessage>
          ) : (
            <BarTable
              rows={spend.byBranch.map((b) => ({
                label: b.branch,
                value: b.invoiced,
                count: b.count,
              }))}
            />
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title={tr("Spend over time")} icon={BarChartSquareUp} description={tr("Month-by-month issued vs paid.")}>
          {loadingSpend ? (
            <TableSkeleton />
          ) : !spend || spend.byMonth.length === 0 ? (
            <EmptyMessage>{tr("No invoiced spend in this window.")}</EmptyMessage>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Month")}</TableHead>
                  <TableHead className="text-end">{tr("Invoiced")}</TableHead>
                  <TableHead className="text-end">{tr("Paid")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spend.byMonth.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>{m.month}</TableCell>
                    <TableCell className="text-end font-medium">{formatSAR(m.invoiced)}</TableCell>
                    <TableCell className="text-end">{formatSAR(m.paid)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={BarChartSquareUp}
          label={tr("RFQs created")}
          value={funnel ? String(funnel.funnel.rfqs) : "—"}
          loading={loadingFunnel}
        />
        <MetricCard
          icon={ClockCheck}
          label={tr("Median cycle (RFQ → delivered)")}
          value={fmtHours(funnel?.cycleTime.medianHours)}
          loading={loadingFunnel}
        />
        <MetricCard
          icon={PackageCheck}
          label={tr("Award rate")}
          value={fmtPct(funnel?.conversion.awardRate)}
          loading={loadingFunnel}
        />
        <MetricCard
          icon={Truck01}
          label={tr("On-time delivery")}
          value={fmtPct(funnel?.onTimeRate)}
          loading={loadingFunnel}
          tone={funnel && funnel.onTimeRate != null && funnel.onTimeRate < 80 ? "warning" : "success"}
        />
      </div>

      <div className="mt-6">
        <Panel title={tr("Procurement funnel")} icon={BarChartSquareUp} description={tr("Stage-by-stage conversion.")}>
          {loadingFunnel ? (
            <TableSkeleton />
          ) : funnel && funnel.funnel.rfqs === 0 ? (
            <EmptyMessage>{tr("No RFQs in this window.")}</EmptyMessage>
          ) : (
            funnel && (
              <FunnelBars
                stages={[
                  { label: tr("Created"), value: funnel.funnel.rfqs },
                  { label: tr("Quoted"), value: funnel.funnel.quoted },
                  { label: tr("Awarded"), value: funnel.funnel.awarded },
                  { label: tr("Delivered"), value: funnel.funnel.delivered },
                ]}
              />
            )
          )}
        </Panel>
      </div>
    </ClientLayout>
  );
};

// ==================== Local helpers ====================

const BarTable = ({ rows }: { rows: { label: string; value: number; count: number }[] }) => {
  const peak = rows.reduce((m, r) => Math.max(m, r.value), 0);
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = peak ? (r.value / peak) * 100 : 0;
        return (
          <div key={r.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#5f625f]">
                {r.label}{" "}
                <span className="text-xs text-muted-foreground">· {r.count}</span>
              </span>
              <span className="font-medium">{formatSAR(r.value)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#ece7e1]">
              <div className="h-full rounded-full bg-[#ff6d43]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FunnelBars = ({ stages }: { stages: { label: string; value: number }[] }) => {
  const peak = stages.reduce((m, s) => Math.max(m, s.value), 0);
  return (
    <div className="space-y-3">
      {stages.map((s) => {
        const pct = peak ? (s.value / peak) * 100 : 0;
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#5f625f]">{s.label}</span>
              <span className="font-medium">{s.value}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#ece7e1]">
              <div className="h-full rounded-full bg-[#ff6d43]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ClientReports;

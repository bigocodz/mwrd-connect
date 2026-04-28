import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import type { Id } from "@cvx/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatSAR } from "@/components/shared/VatBadge";

interface SupplierScorecardPanelProps {
  profileId: Id<"profiles">;
}

const fmtPct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(1)}%`);
const fmtHours = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n < 24) return `${n.toFixed(1)} h`;
  return `${(n / 24).toFixed(1)} d`;
};

const WINDOW_DAYS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
  { label: "Last 365 days", value: 365 },
  { label: "All time", value: 0 },
];

/**
 * Admin-side per-supplier scorecard (PRD §7.9 viewed from §5.3.2 supplier
 * profile context). Renders inline on AdminUserDetail when viewing a
 * supplier — gives Account Managers an at-a-glance read on tier, response,
 * and delivery without leaving the profile.
 */
export const SupplierScorecardPanel = ({ profileId }: SupplierScorecardPanelProps) => {
  const { tr } = useLanguage();
  const [windowDays, setWindowDays] = useState(90);

  const range = useMemo(() => {
    if (windowDays === 0) return {};
    return { from: Date.now() - windowDays * 86400 * 1000 };
  }, [windowDays]);

  const data = useQuery(api.reports.supplierPerformance, {
    supplier_id: profileId,
    ...range,
  });
  const loading = data === undefined;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
        <div>
          <CardTitle>{tr("Supplier scorecard")}</CardTitle>
          <CardDescription>
            {tr("Response, win-rate, and delivery performance over the selected window.")}
          </CardDescription>
        </div>
        <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v))}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOW_DAYS.map((w) => (
              <SelectItem key={w.value} value={String(w.value)}>
                {tr(w.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{tr("Loading…")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={tr("RFQs assigned")} value={String(data!.rfqs.assigned)} />
              <Stat label={tr("Quoted")} value={String(data!.rfqs.quoted)} />
              <Stat label={tr("Wins")} value={String(data!.rfqs.won)} />
              <Stat label={tr("Lost")} value={String(data!.rfqs.lost)} />
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={tr("Response rate")} value={fmtPct(data!.rates.responseRate)} tone="muted" />
              <Stat label={tr("Win rate")} value={fmtPct(data!.rates.winRate)} tone={data!.rates.winRate != null && data!.rates.winRate >= 30 ? "success" : "muted"} />
              <Stat label={tr("Avg response")} value={fmtHours(data!.rates.avgResponseHours)} tone="muted" />
              <Stat
                label={tr("On-time delivery")}
                value={fmtPct(data!.delivery.onTimeRate)}
                tone={
                  data!.delivery.onTimeRate == null
                    ? "muted"
                    : data!.delivery.onTimeRate < 80
                      ? "danger"
                      : "success"
                }
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
              <Badge variant="outline">
                {tr("Delivered")}: {data!.delivery.deliveredCount}
              </Badge>
              <Badge variant="outline">
                {tr("Cancelled")}: {data!.delivery.cancelledCount}
              </Badge>
              {data!.delivery.disputedCount > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-800">
                  {tr("Disputed")}: {data!.delivery.disputedCount}
                </Badge>
              )}
              <span className="ms-auto text-muted-foreground">
                {tr("Revenue")}:{" "}
                <span className="font-medium text-foreground">
                  {formatSAR(data!.revenue.total)}
                </span>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger" | "muted";
}) => {
  const valueClass =
    tone === "danger"
      ? "text-red-700"
      : tone === "success"
        ? "text-green-700"
        : tone === "muted"
          ? "text-muted-foreground"
          : "";
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl leading-none ${valueClass}`}>{value}</p>
    </div>
  );
};

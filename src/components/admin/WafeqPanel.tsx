import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScanEye, RefreshCw } from "lucide-react";

const STATUS_TONE: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-800",
  API_ERROR: "bg-red-100 text-red-800",
  ZATCA_ERROR: "bg-red-100 text-red-800",
  NETWORK_ERROR: "bg-amber-100 text-amber-800",
  CONFIG_ERROR: "bg-amber-100 text-amber-800",
};

const ENV_TONE: Record<string, string> = {
  production: "bg-green-100 text-green-800",
  simulation: "bg-amber-100 text-amber-800",
  mock: "bg-zinc-100 text-zinc-700",
};

/**
 * Wafeq submission console (PRD §5.8 / §8.1.5). Surfaces the integration
 * environment (production / simulation / mock), recent sync activity, the
 * last error if any, and a quick-look at every API attempt.
 */
export const WafeqPanel = () => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";
  const summary = useQuery(api.wafeqQueries.summary, {}) as
    | {
        total: number;
        byStatus: Record<string, number>;
        lastError: any;
        lastReconcileAt: number | null;
        lastWebhookAt: number | null;
      }
    | undefined;
  const [logOpen, setLogOpen] = useState(false);
  const log = useQuery(
    api.wafeqQueries.recentSyncLog,
    logOpen ? { limit: 200 } : "skip",
  ) as any[] | undefined;

  const checkStatus = useAction(api.wafeq.status);
  const reconcileNow = useAction(api.wafeq.reconcile);
  const [env, setEnv] = useState<{ environment: string; configured: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const refreshStatus = async () => {
    setBusy(true);
    try {
      const result = await checkStatus({});
      setEnv(result);
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleReconcileNow = async () => {
    setReconciling(true);
    try {
      const r = await reconcileNow({});
      if (r.errors > 0) {
        toast.error(
          tr("Reconciled {scanned} — {drift} updated, {errors} errors", {
            scanned: r.scanned,
            drift: r.drift,
            errors: r.errors,
          }),
        );
      } else {
        toast.success(
          tr("Reconciled {scanned} — {drift} updated", {
            scanned: r.scanned,
            drift: r.drift,
          }),
        );
      }
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setReconciling(false);
    }
  };

  const formatRelative = (ts: number | null) => {
    if (!ts) return tr("Never");
    const minutes = Math.floor((Date.now() - ts) / 60000);
    if (minutes < 1) return tr("Just now");
    if (minutes < 60) return tr("{n}m ago", { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return tr("{n}h ago", { n: hours });
    const days = Math.floor(hours / 24);
    return tr("{n}d ago", { n: days });
  };

  // Resolve env on first render
  useEffect(() => {
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const successCount = summary?.byStatus?.SUCCESS ?? 0;
  const errorCount =
    (summary?.byStatus?.API_ERROR ?? 0) +
    (summary?.byStatus?.ZATCA_ERROR ?? 0) +
    (summary?.byStatus?.NETWORK_ERROR ?? 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <ScanEye className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{tr("Wafeq / ZATCA submission console")}</p>
              <p className="text-xs text-muted-foreground">
                {tr("Tax invoices flow through Wafeq for ZATCA Phase 2 clearance.")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {env && (
              <Badge variant="outline" className={ENV_TONE[env.environment] ?? ""}>
                {tr("Env")}: {tr(env.environment)}
              </Badge>
            )}
            {env && !env.configured && (
              <Badge variant="outline" className="bg-zinc-100 text-zinc-700">
                {tr("Mock — no API key")}
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={refreshStatus} disabled={busy}>
              <RefreshCw className="w-3.5 h-3.5 me-1" /> {tr("Refresh")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleReconcileNow} disabled={reconciling}>
              <RefreshCw className={`w-3.5 h-3.5 me-1 ${reconciling ? "animate-spin" : ""}`} /> {tr("Reconcile now")}
            </Button>
            <Dialog open={logOpen} onOpenChange={setLogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">{tr("Open sync log")}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>{tr("Wafeq sync log")}</DialogTitle>
                </DialogHeader>
                {log === undefined ? (
                  <p className="text-sm text-muted-foreground">{tr("Loading…")}</p>
                ) : log.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {tr("No Wafeq submissions recorded yet.")}
                  </p>
                ) : (
                  <div className="max-h-[60vh] overflow-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tr("Timestamp")}</TableHead>
                          <TableHead>{tr("Operation")}</TableHead>
                          <TableHead>{tr("Target")}</TableHead>
                          <TableHead>{tr("Env")}</TableHead>
                          <TableHead>{tr("Status")}</TableHead>
                          <TableHead>{tr("Latency")}</TableHead>
                          <TableHead>{tr("Detail")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {log.map((row: any) => (
                          <TableRow key={row._id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(row._creationTime).toLocaleString(locale)}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{row.operation}</TableCell>
                            <TableCell className="text-xs font-mono">
                              {row.target_type}:{String(row.target_id).slice(0, 8)}…
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={ENV_TONE[row.environment] ?? ""}>
                                {row.environment}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={STATUS_TONE[row.status] ?? ""}>
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {row.duration_ms != null ? `${row.duration_ms}ms` : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-md truncate" title={row.error_message ?? row.error_code ?? ""}>
                              {row.status === "SUCCESS"
                                ? row.response_summary?.id ?? "—"
                                : `${row.error_code ?? ""}: ${row.error_message ?? ""}`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {summary && (
          <>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label={tr("Recent attempts")} value={String(summary.total)} />
              <Stat label={tr("Succeeded")} value={String(successCount)} tone="success" />
              <Stat label={tr("Errors")} value={String(errorCount)} tone={errorCount > 0 ? "danger" : "muted"} />
              <Stat
                label={tr("Last error")}
                value={
                  summary.lastError
                    ? `${summary.lastError.error_code ?? "ERROR"}`
                    : tr("None")
                }
                tone={summary.lastError ? "danger" : "muted"}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span>
                {tr("Last reconciliation")}: <span className="font-medium text-foreground">{formatRelative(summary.lastReconcileAt)}</span>
              </span>
              <span>
                {tr("Last webhook")}: <span className="font-medium text-foreground">{formatRelative(summary.lastWebhookAt)}</span>
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
    <div className="rounded-md border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-medium ${valueClass}`}>{value}</p>
    </div>
  );
};

interface InvoiceWafeqStatusProps {
  invoice: any;
}

/** Compact inline badge for an invoice row. */
export const InvoiceWafeqStatus = ({ invoice }: InvoiceWafeqStatusProps) => {
  const { tr } = useLanguage();
  if (!invoice.wafeq_invoice_id) {
    return (
      <Badge variant="outline" className="text-xs">
        {tr("Not submitted")}
      </Badge>
    );
  }
  if (invoice.zatca_status === "CLEARED") {
    return (
      <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
        {tr("ZATCA cleared")}
        {invoice.wafeq_environment && invoice.wafeq_environment !== "production" && (
          <span className="ms-1 text-[10px] opacity-70">({invoice.wafeq_environment})</span>
        )}
      </Badge>
    );
  }
  if (invoice.zatca_last_error) {
    return (
      <Badge variant="outline" className="text-xs bg-red-100 text-red-800" title={invoice.zatca_last_error}>
        {tr("ZATCA error")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800">
      {invoice.zatca_status ?? tr("Pending")}
    </Badge>
  );
};

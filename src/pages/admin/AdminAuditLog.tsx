import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { useLanguage } from "@/contexts/LanguageContext";
import { DualDate } from "@/components/shared/DualDate";

const AdminAuditLog = () => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";
  // New canonical audit log (PRD §13.4): captures every privileged mutation
  // across the platform, not just admin-initiated ones.
  const logsData = useQuery(api.auditLog.listAudit, { limit: 500 });
  const loading = logsData === undefined;
  const allLogs = logsData ?? [];

  const [actionFilter, setActionFilter] = useState("ALL");
  const [targetTypeFilter, setTargetTypeFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const actions = useMemo(() => [...new Set(allLogs.map((l: any) => l.action))].sort(), [allLogs]);
  const targetTypes = useMemo(
    () => [...new Set(allLogs.map((l: any) => l.target_type).filter(Boolean))].sort() as string[],
    [allLogs],
  );

  const logs = useMemo(() => {
    return allLogs.filter((log: any) => {
      if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
      if (targetTypeFilter !== "ALL" && log.target_type !== targetTypeFilter) return false;
      if (roleFilter !== "ALL" && log.actor_role !== roleFilter) return false;
      if (dateFrom && log._creationTime < new Date(dateFrom).getTime()) return false;
      if (dateTo && log._creationTime > new Date(dateTo + "T23:59:59").getTime()) return false;
      return true;
    });
  }, [allLogs, actionFilter, targetTypeFilter, roleFilter, dateFrom, dateTo]);

  const { page, setPage, totalPages, paginated, total } = usePagination(logs);

  const summarizeChange = (log: any) => {
    if (log.before && log.after) {
      const keys = [...new Set([...Object.keys(log.before), ...Object.keys(log.after)])];
      return keys
        .map((k) => `${k}: ${JSON.stringify(log.before[k])} → ${JSON.stringify(log.after[k])}`)
        .join(", ");
    }
    if (log.after) return JSON.stringify(log.after);
    if (log.before) return JSON.stringify(log.before);
    if (log.details) return JSON.stringify(log.details);
    return "—";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("Audit Log")}</h1>
          <p className="text-muted-foreground mt-1">{tr("Append-only record of every privileged action across the platform.")}</p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">{tr("Action")}</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr("All Actions")}</SelectItem>
                {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr("Target")}</Label>
            <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr("All targets")}</SelectItem>
                {targetTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr("Role")}</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr("All Roles")}</SelectItem>
                <SelectItem value="ADMIN">{tr("Admin")}</SelectItem>
                <SelectItem value="CLIENT">{tr("Client")}</SelectItem>
                <SelectItem value="SUPPLIER">{tr("Supplier")}</SelectItem>
                <SelectItem value="SYSTEM">{tr("System")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">{tr("From")}</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">{tr("To")}</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" /></div>
        </div>

        {loading ? <TableSkeleton rows={8} cols={6} /> : logs.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="audit" title={tr("No audit logs found")} description={tr("Privileged actions will be recorded here.")} />
          </CardContent></Card>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("Timestamp")}</TableHead>
                    <TableHead>{tr("Actor")}</TableHead>
                    <TableHead>{tr("Action")}</TableHead>
                    <TableHead>{tr("Target")}</TableHead>
                    <TableHead>{tr("Change")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((log: any) => (
                    <TableRow key={log._id}>
                      <TableCell className="text-xs whitespace-nowrap"><DualDate value={log._creationTime} withTime /></TableCell>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {log.actor_role ?? "SYSTEM"}
                          </Badge>
                          {log.actor_public_id || (log.actor_profile_id ? String(log.actor_profile_id).slice(0, 8) : "—")}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs font-mono">{log.action}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {log.target_type ? (
                          <span className="font-mono">
                            {log.target_type}
                            {log.target_id ? `:${String(log.target_id).slice(0, 8)}…` : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate" title={summarizeChange(log)}>
                        {summarizeChange(log)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAuditLog;

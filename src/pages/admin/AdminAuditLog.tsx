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

const AdminAuditLog = () => {
  const logsData = useQuery(api.auditLog.listAll);
  const loading = logsData === undefined;
  const allLogs = logsData ?? [];

  const [actionFilter, setActionFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const actions = useMemo(() => [...new Set(allLogs.map((l: any) => l.action))].sort(), [allLogs]);

  const logs = useMemo(() => {
    return allLogs.filter((log: any) => {
      if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
      if (dateFrom && log._creationTime < new Date(dateFrom).getTime()) return false;
      if (dateTo && log._creationTime > new Date(dateTo + "T23:59:59").getTime()) return false;
      return true;
    });
  }, [allLogs, actionFilter, dateFrom, dateTo]);

  const { page, setPage, totalPages, paginated, total } = usePagination(logs);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Audit Log</h1>
          <p className="text-muted-foreground mt-1">Read-only log of all admin actions.</p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">Action</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Actions</SelectItem>
                {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" /></div>
        </div>

        {loading ? <TableSkeleton rows={8} cols={5} /> : logs.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="audit" title="No audit logs found" description="Admin actions will be recorded here." />
          </CardContent></Card>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((log: any) => (
                    <TableRow key={log._id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(log._creationTime).toLocaleString()}</TableCell>
                      <TableCell className="font-medium text-sm">{log.admin_public_id || log.admin_id?.slice(0, 8)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs font-mono">{log.action}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {log.target_user_id ? <span className="font-mono">{String(log.target_user_id).slice(0, 8)}…</span> : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{log.details ? JSON.stringify(log.details) : "—"}</TableCell>
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

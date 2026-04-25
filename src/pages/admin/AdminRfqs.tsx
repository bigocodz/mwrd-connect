import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";

const statusColor: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  QUOTED: "bg-green-100 text-green-800",
  CLOSED: "bg-muted text-muted-foreground",
};

const AdminRfqs = () => {
  const [statusFilter, setStatusFilter] = useState("ALL");

  const rfqsData = useQuery(api.rfqs.listAll);
  const loading = rfqsData === undefined;
  const rfqs = rfqsData ?? [];

  const filtered = statusFilter === "ALL" ? rfqs : rfqs.filter((r) => r.status === statusFilter);
  const { page, setPage, totalPages, paginated, total } = usePagination(filtered);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">All RFQs</h1>
            <p className="text-muted-foreground mt-1">Review all client requests for quotes.</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="QUOTED">Quoted</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="rfqs" title="No RFQs found" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RFQ ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Docs</TableHead>
                  <TableHead>Quotes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((rfq) => (
                  <TableRow key={rfq._id}>
                    <TableCell className="font-mono text-xs">{rfq._id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-medium">{(rfq as any).client_public_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor[rfq.status] || ""}>{rfq.status}</Badge>
                    </TableCell>
                    <TableCell>{(rfq as any).items_count}</TableCell>
                    <TableCell>{(rfq as any).attachments_count ?? 0}</TableCell>
                    <TableCell>{(rfq as any).quotes_count ?? 0}</TableCell>
                    <TableCell className="text-sm">{new Date(rfq._creationTime).toLocaleDateString()}</TableCell>
                    <TableCell className="text-end">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/admin/rfqs/${rfq._id}/quotes`}>Compare</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminRfqs;

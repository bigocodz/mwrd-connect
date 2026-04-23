import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Link } from "react-router-dom";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";

const statusColor: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  QUOTED: "bg-green-100 text-green-800",
  CLOSED: "bg-muted text-muted-foreground",
};

const SupplierRfqs = () => {
  const assignmentsData = useQuery(api.rfqs.listAssigned);
  const loading = assignmentsData === undefined;
  const assignments = (assignmentsData ?? []).filter(Boolean);
  const { page, setPage, totalPages, paginated, total } = usePagination(assignments);

  return (
    <SupplierLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Assigned RFQs</h1>
          <p className="text-muted-foreground mt-1">Respond to client requests with your pricing.</p>
        </div>

        {loading ? <TableSkeleton rows={5} cols={5} /> : assignments.length === 0 ? (
          <EmptyState icon="rfqs" title="No RFQs assigned yet" description="When a client requests your products, they will appear here." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RFQ</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((a: any) => (
                  <TableRow key={a._id}>
                    <TableCell className="font-mono text-xs">{a.rfq_id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-medium">{a.rfq?.client_public_id}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[a.rfq?.status] || ""}>{a.rfq?.status}</Badge></TableCell>
                    <TableCell>{a.rfq?.items_count}</TableCell>
                    <TableCell className="text-sm">{a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : new Date(a._creationTime).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {a.has_quote ? <Badge variant="secondary">Quoted</Badge>
                        : a.rfq?.status === "OPEN" ? <Button variant="default" size="sm" asChild><Link to={`/supplier/rfqs/${a.rfq_id}/respond`}>Respond</Link></Button>
                        : <span className="text-xs text-muted-foreground">Closed</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}
      </div>
    </SupplierLayout>
  );
};

export default SupplierRfqs;

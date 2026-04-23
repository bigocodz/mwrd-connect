import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Link } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";

const statusColor: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  QUOTED: "bg-green-100 text-green-800",
  CLOSED: "bg-muted text-muted-foreground",
};

const ClientRfqs = () => {
  const rfqsData = useQuery(api.rfqs.listMine);
  const loading = rfqsData === undefined;
  const rfqs = rfqsData ?? [];
  const { page, setPage, totalPages, paginated, total } = usePagination(rfqs);

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">My RFQs</h1>
            <p className="text-muted-foreground mt-1">Track your Requests for Quote.</p>
          </div>
          <Button asChild><Link to="/client/rfq/new"><Plus className="w-4 h-4 mr-2" /> New RFQ</Link></Button>
        </div>

        {loading ? <TableSkeleton rows={5} cols={5} /> : rfqs.length === 0 ? (
          <EmptyState icon="rfqs" title="No RFQs yet" description="Create your first request to get started!" action={
            <Button asChild><Link to="/client/rfq/new"><Plus className="w-4 h-4 mr-2" /> New RFQ</Link></Button>
          } />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RFQ ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((rfq: any) => (
                  <TableRow key={rfq._id}>
                    <TableCell className="font-mono text-xs">{rfq._id.slice(0, 8)}…</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[rfq.status]}>{rfq.status}</Badge></TableCell>
                    <TableCell>{rfq.items_count}</TableCell>
                    <TableCell className="text-sm">{new Date(rfq._creationTime).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">{rfq.expiry_date ? new Date(rfq.expiry_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" asChild><Link to={`/client/rfqs/${rfq._id}`}>View</Link></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientRfqs;

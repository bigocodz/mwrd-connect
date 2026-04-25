import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Link } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GitCompare, Plus } from "lucide-react";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { useLanguage } from "@/contexts/LanguageContext";

const statusColor: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  QUOTED: "bg-green-100 text-green-800",
  CLOSED: "bg-muted text-muted-foreground",
};

const ClientRfqs = () => {
  const { tr, lang } = useLanguage();
  const rfqsData = useQuery(api.rfqs.listMine);
  const loading = rfqsData === undefined;
  const rfqs = rfqsData ?? [];
  const { page, setPage, totalPages, paginated, total } = usePagination(rfqs);

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{tr("My RFQs")}</h1>
            <p className="text-muted-foreground mt-1">{tr("Track your Requests for Quote.")}</p>
          </div>
          <Button asChild><Link to="/client/rfq/new"><Plus className="w-4 h-4 me-2" /> {tr("New RFQ")}</Link></Button>
        </div>

        {loading ? <TableSkeleton rows={5} cols={5} /> : rfqs.length === 0 ? (
          <EmptyState icon="rfqs" title={tr("No RFQs yet")} description={tr("Create your first request to get started!")} action={
            <Button asChild><Link to="/client/rfq/new"><Plus className="w-4 h-4 me-2" /> {tr("New RFQ")}</Link></Button>
          } />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("RFQ ID")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                  <TableHead>{tr("Items")}</TableHead>
                  <TableHead>{tr("Docs")}</TableHead>
                  <TableHead>{tr("Quotes")}</TableHead>
                  <TableHead>{tr("Created")}</TableHead>
                  <TableHead>{tr("Expiry")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((rfq: any) => (
                  <TableRow key={rfq._id}>
                    <TableCell className="font-mono text-xs">{rfq._id.slice(0, 8)}…</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[rfq.status]}>{tr(rfq.status)}</Badge></TableCell>
                    <TableCell>{rfq.items_count}</TableCell>
                    <TableCell>{rfq.attachments_count ?? 0}</TableCell>
                    <TableCell>{rfq.quotes_count ?? 0}</TableCell>
                    <TableCell className="text-sm">{new Date(rfq._creationTime).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA")}</TableCell>
                    <TableCell className="text-sm">{rfq.expiry_date ? new Date(rfq.expiry_date).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA") : "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {(rfq.quotes_count ?? 0) > 0 && (
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/client/rfqs/${rfq._id}/compare`}>
                              <GitCompare className="me-2 h-4 w-4" />
                              {tr("Compare")}
                            </Link>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" asChild><Link to={`/client/rfqs/${rfq._id}`}>{tr("View")}</Link></Button>
                      </div>
                    </TableCell>
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

import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Link } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { formatSAR } from "@/components/shared/VatBadge";
import {
  CLIENT_INVOICE_STATUS_COLOR,
  CLIENT_INVOICE_STATUS_LABEL,
} from "@/components/invoices/clientInvoiceStatus";
import { StatementPanel } from "@/components/invoices/StatementPanel";

const ClientInvoices = () => {
  const invoicesData = useQuery(api.clientInvoices.listMine);
  const loading = invoicesData === undefined;
  const invoices = invoicesData ?? [];
  const outstanding = invoices
    .filter((i: any) => i.status === "PENDING_PAYMENT" || i.status === "OVERDUE")
    .reduce((sum: number, i: any) => sum + (i.total_amount ?? 0), 0);
  const overdueCount = invoices.filter((i: any) => i.status === "OVERDUE").length;
  const { page, setPage, totalPages, paginated, total } = usePagination(invoices);

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground mt-1">All invoices issued by MWRD for your orders.</p>
        </div>

        {invoices.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-display font-bold mt-1">{formatSAR(outstanding)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Overdue</p>
              <p className="text-2xl font-display font-bold mt-1">{overdueCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Total invoices</p>
              <p className="text-2xl font-display font-bold mt-1">{invoices.length}</p>
            </CardContent></Card>
          </div>
        )}

        {loading ? <TableSkeleton rows={5} cols={6} /> : invoices.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState
              icon="payments"
              title="No invoices yet"
              description="MWRD will issue invoices once orders are delivered."
            />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((inv: any) => (
                  <TableRow key={inv._id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm">{inv.issue_date}</TableCell>
                    <TableCell className="text-sm">{inv.due_date}</TableCell>
                    <TableCell className="font-medium">{formatSAR(inv.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={CLIENT_INVOICE_STATUS_COLOR[inv.status] || ""}>
                        {CLIENT_INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                      {inv.status === "VOID" && inv.void_reason && (
                        <p className="text-xs text-muted-foreground mt-1">{inv.void_reason}</p>
                      )}
                      {inv.status === "PAID" && inv.paid_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Paid {new Date(inv.paid_at).toLocaleDateString()}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {inv.order_id ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/client/orders/${inv.order_id}`}>View order</Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}

        <StatementPanel mode="MY" />
      </div>
    </ClientLayout>
  );
};

export default ClientInvoices;

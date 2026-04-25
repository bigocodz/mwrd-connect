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
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/components/orders/orderStatus";
import { useLanguage } from "@/contexts/LanguageContext";

const ClientOrders = () => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";
  const ordersData = useQuery(api.orders.listMineClient);
  const loading = ordersData === undefined;
  const orders = ordersData ?? [];
  const { page, setPage, totalPages, paginated, total } = usePagination(orders);

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("My Orders")}</h1>
          <p className="text-muted-foreground mt-1">{tr("Track orders created from accepted quotes.")}</p>
        </div>

        {loading ? <TableSkeleton rows={5} cols={6} /> : orders.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="quotes" title={tr("No orders yet")} description={tr("Accept a quote to create an order.")} />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Order")}</TableHead>
                  <TableHead>{tr("Supplier")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                  <TableHead>{tr("Total")}</TableHead>
                  <TableHead>{tr("Created")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((order: any) => (
                  <TableRow key={order._id}>
                    <TableCell className="font-mono text-xs">{order._id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-medium">
                      {order.supplier_public_id}
                      {order.supplier_company_name && (
                        <div className="text-xs text-muted-foreground">{order.supplier_company_name}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ORDER_STATUS_COLOR[order.status] || ""}>
                        {tr(ORDER_STATUS_LABEL[order.status] ?? order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatSAR(order.total_with_vat)}</TableCell>
                    <TableCell className="text-sm">{new Date(order._creationTime).toLocaleDateString(locale)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/client/orders/${order._id}`}>{tr("View")}</Link>
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
    </ClientLayout>
  );
};

export default ClientOrders;

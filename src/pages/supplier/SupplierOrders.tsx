import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Link } from "react-router-dom";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { formatSAR } from "@/components/shared/VatBadge";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/components/orders/orderStatus";

const SupplierOrders = () => {
  const ordersData = useQuery(api.orders.listMineSupplier);
  const loading = ordersData === undefined;
  const orders = ordersData ?? [];
  const { page, setPage, totalPages, paginated, total } = usePagination(orders);

  return (
    <SupplierLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground mt-1">Confirm new orders and track fulfillment.</p>
        </div>

        {loading ? <TableSkeleton rows={5} cols={6} /> : orders.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="quotes" title="No orders yet" description="Confirmed quotes will create orders here." />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((order: any) => (
                  <TableRow key={order._id}>
                    <TableCell className="font-mono text-xs">{order._id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-medium">
                      {order.client_public_id}
                      {order.client_company_name && (
                        <div className="text-xs text-muted-foreground">{order.client_company_name}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ORDER_STATUS_COLOR[order.status] || ""}>
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatSAR(order.total_with_vat)}</TableCell>
                    <TableCell className="text-sm">{new Date(order._creationTime).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/supplier/orders/${order._id}`}>View</Link>
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
    </SupplierLayout>
  );
};

export default SupplierOrders;

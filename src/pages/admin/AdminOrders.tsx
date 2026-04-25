import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { formatSAR } from "@/components/shared/VatBadge";
import { DISPUTE_BADGE_COLOR, DISPUTE_LABEL, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/components/orders/orderStatus";
import { downloadCsv } from "@/lib/csv";
import { Download01 } from "@untitledui/icons";

const STATUS_OPTIONS = [
  "ALL",
  "DISPUTED",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PREPARING",
  "DISPATCHED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
];

const AdminOrders = () => {
  const ordersData = useQuery(api.orders.listAll);
  const loading = ordersData === undefined;
  const orders = ordersData ?? [];
  const [statusFilter, setStatusFilter] = useState("ALL");
  const filtered =
    statusFilter === "ALL"
      ? orders
      : statusFilter === "DISPUTED"
      ? orders.filter((o: any) => o.dispute_status === "OPEN")
      : orders.filter((o: any) => o.status === statusFilter);
  const { page, setPage, totalPages, paginated, total } = usePagination(filtered);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Orders</h1>
            <p className="text-muted-foreground mt-1">Lifecycle of every accepted-quote order.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={!filtered.length}
              onClick={() => {
                const header = [
                  "order_id",
                  "status",
                  "dispute_status",
                  "client",
                  "supplier",
                  "total_with_vat",
                  "delivery_location",
                  "required_by",
                  "created_at",
                  "dispatched_at",
                  "delivered_at",
                  "completed_at",
                  "cancelled_at",
                ];
                const rows = filtered.map((o: any) => [
                  o._id,
                  o.status,
                  o.dispute_status ?? "",
                  o.client_public_id ?? "",
                  o.supplier_public_id ?? "",
                  String(o.total_with_vat ?? ""),
                  o.delivery_location ?? "",
                  o.required_by ?? "",
                  new Date(o._creationTime).toISOString(),
                  o.dispatched_at ? new Date(o.dispatched_at).toISOString() : "",
                  o.delivered_at ? new Date(o.delivered_at).toISOString() : "",
                  o.completed_at ? new Date(o.completed_at).toISOString() : "",
                  o.cancelled_at ? new Date(o.cancelled_at).toISOString() : "",
                ]);
                downloadCsv(`mwrd-orders-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
              }}
            >
              <Download01 className="w-4 h-4 me-2" /> Export CSV
            </Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "ALL" ? "All statuses" : s === "DISPUTED" ? "Disputed" : ORDER_STATUS_LABEL[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? <TableSkeleton rows={5} cols={7} /> : filtered.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="quotes" title="No orders" description="Orders are created when clients accept a quote." />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Supplier</TableHead>
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
                    <TableCell>{order.client_public_id}</TableCell>
                    <TableCell>{order.supplier_public_id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={ORDER_STATUS_COLOR[order.status] || ""}>
                          {ORDER_STATUS_LABEL[order.status] ?? order.status}
                        </Badge>
                        {order.dispute_status && (
                          <Badge variant="outline" className={DISPUTE_BADGE_COLOR[order.dispute_status] || ""}>
                            {DISPUTE_LABEL[order.dispute_status] ?? order.dispute_status}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{formatSAR(order.total_with_vat)}</TableCell>
                    <TableCell className="text-sm">{new Date(order._creationTime).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/admin/orders/${order._id}`}>View</Link>
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

export default AdminOrders;

import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatSAR } from "@/components/shared/VatBadge";
import {
  DISPUTE_BADGE_COLOR,
  DISPUTE_LABEL,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
} from "@/components/orders/orderStatus";

const AdminDisputes = () => {
  const ordersData = useQuery(api.orders.listDisputed);
  const resolveDispute = useMutation(api.orders.resolveDispute);
  const loading = ordersData === undefined;
  const orders = ordersData ?? [];
  const open = orders.filter((o: any) => o.dispute_status === "OPEN");
  const closed = orders.filter((o: any) => o.dispute_status !== "OPEN");

  const [active, setActive] = useState<any | null>(null);
  const [resolution, setResolution] = useState("");
  const [outcome, setOutcome] = useState<"RESOLVED" | "REJECTED">("RESOLVED");
  const [busy, setBusy] = useState(false);

  const handleResolve = async () => {
    if (!active || !resolution.trim()) return;
    setBusy(true);
    try {
      await resolveDispute({ id: active._id, resolution: resolution.trim(), outcome });
      toast.success("Dispute updated");
      setActive(null);
      setResolution("");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (order: any) => (
    <TableRow key={order._id}>
      <TableCell className="font-mono text-xs">
        <Link className="hover:underline" to={`/admin/orders/${order._id}`}>{order._id.slice(0, 8)}…</Link>
      </TableCell>
      <TableCell>{order.client_public_id}</TableCell>
      <TableCell>{order.supplier_public_id}</TableCell>
      <TableCell>
        <Badge variant="outline" className={ORDER_STATUS_COLOR[order.status] || ""}>
          {ORDER_STATUS_LABEL[order.status] ?? order.status}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={DISPUTE_BADGE_COLOR[order.dispute_status] || ""}>
          {DISPUTE_LABEL[order.dispute_status] ?? order.dispute_status}
        </Badge>
      </TableCell>
      <TableCell className="text-sm max-w-xs">
        <p className="truncate" title={order.dispute_reason}>{order.dispute_reason ?? "—"}</p>
        {order.dispute_resolution && (
          <p className="text-xs text-muted-foreground truncate" title={order.dispute_resolution}>
            ↳ {order.dispute_resolution}
          </p>
        )}
      </TableCell>
      <TableCell className="font-medium">{formatSAR(order.total_with_vat)}</TableCell>
      <TableCell className="text-sm">
        {order.dispute_opened_at ? new Date(order.dispute_opened_at).toLocaleDateString() : "—"}
      </TableCell>
      <TableCell>
        {order.dispute_status === "OPEN" ? (
          <Button size="sm" onClick={() => { setActive(order); setResolution(""); setOutcome("RESOLVED"); }}>
            Resolve
          </Button>
        ) : (
          <Button size="sm" variant="ghost" asChild>
            <Link to={`/admin/orders/${order._id}`}>View</Link>
          </Button>
        )}
      </TableCell>
    </TableRow>
  );

  const renderTable = (rows: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Order status</TableHead>
          <TableHead>Dispute</TableHead>
          <TableHead>Reason / resolution</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Opened</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{rows.map(renderRow)}</TableBody>
    </Table>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Disputes</h1>
          <p className="text-muted-foreground mt-1">
            Resolve open disputes and review past dispute outcomes.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium">Open ({open.length})</h2>
          {loading ? <TableSkeleton rows={3} cols={9} /> : open.length === 0 ? (
            <Card><CardContent className="p-0">
              <EmptyState icon="audit" title="No open disputes" description="Everything is currently resolved." />
            </CardContent></Card>
          ) : (
            renderTable(open)
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium">Closed ({closed.length})</h2>
          {loading ? null : closed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prior disputes yet.</p>
          ) : (
            renderTable(closed)
          )}
        </section>
      </div>

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolve dispute</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {active?.dispute_reason && (
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="text-muted-foreground text-xs uppercase mb-1">Client said</p>
                <p>{active.dispute_reason}</p>
              </div>
            )}
            <div>
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESOLVED">Resolved in client favor</SelectItem>
                  <SelectItem value="REJECTED">Closed without action</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resolution notes</Label>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Refund issued, replacement scheduled, claim closed…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Close</Button>
            <Button disabled={busy || !resolution.trim()} onClick={handleResolve}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminDisputes;

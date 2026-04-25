import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Bell01, CheckCircle, Download01, Plus, XCircle } from "@untitledui/icons";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { formatSAR } from "@/components/shared/VatBadge";
import { downloadCsv } from "@/lib/csv";
import {
  CLIENT_INVOICE_STATUS_COLOR,
  CLIENT_INVOICE_STATUS_LABEL,
} from "@/components/invoices/clientInvoiceStatus";

const STATUS_FILTERS = ["ALL", "PENDING_PAYMENT", "OVERDUE", "PAID", "VOID"];

const todayISO = () => new Date().toISOString().slice(0, 10);
const offsetISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const AdminClientInvoices = () => {
  const invoicesData = useQuery(api.clientInvoices.listAll);
  const eligibleOrders = useQuery(api.clientInvoices.listOrdersAvailableForInvoice) ?? [];
  const createForOrder = useMutation(api.clientInvoices.createForOrder);
  const markPaid = useMutation(api.clientInvoices.markPaid);
  const markOverdue = useMutation(api.clientInvoices.markOverdue);
  const sendReminder = useMutation(api.clientInvoices.sendReminder);
  const voidInvoice = useMutation(api.clientInvoices.voidInvoice);

  const loading = invoicesData === undefined;
  const invoices = invoicesData ?? [];

  const [statusFilter, setStatusFilter] = useState("ALL");
  const filtered = statusFilter === "ALL" ? invoices : invoices.filter((i: any) => i.status === statusFilter);
  const { page, setPage, totalPages, paginated, total } = usePagination(filtered);

  const [createOpen, setCreateOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(offsetISO(30));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const [paidId, setPaidId] = useState<string | null>(null);
  const [paidRef, setPaidRef] = useState("");
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const handleCreate = async () => {
    if (!orderId) {
      toast.error("Pick an order");
      return;
    }
    setBusy(true);
    try {
      await createForOrder({
        order_id: orderId as any,
        issue_date: issueDate,
        due_date: dueDate,
        notes: notes.trim() || undefined,
      });
      toast.success("Invoice issued");
      setCreateOpen(false);
      setOrderId(""); setNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const wrap = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const header = [
      "invoice_number",
      "status",
      "client",
      "order_id",
      "issue_date",
      "due_date",
      "subtotal",
      "vat",
      "total",
      "paid_at",
      "paid_reference",
      "void_reason",
    ];
    const rows = filtered.map((i: any) => [
      i.invoice_number,
      i.status,
      i.client_public_id ?? "",
      i.order_id ?? "",
      i.issue_date ?? "",
      i.due_date ?? "",
      String(i.subtotal ?? ""),
      String(i.vat_amount ?? ""),
      String(i.total_amount ?? ""),
      i.paid_at ? new Date(i.paid_at).toISOString() : "",
      i.paid_reference ?? "",
      i.void_reason ?? "",
    ]);
    downloadCsv(`mwrd-client-invoices-${todayISO()}.csv`, [header, ...rows]);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Client Invoices</h1>
            <p className="text-muted-foreground mt-1">Issue invoices from completed orders, track payment, manage voids.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={!filtered.length} onClick={exportCsv}>
              <Download01 className="w-4 h-4 me-2" /> Export CSV
            </Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "ALL" ? "All statuses" : CLIENT_INVOICE_STATUS_LABEL[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => { setOrderId(""); setIssueDate(todayISO()); setDueDate(offsetISO(30)); setNotes(""); setCreateOpen(true); }}>
              <Plus className="w-4 h-4 me-2" /> Issue invoice
            </Button>
          </div>
        </div>

        {loading ? <TableSkeleton rows={5} cols={9} /> : filtered.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="payments" title="No invoices" description="Issue one from a delivered or completed order." />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((inv: any) => (
                  <TableRow key={inv._id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell>
                      <div className="font-medium">{inv.client_public_id}</div>
                      {inv.client_company_name && (
                        <div className="text-xs text-muted-foreground">{inv.client_company_name}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{inv.order_id ? inv.order_id.slice(0, 8) + "…" : "—"}</TableCell>
                    <TableCell className="text-sm">{inv.issue_date}</TableCell>
                    <TableCell className="text-sm">{inv.due_date}</TableCell>
                    <TableCell className="font-medium">{formatSAR(inv.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={CLIENT_INVOICE_STATUS_COLOR[inv.status] || ""}>
                        {CLIENT_INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                      {inv.status === "VOID" && inv.void_reason && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs truncate" title={inv.void_reason}>{inv.void_reason}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "—"}
                      {inv.paid_reference && <div className="text-muted-foreground font-mono">{inv.paid_reference}</div>}
                      {inv.matched_payment_id && (
                        <div className="text-muted-foreground">Reconciled</div>
                      )}
                      {inv.last_reminder_at && (
                        <div className="text-muted-foreground mt-1">
                          Reminded {new Date(inv.last_reminder_at).toLocaleDateString()}
                          {inv.reminder_count != null && ` (${inv.reminder_count}×)`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(inv.status === "PENDING_PAYMENT" || inv.status === "OVERDUE") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => wrap("Reminder sent", () => sendReminder({ id: inv._id }))}
                            disabled={busy}
                          >
                            <Bell01 className="w-3 h-3 me-1" /> Remind
                          </Button>
                        )}
                        {inv.status === "PENDING_PAYMENT" && (
                          <>
                            <Button size="sm" onClick={() => { setPaidId(inv._id); setPaidRef(""); }} disabled={busy}>
                              <CheckCircle className="w-3 h-3 me-1" /> Paid
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => wrap("Marked overdue", () => markOverdue({ id: inv._id }))} disabled={busy}>
                              Overdue
                            </Button>
                          </>
                        )}
                        {inv.status === "OVERDUE" && (
                          <Button size="sm" onClick={() => { setPaidId(inv._id); setPaidRef(""); }} disabled={busy}>
                            <CheckCircle className="w-3 h-3 me-1" /> Paid
                          </Button>
                        )}
                        {inv.status !== "PAID" && inv.status !== "VOID" && (
                          <Button size="sm" variant="destructive" onClick={() => { setVoidId(inv._id); setVoidReason(""); }} disabled={busy}>
                            <XCircle className="w-3 h-3 me-1" /> Void
                          </Button>
                        )}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Issue invoice</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Order</Label>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger><SelectValue placeholder={eligibleOrders.length === 0 ? "No eligible orders" : "Select an order…"} /></SelectTrigger>
                <SelectContent>
                  {eligibleOrders.map((o: any) => (
                    <SelectItem key={o._id} value={o._id}>
                      {o.client_public_id} — {formatSAR(o.total_with_vat ?? 0)} — {o.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {eligibleOrders.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Only delivered or completed orders without an active invoice are eligible.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Issue date</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for the client." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy || !orderId}>Issue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paidId !== null} onOpenChange={(o) => !o && setPaidId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark invoice paid</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Payment reference (optional)</Label>
            <Input value={paidRef} onChange={(e) => setPaidRef(e.target.value)} placeholder="Bank transfer / receipt #" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidId(null)}>Close</Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!paidId) return;
                await wrap("Marked paid", () => markPaid({ id: paidId as any, reference: paidRef.trim() || undefined }));
                setPaidId(null);
                setPaidRef("");
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voidId !== null} onOpenChange={(o) => !o && setVoidId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void invoice</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Why is this being voided?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidId(null)}>Close</Button>
            <Button
              variant="destructive"
              disabled={busy || !voidReason.trim()}
              onClick={async () => {
                if (!voidId) return;
                await wrap("Voided", () => voidInvoice({ id: voidId as any, reason: voidReason.trim() }));
                setVoidId(null);
                setVoidReason("");
              }}
            >
              Confirm void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminClientInvoices;

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, AlertTriangle, Link as LinkIcon } from "lucide-react";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { VatBadge, formatSAR } from "@/components/shared/VatBadge";

const statusColor: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  DISCREPANCY: "bg-red-100 text-red-800",
};

const ReconcileDialog = ({
  payment,
  open,
  onOpenChange,
}: {
  payment: any | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) => {
  const openInvoices = useQuery(
    api.reconciliation.listOpenInvoicesForClient,
    payment ? { client_id: payment.client_id } : "skip",
  );
  const allocations = useQuery(
    api.reconciliation.listPaymentAllocations,
    payment ? { payment_id: payment._id } : "skip",
  );
  const allocate = useMutation(api.reconciliation.allocatePayment);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const alreadyApplied = (allocations ?? []).reduce((s: number, a: any) => s + a.amount, 0);
  const remaining = payment ? payment.amount - alreadyApplied : 0;
  const selectedInvoices = (openInvoices ?? []).filter((inv: any) => selected[inv._id]);
  const selectedTotal = selectedInvoices.reduce((s: number, inv: any) => s + inv.total_amount, 0);
  const exceedsRemaining = selectedTotal > remaining + 0.01;

  const handleSubmit = async () => {
    if (!payment || selectedInvoices.length === 0) return;
    setBusy(true);
    try {
      await allocate({
        payment_id: payment._id,
        allocations: selectedInvoices.map((inv: any) => ({ invoice_id: inv._id, amount: inv.total_amount })),
      });
      toast.success("Payment reconciled");
      onOpenChange(false);
      setSelected({});
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Reconcile payment {payment?.bank_reference ? `· ${payment.bank_reference}` : ""}</DialogTitle></DialogHeader>
        {payment && (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Payment</p>
                <p className="font-medium">{formatSAR(payment.amount)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Already applied</p>
                <p className="font-medium">{formatSAR(alreadyApplied)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Remaining</p>
                <p className={`font-medium ${remaining < 0 ? "text-destructive" : ""}`}>{formatSAR(remaining)}</p>
              </div>
            </div>

            {(allocations ?? []).length > 0 && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Existing allocations</p>
                <ul className="text-sm space-y-1">
                  {(allocations ?? []).map((a: any) => (
                    <li key={a._id} className="flex justify-between border-b border-border pb-1">
                      <span>{a.invoice?.invoice_number ?? "—"}</span>
                      <span className="font-medium">{formatSAR(a.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-xs uppercase text-muted-foreground mb-1">Open invoices for this client</p>
              {openInvoices === undefined ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : openInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open invoices for this client.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openInvoices.map((inv: any) => (
                      <TableRow key={inv._id}>
                        <TableCell>
                          <Checkbox
                            checked={!!selected[inv._id]}
                            onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [inv._id]: !!v }))}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                        <TableCell className="text-sm">{inv.issue_date}</TableCell>
                        <TableCell className="text-sm">{inv.due_date}</TableCell>
                        <TableCell className="text-right font-medium">{formatSAR(inv.total_amount)}</TableCell>
                        <TableCell><Badge variant="outline">{inv.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {selectedInvoices.length > 0 && (
              <p className={`text-sm ${exceedsRemaining ? "text-destructive" : "text-muted-foreground"}`}>
                Selected total: <span className="font-medium">{formatSAR(selectedTotal)}</span>
                {exceedsRemaining ? " — exceeds remaining payment amount" : ""}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button
            disabled={busy || selectedInvoices.length === 0 || exceedsRemaining}
            onClick={handleSubmit}
          >
            Reconcile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AdminPayments = () => {
  const confirm = useMutation(api.payments.confirm);
  const flagDiscrepancy = useMutation(api.payments.flagDiscrepancy);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [discDialog, setDiscDialog] = useState(false);
  const [discPaymentId, setDiscPaymentId] = useState<string | null>(null);
  const [discNotes, setDiscNotes] = useState("");
  const [acting, setActing] = useState(false);
  const [reconcilePayment, setReconcilePayment] = useState<any | null>(null);

  const paymentsData = useQuery(api.payments.listAll);
  const loading = paymentsData === undefined;
  const payments = paymentsData ?? [];

  const filtered = statusFilter === "ALL" ? payments : payments.filter((p) => p.status === statusFilter);
  const { page, setPage, totalPages, paginated, total } = usePagination(filtered);

  const confirmPayment = async (paymentId: string) => {
    setActing(true);
    try {
      await confirm({ id: paymentId as any });
      toast.success("Payment confirmed");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setActing(false); }
  };

  const flagDiscrepancySubmit = async () => {
    if (!discPaymentId || !discNotes.trim()) return;
    setActing(true);
    try {
      await flagDiscrepancy({ id: discPaymentId as any, notes: discNotes });
      toast.success("Payment flagged as discrepancy");
      setDiscDialog(false);
      setDiscNotes("");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Payments</h1>
            <p className="text-muted-foreground mt-1">Manage and confirm client payments.</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="DISCREPANCY">Discrepancy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? <TableSkeleton rows={5} cols={7} /> : filtered.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="payments" title="No payments found" description="Payments will appear here when clients submit them." />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Amount <VatBadge className="ml-1" /></TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Bank Ref.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p: any) => (
                  <TableRow key={p._id}>
                    <TableCell>
                      <div className="font-medium">{p.client_public_id || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.client_company_name}</div>
                    </TableCell>
                    <TableCell className="font-medium">{formatSAR(Number(p.amount))}</TableCell>
                    <TableCell className="text-xs">{p.payment_method.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-xs font-mono">{p.bank_reference || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[p.status] || ""}>{p.status}</Badge></TableCell>
                    <TableCell className="text-sm">{new Date(p._creationTime).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {p.status === "PENDING" && (
                        <div className="flex gap-1">
                          <Button variant="default" size="sm" onClick={() => confirmPayment(p._id)} disabled={acting}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Confirm
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => { setDiscPaymentId(p._id); setDiscDialog(true); }}>
                            <AlertTriangle className="w-3 h-3 mr-1" /> Flag
                          </Button>
                        </div>
                      )}
                      {p.status === "PAID" && (
                        <Button variant="outline" size="sm" onClick={() => setReconcilePayment(p)}>
                          <LinkIcon className="w-3 h-3 mr-1" /> Reconcile
                        </Button>
                      )}
                      {p.status === "DISCREPANCY" && <span className="text-xs text-destructive">{p.notes}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}
      </div>

      <ReconcileDialog
        payment={reconcilePayment}
        open={reconcilePayment !== null}
        onOpenChange={(o) => !o && setReconcilePayment(null)}
      />

      <Dialog open={discDialog} onOpenChange={setDiscDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Flag Payment Discrepancy</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Discrepancy Notes</Label>
              <Textarea value={discNotes} onChange={(e) => setDiscNotes(e.target.value)} placeholder="Describe the discrepancy…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={flagDiscrepancySubmit} disabled={acting || !discNotes.trim()}>Flag Discrepancy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminPayments;

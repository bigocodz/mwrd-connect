import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { WafeqPanel, InvoiceWafeqStatus } from "@/components/admin/WafeqPanel";
import { InvoiceAdjustmentDialog } from "@/components/admin/InvoiceAdjustmentDialog";
import { DocumentsDialog } from "@/components/admin/DocumentsDialog";
import { CommentsDialog } from "@/components/comments/CommentsDialog";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { ORDER_STATUS_LABEL } from "@/components/orders/orderStatus";

const STATUS_FILTERS = ["ALL", "PENDING_PAYMENT", "OVERDUE", "PAID", "VOID"];

const MATCH_TONE: Record<string, string> = {
  MATCHED: "bg-green-100 text-green-800",
  MISMATCH: "bg-red-100 text-red-800",
  NO_GRN: "bg-amber-100 text-amber-800",
  DISPUTED_GRN: "bg-red-100 text-red-800",
  NOT_APPLICABLE: "bg-zinc-100 text-zinc-700",
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const offsetISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const AdminClientInvoices = () => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";
  const invoicesData = useQuery(api.clientInvoices.listAll);
  const eligibleOrders = useQuery(api.clientInvoices.listOrdersAvailableForInvoice) ?? [];
  const createForOrder = useMutation(api.clientInvoices.createForOrder);
  const markPaid = useMutation(api.clientInvoices.markPaid);
  const markOverdue = useMutation(api.clientInvoices.markOverdue);
  const sendReminder = useMutation(api.clientInvoices.sendReminder);
  const voidInvoice = useMutation(api.clientInvoices.voidInvoice);
  const submitToWafeq = useAction(api.wafeq.submitClientInvoice);
  const recomputeMatch = useMutation(api.threeWayMatch.recomputeForInvoice);

  const loading = invoicesData === undefined;
  const invoices = invoicesData ?? [];

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [matchFilter, setMatchFilter] = useState("ALL");
  const filtered = invoices.filter((i: any) => {
    if (statusFilter !== "ALL" && i.status !== statusFilter) return false;
    if (matchFilter === "MISMATCH") {
      // "Needs review" bucket — anything that's not a clean match or
      // explicitly not-applicable.
      if (i.match_status === "MATCHED" || i.match_status === "NOT_APPLICABLE") {
        return false;
      }
      if (!i.match_status) return false; // never computed
    } else if (matchFilter !== "ALL" && i.match_status !== matchFilter) {
      return false;
    }
    return true;
  });
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
      toast.error(tr("Pick an order"));
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
      toast.success(tr("Invoice issued"));
      setCreateOpen(false);
      setOrderId(""); setNotes("");
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
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
      toast.error(err.message || tr("Failed"));
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
            <h1 className="text-2xl font-display font-bold text-foreground">{tr("Client Invoices")}</h1>
            <p className="text-muted-foreground mt-1">{tr("Issue invoices from completed orders, track payment, manage voids.")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={!filtered.length} onClick={exportCsv}>
              <Download01 className="w-4 h-4 me-2" /> {tr("Export CSV")}
            </Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "ALL" ? tr("All statuses") : tr(CLIENT_INVOICE_STATUS_LABEL[s] ?? s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={matchFilter} onValueChange={setMatchFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder={tr("Match")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr("All matches")}</SelectItem>
                <SelectItem value="MISMATCH">{tr("Needs review")}</SelectItem>
                <SelectItem value="MATCHED">{tr("Matched")}</SelectItem>
                <SelectItem value="NO_GRN">{tr("No receipt")}</SelectItem>
                <SelectItem value="DISPUTED_GRN">{tr("Disputed receipt")}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setOrderId(""); setIssueDate(todayISO()); setDueDate(offsetISO(30)); setNotes(""); setCreateOpen(true); }}>
              <Plus className="w-4 h-4 me-2" /> {tr("Issue invoice")}
            </Button>
          </div>
        </div>

        <WafeqPanel />

        {loading ? <TableSkeleton rows={5} cols={9} /> : filtered.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="payments" title={tr("No invoices")} description={tr("Issue one from a delivered or completed order.")} />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Invoice #")}</TableHead>
                  <TableHead>{tr("Client")}</TableHead>
                  <TableHead>{tr("Order")}</TableHead>
                  <TableHead>{tr("Issued")}</TableHead>
                  <TableHead>{tr("Due")}</TableHead>
                  <TableHead>{tr("Total")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                  <TableHead>{tr("Paid")}</TableHead>
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
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant="outline" className={CLIENT_INVOICE_STATUS_COLOR[inv.status] || ""}>
                          {tr(CLIENT_INVOICE_STATUS_LABEL[inv.status] ?? inv.status)}
                        </Badge>
                        <InvoiceWafeqStatus invoice={inv} />
                        {inv.match_status && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${MATCH_TONE[inv.match_status] ?? ""}`}
                            title={inv.match_summary ?? ""}
                          >
                            {tr(`match.${inv.match_status}`)}
                          </Badge>
                        )}
                      </div>
                      {inv.status === "VOID" && inv.void_reason && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs truncate" title={inv.void_reason}>{inv.void_reason}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString(locale) : "—"}
                      {inv.paid_reference && <div className="text-muted-foreground font-mono">{inv.paid_reference}</div>}
                      {inv.matched_payment_id && (
                        <div className="text-muted-foreground">{tr("Reconciled")}</div>
                      )}
                      {inv.last_reminder_at && (
                        <div className="text-muted-foreground mt-1">
                          {tr("Reminded")} {new Date(inv.last_reminder_at).toLocaleDateString(locale)}
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
                            onClick={() => wrap(tr("Reminder sent"), () => sendReminder({ id: inv._id }))}
                            disabled={busy}
                          >
                            <Bell01 className="w-3 h-3 me-1" /> {tr("Remind")}
                          </Button>
                        )}
                        {inv.status === "PENDING_PAYMENT" && (
                          <>
                            <Button size="sm" onClick={() => { setPaidId(inv._id); setPaidRef(""); }} disabled={busy}>
                              <CheckCircle className="w-3 h-3 me-1" /> {tr("Paid")}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => wrap(tr("Marked overdue"), () => markOverdue({ id: inv._id }))} disabled={busy}>
                              {tr("Overdue")}
                            </Button>
                          </>
                        )}
                        {inv.status === "OVERDUE" && (
                          <Button size="sm" onClick={() => { setPaidId(inv._id); setPaidRef(""); }} disabled={busy}>
                            <CheckCircle className="w-3 h-3 me-1" /> {tr("Paid")}
                          </Button>
                        )}
                        {inv.status !== "PAID" && inv.status !== "VOID" && (
                          <Button size="sm" variant="destructive" onClick={() => { setVoidId(inv._id); setVoidReason(""); }} disabled={busy}>
                            <XCircle className="w-3 h-3 me-1" /> {tr("Void")}
                          </Button>
                        )}
                        {inv.status !== "VOID" && inv.zatca_status !== "CLEARED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const r = await submitToWafeq({ invoice_id: inv._id });
                                if (r.ok) {
                                  toast.success(tr("Submitted to Wafeq"));
                                } else {
                                  toast.error(r.errorMessage || tr("Wafeq submission failed"));
                                }
                              } catch (err: any) {
                                toast.error(err.message || tr("Wafeq submission failed"));
                              } finally {
                                setBusy(false);
                              }
                            }}
                            disabled={busy}
                          >
                            {tr("Send to Wafeq")}
                          </Button>
                        )}
                        {inv.status !== "VOID" && (
                          <>
                            <InvoiceAdjustmentDialog
                              invoice={inv}
                              type="CREDIT"
                              trigger={
                                <Button size="sm" variant="ghost" disabled={busy}>
                                  {tr("Credit note")}
                                </Button>
                              }
                            />
                            <InvoiceAdjustmentDialog
                              invoice={inv}
                              type="DEBIT"
                              trigger={
                                <Button size="sm" variant="ghost" disabled={busy}>
                                  {tr("Debit note")}
                                </Button>
                              }
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  const r = await recomputeMatch({ invoice_id: inv._id });
                                  toast.success(
                                    tr("Match: {status}", { status: tr(`match.${r.status}`) }),
                                  );
                                } catch (err: any) {
                                  toast.error(err.message || tr("Failed"));
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              title={inv.match_summary ?? ""}
                            >
                              {tr("Recompute match")}
                            </Button>
                            <DocumentsDialog
                              targetType="client_invoice"
                              targetId={inv._id}
                              trigger={
                                <Button size="sm" variant="ghost" disabled={busy}>
                                  {tr("Documents")}
                                </Button>
                              }
                            />
                            <CommentsDialog
                              targetType="client_invoice"
                              targetId={inv._id}
                              trigger={
                                <Button size="sm" variant="ghost" disabled={busy}>
                                  {tr("Comments")}
                                </Button>
                              }
                            />
                          </>
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
          <DialogHeader><DialogTitle>{tr("Issue invoice")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{tr("Order")}</Label>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger><SelectValue placeholder={eligibleOrders.length === 0 ? tr("No eligible orders") : tr("Select an order…")} /></SelectTrigger>
                <SelectContent>
                  {eligibleOrders.map((o: any) => (
                    <SelectItem key={o._id} value={o._id}>
                      {o.client_public_id} — {formatSAR(o.total_with_vat ?? 0)} — {tr(ORDER_STATUS_LABEL[o.status] ?? o.status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {eligibleOrders.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {tr("Only delivered or completed orders without an active invoice are eligible.")}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tr("Issue date")}</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div>
                <Label>{tr("Due date")}</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{tr("Notes")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tr("Optional notes for the client.")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{tr("Cancel")}</Button>
            <Button onClick={handleCreate} disabled={busy || !orderId}>{tr("Issue")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paidId !== null} onOpenChange={(o) => !o && setPaidId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("Mark invoice paid")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>{tr("Payment reference (optional)")}</Label>
            <Input value={paidRef} onChange={(e) => setPaidRef(e.target.value)} placeholder={tr("Bank transfer / receipt #")} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidId(null)}>{tr("Close")}</Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!paidId) return;
                await wrap(tr("Marked paid"), () => markPaid({ id: paidId as any, reference: paidRef.trim() || undefined }));
                setPaidId(null);
                setPaidRef("");
              }}
            >
              {tr("Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voidId !== null} onOpenChange={(o) => !o && setVoidId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("Void invoice")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>{tr("Reason")}</Label>
            <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder={tr("Why is this being voided?")} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidId(null)}>{tr("Close")}</Button>
            <Button
              variant="destructive"
              disabled={busy || !voidReason.trim()}
              onClick={async () => {
                if (!voidId) return;
                await wrap(tr("Voided"), () => voidInvoice({ id: voidId as any, reason: voidReason.trim() }));
                setVoidId(null);
                setVoidReason("");
              }}
            >
              {tr("Confirm void")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminClientInvoices;

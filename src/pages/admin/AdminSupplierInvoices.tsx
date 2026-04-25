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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle, Download01, XCircle } from "@untitledui/icons";
import { downloadCsv } from "@/lib/csv";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { formatSAR } from "@/components/shared/VatBadge";
import { INVOICE_STATUS_COLOR, INVOICE_STATUS_LABEL } from "@/components/orders/invoiceStatus";

const STATUS_FILTERS = ["ALL", "SUBMITTED", "APPROVED", "REJECTED", "PAID"];

const AdminSupplierInvoices = () => {
  const invoicesData = useQuery(api.supplierInvoices.listAll);
  const approve = useMutation(api.supplierInvoices.approve);
  const reject = useMutation(api.supplierInvoices.reject);
  const markPaid = useMutation(api.supplierInvoices.markPaid);

  const loading = invoicesData === undefined;
  const invoices = invoicesData ?? [];

  const [statusFilter, setStatusFilter] = useState("ALL");
  const filtered = statusFilter === "ALL" ? invoices : invoices.filter((i: any) => i.status === statusFilter);
  const { page, setPage, totalPages, paginated, total } = usePagination(filtered);

  const [busy, setBusy] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [paidId, setPaidId] = useState<string | null>(null);
  const [paidRef, setPaidRef] = useState("");

  const wrap = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Supplier Invoices</h1>
            <p className="text-muted-foreground mt-1">Review, approve, and mark supplier invoices as paid.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={!filtered.length}
              onClick={() => {
                const header = [
                  "invoice_number",
                  "status",
                  "supplier",
                  "order_id",
                  "issue_date",
                  "due_date",
                  "subtotal",
                  "vat_amount",
                  "total_amount",
                  "paid_at",
                  "paid_reference",
                  "rejection_reason",
                ];
                const rows = filtered.map((i: any) => [
                  i.invoice_number,
                  i.status,
                  i.supplier_public_id ?? "",
                  i.order_id,
                  i.issue_date ?? "",
                  i.due_date ?? "",
                  String(i.subtotal ?? ""),
                  String(i.vat_amount ?? ""),
                  String(i.total_amount ?? ""),
                  i.paid_at ? new Date(i.paid_at).toISOString() : "",
                  i.paid_reference ?? "",
                  i.rejection_reason ?? "",
                ]);
                downloadCsv(`mwrd-supplier-invoices-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
              }}
            >
              <Download01 className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s} value={s}>{s === "ALL" ? "All statuses" : INVOICE_STATUS_LABEL[s] ?? s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? <TableSkeleton rows={5} cols={8} /> : filtered.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="payments" title="No invoices" description="Suppliers can submit invoices once orders are delivered." />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((inv: any) => (
                  <TableRow key={inv._id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>
                      <div className="font-medium">{inv.supplier_public_id}</div>
                      {inv.supplier_company_name && (
                        <div className="text-xs text-muted-foreground">{inv.supplier_company_name}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{inv.order_id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-sm">{inv.issue_date}</TableCell>
                    <TableCell className="font-medium">{formatSAR(inv.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={INVOICE_STATUS_COLOR[inv.status] || ""}>
                        {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.file_url ? (
                        <a className="underline text-sm" href={inv.file_url} target="_blank" rel="noreferrer">
                          {inv.file_name || "Download"}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {inv.status === "SUBMITTED" && (
                          <>
                            <Button size="sm" onClick={() => wrap("Approved", () => approve({ id: inv._id }))} disabled={busy}>
                              <CheckCircle className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setRejectId(inv._id); setRejectReason(""); }} disabled={busy}>
                              <XCircle className="w-3 h-3 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {inv.status === "APPROVED" && (
                          <Button size="sm" onClick={() => { setPaidId(inv._id); setPaidRef(""); }} disabled={busy}>
                            Mark Paid
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

      <Dialog open={rejectId !== null} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject invoice</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Tell the supplier what to fix." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Close</Button>
            <Button
              variant="destructive"
              disabled={busy || !rejectReason.trim()}
              onClick={async () => {
                if (!rejectId) return;
                await wrap("Rejected", () => reject({ id: rejectId as any, reason: rejectReason.trim() }));
                setRejectId(null);
                setRejectReason("");
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paidId !== null} onOpenChange={(open) => !open && setPaidId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark invoice paid</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Payment reference (optional)</Label>
            <Input value={paidRef} onChange={(e) => setPaidRef(e.target.value)} placeholder="Bank ref or transfer number" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidId(null)}>Close</Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!paidId) return;
                await wrap("Marked paid", () =>
                  markPaid({ id: paidId as any, reference: paidRef.trim() || undefined }),
                );
                setPaidId(null);
                setPaidRef("");
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSupplierInvoices;

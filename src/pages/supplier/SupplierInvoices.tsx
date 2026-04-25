import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import SupplierLayout from "@/components/supplier/SupplierLayout";
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
import { Plus, Upload01 } from "@untitledui/icons";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { formatSAR } from "@/components/shared/VatBadge";
import { INVOICE_STATUS_COLOR, INVOICE_STATUS_LABEL } from "@/components/orders/invoiceStatus";

const SupplierInvoices = () => {
  const invoicesData = useQuery(api.supplierInvoices.listMine);
  const eligibleData = useQuery(api.supplierInvoices.listEligibleOrders);
  const submit = useMutation(api.supplierInvoices.submit);
  const generateUploadUrl = useMutation(api.supplierInvoices.generateUploadUrl);

  const loading = invoicesData === undefined;
  const invoices = invoicesData ?? [];
  const eligible = eligibleData ?? [];
  const { page, setPage, totalPages, paginated, total } = usePagination(invoices);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [vatAmount, setVatAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadedStorageId, setUploadedStorageId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const selectedOrder = eligible.find((o: any) => o._id === orderId);
  const totalAmount = (parseFloat(subtotal || "0") || 0) + (parseFloat(vatAmount || "0") || 0);

  const handleSelectOrder = (id: string) => {
    setOrderId(id);
    const order = eligible.find((o: any) => o._id === id);
    if (order) {
      const vat = order.total_with_vat - order.total_before_vat;
      setSubtotal(order.total_before_vat.toFixed(2));
      setVatAmount(vat.toFixed(2));
    }
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const url = await generateUploadUrl();
      const upload = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!upload.ok) throw new Error("Upload failed");
      const { storageId } = await upload.json();
      setUploadedStorageId(storageId);
      setUploadedFileName(file.name);
      toast.success("Invoice file uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const reset = () => {
    setOrderId(""); setInvoiceNumber(""); setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate(""); setSubtotal(""); setVatAmount(""); setNotes("");
    setUploadedStorageId(null); setUploadedFileName(null);
  };

  const handleSubmit = async () => {
    if (!orderId || !invoiceNumber.trim() || !issueDate || !subtotal || !vatAmount) {
      toast.error("Fill order, invoice number, dates, and amounts");
      return;
    }
    setBusy(true);
    try {
      await submit({
        order_id: orderId as any,
        invoice_number: invoiceNumber.trim(),
        issue_date: issueDate,
        due_date: dueDate || undefined,
        subtotal: parseFloat(subtotal),
        vat_amount: parseFloat(vatAmount),
        total_amount: totalAmount,
        notes: notes.trim() || undefined,
        storage_id: (uploadedStorageId as any) || undefined,
        file_name: uploadedFileName || undefined,
      });
      toast.success("Invoice submitted");
      setDialogOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SupplierLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Invoices</h1>
            <p className="text-muted-foreground mt-1">Submit invoices for delivered orders.</p>
          </div>
          <Button onClick={() => { reset(); setDialogOpen(true); }} disabled={eligible.length === 0}>
            <Plus className="w-4 h-4 mr-2" /> New Invoice
          </Button>
        </div>

        {loading ? <TableSkeleton rows={5} cols={6} /> : invoices.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState
              icon="payments"
              title="No invoices yet"
              description={
                eligible.length === 0
                  ? "Once an order is delivered, you can invoice it from here."
                  : `${eligible.length} delivered order(s) ready to invoice.`
              }
            />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((inv: any) => (
                  <TableRow key={inv._id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.order_id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-sm">{inv.issue_date}</TableCell>
                    <TableCell className="font-medium">{formatSAR(inv.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={INVOICE_STATUS_COLOR[inv.status] || ""}>
                        {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                      {inv.status === "REJECTED" && inv.rejection_reason && (
                        <p className="text-xs text-muted-foreground mt-1">{inv.rejection_reason}</p>
                      )}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Submit invoice</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Order</Label>
              <Select value={orderId} onValueChange={handleSelectOrder}>
                <SelectTrigger><SelectValue placeholder="Select a delivered order…" /></SelectTrigger>
                <SelectContent>
                  {eligible.map((o: any) => (
                    <SelectItem key={o._id} value={o._id}>
                      {o._id.slice(0, 8)}… — {formatSAR(o.total_with_vat)} — {o.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOrder && (
                <p className="text-xs text-muted-foreground mt-1">
                  Order total: {formatSAR(selectedOrder.total_with_vat)}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Invoice number</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></div>
              <div><Label>Issue date</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
              <div><Label>Subtotal (SAR)</Label><Input type="number" min={0} step="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} /></div>
              <div><Label>VAT (SAR)</Label><Input type="number" min={0} step="0.01" value={vatAmount} onChange={(e) => setVatAmount(e.target.value)} /></div>
              <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
              <div className="flex flex-col justify-end">
                <Label>Total</Label>
                <p className="text-lg font-bold text-primary">{formatSAR(totalAmount)}</p>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for MWRD finance." />
            </div>
            <div>
              <Label>Invoice file (PDF)</Label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                  <Upload01 className="w-4 h-4 mr-2" /> {uploadedFileName ? "Replace file" : "Upload file"}
                </Button>
                {uploadedFileName && <span className="text-sm text-muted-foreground">{uploadedFileName}</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={busy}>Submit Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SupplierLayout>
  );
};

export default SupplierInvoices;

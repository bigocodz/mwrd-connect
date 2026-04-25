import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle, Plus } from "lucide-react";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { formatSAR } from "@/components/shared/VatBadge";
import { useLanguage } from "@/contexts/LanguageContext";

const statusColor: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
};

const paymentMethodLabel: Record<string, string> = {
  BANK_TRANSFER: "Bank transfer",
  CHECK: "Check",
};

const AdminPayouts = () => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";
  const createPayout = useMutation(api.payouts.create);
  const markPaid = useMutation(api.payouts.markPaid);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [recordDialog, setRecordDialog] = useState(false);
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState<"BANK_TRANSFER" | "CHECK">("BANK_TRANSFER");
  const [formBankRef, setFormBankRef] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [acting, setActing] = useState(false);

  const payoutsData = useQuery(api.payouts.listAll);
  const suppliersData = useQuery(api.users.listSuppliers);
  const loading = payoutsData === undefined;
  const payouts = payoutsData ?? [];
  const suppliers = suppliersData ?? [];

  const filtered = statusFilter === "ALL" ? payouts : payouts.filter((p) => p.status === statusFilter);
  const { page, setPage, totalPages, paginated, total } = usePagination(filtered);

  const recordPayout = async () => {
    if (!formSupplierId || !formAmount) return;
    setActing(true);
    try {
      await createPayout({
        supplier_id: formSupplierId as any,
        amount: parseFloat(formAmount),
        payment_method: formMethod,
        bank_reference: formBankRef || undefined,
        notes: formNotes || undefined,
      });
      toast.success(tr("Payout recorded"));
      setRecordDialog(false);
      resetForm();
    } catch (err: any) {
      toast.error(tr("Error: ") + err.message);
    } finally {
      setActing(false);
    }
  };

  const markAsPaid = async (payoutId: string) => {
    setActing(true);
    try {
      await markPaid({ id: payoutId as any });
      toast.success(tr("Payout marked as paid"));
    } catch (err: any) {
      toast.error(tr("Error: ") + err.message);
    } finally {
      setActing(false);
    }
  };

  const resetForm = () => {
    setFormSupplierId(""); setFormAmount(""); setFormMethod("BANK_TRANSFER"); setFormBankRef(""); setFormNotes("");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{tr("Supplier Payouts")}</h1>
            <p className="text-muted-foreground mt-1">{tr("Record and track payments to suppliers.")}</p>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr("All")}</SelectItem>
                <SelectItem value="PENDING">{tr("PENDING")}</SelectItem>
                <SelectItem value="PAID">{tr("PAID")}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { resetForm(); setRecordDialog(true); }}>
              <Plus className="w-4 h-4 me-2" /> {tr("Record Payout")}
            </Button>
          </div>
        </div>

        {loading ? <TableSkeleton rows={5} cols={8} /> : filtered.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="payouts" title={tr("No payouts found")} description={tr("Record your first supplier payout.")} />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Supplier")}</TableHead>
                  <TableHead>{tr("Amount")}</TableHead>
                  <TableHead>{tr("Method")}</TableHead>
                  <TableHead>{tr("Bank Ref.")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                  <TableHead>{tr("Paid At")}</TableHead>
                  <TableHead>{tr("Created")}</TableHead>
                  <TableHead>{tr("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p: any) => (
                  <TableRow key={p._id}>
                    <TableCell>
                      <div className="font-medium">{p.supplier_public_id || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.supplier_company_name}</div>
                    </TableCell>
                    <TableCell className="font-medium">{formatSAR(Number(p.amount))}</TableCell>
                    <TableCell className="text-xs">{tr(paymentMethodLabel[p.payment_method] ?? p.payment_method)}</TableCell>
                    <TableCell className="text-xs font-mono">{p.bank_reference || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[p.status] || ""}>{tr(p.status)}</Badge></TableCell>
                    <TableCell className="text-sm">{p.paid_at ? new Date(p.paid_at).toLocaleDateString(locale) : "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(p._creationTime).toLocaleDateString(locale)}</TableCell>
                    <TableCell>
                      {p.status === "PENDING" && (
                        <Button size="sm" onClick={() => markAsPaid(p._id)} disabled={acting}>
                          <CheckCircle className="w-3 h-3 me-1" /> {tr("Mark Paid")}
                        </Button>
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

      <Dialog open={recordDialog} onOpenChange={setRecordDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("Record Supplier Payout")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{tr("Supplier")}</Label>
              <Select value={formSupplierId} onValueChange={setFormSupplierId}>
                <SelectTrigger><SelectValue placeholder={tr("Select supplier…")} /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s._id} value={s._id}>{s.public_id} — {s.company_name || tr("No name")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{tr("Amount (SAR)")}</Label><Input type="number" min={0} step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} /></div>
            <div>
              <Label>{tr("Payment Method")}</Label>
              <Select value={formMethod} onValueChange={(v) => setFormMethod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">{tr("Bank transfer")}</SelectItem>
                  <SelectItem value="CHECK">{tr("Check")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{tr("Bank Reference (optional)")}</Label><Input value={formBankRef} onChange={(e) => setFormBankRef(e.target.value)} placeholder={tr("Reference number…")} /></div>
            <div><Label>{tr("Notes (optional)")}</Label><Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder={tr("Additional notes…")} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialog(false)}>{tr("Cancel")}</Button>
            <Button onClick={recordPayout} disabled={acting || !formSupplierId || !formAmount}>{tr("Record Payout")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminPayouts;

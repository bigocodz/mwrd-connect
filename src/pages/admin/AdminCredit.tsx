import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, DollarSign } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatSAR } from "@/components/shared/VatBadge";

const AdminCredit = () => {
  const { tr } = useLanguage();
  const updateCreditLimit = useMutation(api.users.updateCreditLimit);
  const adjustBalance = useMutation(api.users.adjustBalance);
  const logAudit = useMutation(api.auditLog.insert);

  const clientsData = useQuery(api.users.listClients);
  const loading = clientsData === undefined;
  const clients = clientsData ?? [];

  const [editDialog, setEditDialog] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [editCreditLimit, setEditCreditLimit] = useState("");

  const [adjustDialog, setAdjustDialog] = useState(false);
  const [adjustClient, setAdjustClient] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [acting, setActing] = useState(false);

  const saveCreditLimit = async () => {
    if (!editClient) return;
    setActing(true);
    try {
      const newLimit = parseFloat(editCreditLimit);
      await updateCreditLimit({ id: editClient._id, credit_limit: newLimit });
      await logAudit({ action: "UPDATE_CREDIT_LIMIT", target_user_id: editClient._id, details: { old_limit: editClient.credit_limit, new_limit: newLimit } });
      toast.success(tr("Credit limit updated"));
      setEditDialog(false);
    } catch (err: any) {
      toast.error(tr("Error: ") + err.message);
    } finally {
      setActing(false);
    }
  };

  const saveBalanceAdjustment = async () => {
    if (!adjustClient || !adjustAmount || !adjustReason.trim()) return;
    setActing(true);
    try {
      const amount = parseFloat(adjustAmount);
      const result = await adjustBalance({ id: adjustClient._id, adjustment: amount });
      await logAudit({
        action: "BALANCE_ADJUSTMENT",
        target_user_id: adjustClient._id,
        details: { previous_balance: adjustClient.current_balance, adjustment: amount, new_balance: (result as any)?.newBalance, reason: adjustReason },
      });
      toast.success(tr("Balance adjusted"));
      setAdjustDialog(false);
      setAdjustAmount("");
      setAdjustReason("");
    } catch (err: any) {
      toast.error(tr("Error: ") + err.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("Credit Management")}</h1>
          <p className="text-muted-foreground mt-1">{tr("Manage client credit limits and balances.")}</p>
        </div>

        {loading ? (
          <div className="text-muted-foreground text-center py-16">{tr("Loading…")}</div>
        ) : clients.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <DollarSign className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{tr("No clients found.")}</p>
            </CardContent>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr("Client")}</TableHead>
                <TableHead>{tr("Company")}</TableHead>
                <TableHead>{tr("Credit Limit (SAR)")}</TableHead>
                <TableHead>{tr("Current Balance (SAR)")}</TableHead>
                <TableHead>{tr("Payment Terms")}</TableHead>
                <TableHead>{tr("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c._id}>
                  <TableCell className="font-medium">{c.public_id}</TableCell>
                  <TableCell>{c.company_name || "—"}</TableCell>
                  <TableCell>{formatSAR(Number(c.credit_limit || 0))}</TableCell>
                  <TableCell className={Number(c.current_balance || 0) < 0 ? "text-destructive font-medium" : ""}>
                    {formatSAR(Number(c.current_balance || 0))}
                  </TableCell>
                  <TableCell className="text-sm">{c.payment_terms || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => { setEditClient(c); setEditCreditLimit(String(c.credit_limit || 0)); setEditDialog(true); }}>
                        <Pencil className="w-3 h-3 me-1" /> {tr("Limit")}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => { setAdjustClient(c); setAdjustDialog(true); }}>
                        <DollarSign className="w-3 h-3 me-1" /> {tr("Adjust")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("Edit Credit Limit")} — {editClient?.public_id}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{tr("Credit Limit (SAR)")}</Label>
              <Input type="number" min={0} step="0.01" value={editCreditLimit} onChange={(e) => setEditCreditLimit(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>{tr("Cancel")}</Button>
            <Button onClick={saveCreditLimit} disabled={acting}>{tr("Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("Balance Adjustment")} — {adjustClient?.public_id}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Card className="bg-muted/50">
              <CardContent className="py-3">
                <p className="text-sm text-muted-foreground">{tr("Current Balance")}</p>
                <p className="font-bold text-lg">{formatSAR(Number(adjustClient?.current_balance || 0))}</p>
              </CardContent>
            </Card>
            <div>
              <Label>{tr("Adjustment Amount (SAR)")}</Label>
              <p className="text-xs text-muted-foreground mb-1">{tr("Use negative for deductions, positive for credits.")}</p>
              <Input type="number" step="0.01" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder={tr("e.g. -500 or +1000")} />
            </div>
            <div>
              <Label>{tr("Reason")}</Label>
              <Textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder={tr("Reason for this adjustment…")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(false)}>{tr("Cancel")}</Button>
            <Button onClick={saveBalanceAdjustment} disabled={acting || !adjustAmount || !adjustReason.trim()}>{tr("Apply Adjustment")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCredit;

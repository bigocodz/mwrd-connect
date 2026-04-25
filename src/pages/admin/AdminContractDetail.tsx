import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import { Trash01 } from "@untitledui/icons";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { formatSAR } from "@/components/shared/VatBadge";
import { CONTRACT_STATUS_COLOR, CONTRACT_STATUS_LABEL } from "@/components/contracts/contractStatus";

type LineDraft = {
  id?: string;
  product_id?: string;
  description: string;
  unit_price: string;
  min_quantity: string;
  notes: string;
};

const emptyLine = (): LineDraft => ({
  description: "",
  unit_price: "",
  min_quantity: "",
  notes: "",
});

const AdminContractDetail = () => {
  const { contractId } = useParams<{ contractId: string }>();
  const data = useQuery(api.contracts.getById, contractId ? { id: contractId as any } : "skip");
  const products = useQuery(api.products.listApprovedWithSupplier) ?? [];
  const update = useMutation(api.contracts.update);
  const setStatus = useMutation(api.contracts.setStatus);
  const addLine = useMutation(api.contracts.addLine);
  const updateLine = useMutation(api.contracts.updateLine);
  const removeLine = useMutation(api.contracts.removeLine);

  const loading = data === undefined;
  const contract: any = data;

  const supplierProducts = (products as any[]).filter((p) => contract && p.supplier_id === contract.supplier_id);

  const [draft, setDraft] = useState<{
    name: string;
    start_date: string;
    end_date: string;
    payment_terms: string;
    discount_percent: string;
    terms: string;
    notes: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<LineDraft | null>(null);

  useEffect(() => {
    if (contract) {
      setDraft({
        name: contract.name,
        start_date: contract.start_date,
        end_date: contract.end_date ?? "",
        payment_terms: contract.payment_terms ?? "",
        discount_percent: contract.discount_percent != null ? String(contract.discount_percent) : "",
        terms: contract.terms ?? "",
        notes: contract.notes ?? "",
      });
    }
  }, [contract?._id]);

  const saveContract = async () => {
    if (!contract || !draft) return;
    setBusy(true);
    try {
      await update({
        id: contract._id,
        name: draft.name,
        client_id: contract.client_id ?? undefined,
        supplier_id: contract.supplier_id,
        start_date: draft.start_date,
        end_date: draft.end_date || undefined,
        payment_terms: draft.payment_terms || undefined,
        discount_percent: draft.discount_percent ? parseFloat(draft.discount_percent) : undefined,
        terms: draft.terms || undefined,
        notes: draft.notes || undefined,
      });
      toast.success("Saved");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const submitLine = async () => {
    if (!editing || !contract) return;
    if (!editing.description.trim()) { toast.error("Description required"); return; }
    const price = parseFloat(editing.unit_price);
    if (!Number.isFinite(price) || price < 0) { toast.error("Unit price must be ≥ 0"); return; }
    const minQty = editing.min_quantity ? parseInt(editing.min_quantity, 10) : undefined;
    setBusy(true);
    try {
      if (editing.id) {
        await updateLine({
          id: editing.id as any,
          product_id: editing.product_id ? (editing.product_id as any) : undefined,
          description: editing.description,
          unit_price: price,
          min_quantity: minQty,
          notes: editing.notes.trim() || undefined,
        });
      } else {
        await addLine({
          contract_id: contract._id,
          product_id: editing.product_id ? (editing.product_id as any) : undefined,
          description: editing.description,
          unit_price: price,
          min_quantity: minQty,
          notes: editing.notes.trim() || undefined,
        });
      }
      toast.success("Line saved");
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteLine = async (id: string) => {
    if (!confirm("Remove this line item?")) return;
    try {
      await removeLine({ id: id as any });
      toast.success("Removed");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  if (loading) return <AdminLayout><TableSkeleton rows={4} cols={4} /></AdminLayout>;
  if (!contract) return <AdminLayout><p className="text-muted-foreground">Contract not found.</p></AdminLayout>;

  const productNameById = new Map<string, string>(
    (products as any[]).map((p) => [p._id, p.name]),
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Link to="/admin/contracts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All contracts
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{contract.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <Badge variant="outline" className={CONTRACT_STATUS_COLOR[contract.status] || ""}>
                {CONTRACT_STATUS_LABEL[contract.status] ?? contract.status}
              </Badge>
              <span className="text-muted-foreground">Supplier:</span> <span className="font-medium">{contract.supplier_public_id}</span>
              <span className="text-muted-foreground">Client:</span>{" "}
              <span className="font-medium">{contract.client_public_id ?? "All clients"}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {contract.status === "DRAFT" && (
              <Button onClick={() => setStatus({ id: contract._id, status: "ACTIVE" }).then(() => toast.success("Activated"))}>
                Activate
              </Button>
            )}
            {contract.status === "ACTIVE" && (
              <Button variant="outline" onClick={() => setStatus({ id: contract._id, status: "EXPIRED" }).then(() => toast.success("Expired"))}>
                Mark expired
              </Button>
            )}
            {(contract.status === "DRAFT" || contract.status === "ACTIVE") && (
              <Button
                variant="destructive"
                onClick={() => {
                  const reason = prompt("Reason for termination?") || undefined;
                  if (reason !== undefined) {
                    setStatus({ id: contract._id, status: "TERMINATED", reason }).then(() => toast.success("Terminated"));
                  }
                }}
              >
                Terminate
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {draft && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Name</Label>
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Discount %</Label>
                    <Input type="number" step="0.01" min="0" max="100" value={draft.discount_percent} onChange={(e) => setDraft({ ...draft, discount_percent: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start date</Label>
                    <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>End date</Label>
                    <Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Payment terms</Label>
                  <Input value={draft.payment_terms} onChange={(e) => setDraft({ ...draft, payment_terms: e.target.value })} placeholder="Net 30" />
                </div>
                <div>
                  <Label>Terms (free text)</Label>
                  <Textarea value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} />
                </div>
                <div>
                  <Label>Internal notes</Label>
                  <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveContract} disabled={busy}>Save details</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Contracted line items ({contract.lines.length})</CardTitle>
              <Button size="sm" onClick={() => setEditing(emptyLine())}>
                <Plus className="w-4 h-4 me-2" /> Add line
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {contract.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6">No lines yet. Add at least one to surface contracted pricing on quotes.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-end">Unit price</TableHead>
                    <TableHead className="text-end">Min qty</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contract.lines.map((line: any) => (
                    <TableRow key={line._id}>
                      <TableCell className="text-sm">
                        {line.product_id ? productNameById.get(line.product_id) ?? <span className="text-muted-foreground">Unknown product</span> : <span className="text-muted-foreground">Generic</span>}
                      </TableCell>
                      <TableCell>
                        <div>{line.description}</div>
                        {line.notes && <div className="text-xs text-muted-foreground">{line.notes}</div>}
                      </TableCell>
                      <TableCell className="text-end font-medium">{formatSAR(line.unit_price)}</TableCell>
                      <TableCell className="text-end">{line.min_quantity ?? "—"}</TableCell>
                      <TableCell className="text-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditing({
                          id: line._id,
                          product_id: line.product_id,
                          description: line.description,
                          unit_price: String(line.unit_price),
                          min_quantity: line.min_quantity != null ? String(line.min_quantity) : "",
                          notes: line.notes ?? "",
                        })}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteLine(line._id)}>
                          <Trash01 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit line" : "Add line"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              <div>
                <Label>Product (optional)</Label>
                <Select value={editing.product_id ?? "__none"} onValueChange={(v) => setEditing({ ...editing, product_id: v === "__none" ? undefined : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Generic / no specific product</SelectItem>
                    {supplierProducts.map((p: any) => (
                      <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {supplierProducts.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">This supplier has no approved products yet — line will be generic.</p>
                )}
              </div>
              <div>
                <Label>Description</Label>
                <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Unit price (SAR)</Label>
                  <Input type="number" step="0.01" min="0" value={editing.unit_price} onChange={(e) => setEditing({ ...editing, unit_price: e.target.value })} />
                </div>
                <div>
                  <Label>Min quantity (optional)</Label>
                  <Input type="number" min="0" step="1" value={editing.min_quantity} onChange={(e) => setEditing({ ...editing, min_quantity: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={submitLine} disabled={busy}>Save line</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminContractDetail;

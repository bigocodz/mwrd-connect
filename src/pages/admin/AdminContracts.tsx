import { useState } from "react";
import { Link } from "react-router-dom";
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
import { Plus } from "@untitledui/icons";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { CONTRACT_STATUS_COLOR, CONTRACT_STATUS_LABEL } from "@/components/contracts/contractStatus";

type Draft = {
  name: string;
  client_id: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  payment_terms: string;
  discount_percent: string;
  terms: string;
  notes: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const empty = (): Draft => ({
  name: "",
  client_id: "",
  supplier_id: "",
  start_date: todayISO(),
  end_date: "",
  payment_terms: "",
  discount_percent: "",
  terms: "",
  notes: "",
});

const AdminContracts = () => {
  const contracts = useQuery(api.contracts.listAll) ?? [];
  const suppliers = useQuery(api.users.listSuppliers) ?? [];
  const clients = useQuery(api.users.listClients) ?? [];
  const create = useMutation(api.contracts.create);
  const setStatus = useMutation(api.contracts.setStatus);
  const loading = contracts === undefined;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty());
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!draft.name.trim()) { toast.error("Name required"); return; }
    if (!draft.supplier_id) { toast.error("Pick a supplier"); return; }
    if (!draft.start_date) { toast.error("Start date required"); return; }
    setBusy(true);
    try {
      await create({
        name: draft.name.trim(),
        client_id: draft.client_id ? (draft.client_id as any) : undefined,
        supplier_id: draft.supplier_id as any,
        start_date: draft.start_date,
        end_date: draft.end_date || undefined,
        payment_terms: draft.payment_terms.trim() || undefined,
        discount_percent: draft.discount_percent ? parseFloat(draft.discount_percent) : undefined,
        terms: draft.terms.trim() || undefined,
        notes: draft.notes.trim() || undefined,
      });
      toast.success("Contract created");
      setOpen(false);
      setDraft(empty());
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (id: string, status: "DRAFT" | "ACTIVE" | "EXPIRED" | "TERMINATED", reason?: string) => {
    try {
      await setStatus({ id: id as any, status, reason });
      toast.success(`Marked ${status.toLowerCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Contracts</h1>
            <p className="text-muted-foreground mt-1">Negotiated pricing and commercial terms with suppliers (optionally per client).</p>
          </div>
          <Button onClick={() => { setDraft(empty()); setOpen(true); }}>
            <Plus className="w-4 h-4 me-2" /> New contract
          </Button>
        </div>

        {loading ? <TableSkeleton rows={4} cols={7} /> : contracts.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="audit" title="No contracts yet" description="Create one to lock in pricing or terms with a supplier." />
          </CardContent></Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Client scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c: any) => (
                <TableRow key={c._id}>
                  <TableCell className="font-medium">
                    <Link to={`/admin/contracts/${c._id}`} className="hover:underline">{c.name}</Link>
                  </TableCell>
                  <TableCell>
                    {c.supplier_public_id}
                    {c.supplier_company_name && (
                      <div className="text-xs text-muted-foreground">{c.supplier_company_name}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.client_id ? (c.client_public_id || "—") : <span className="text-muted-foreground">All clients</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={CONTRACT_STATUS_COLOR[c.status] || ""}>
                      {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{c.start_date}{c.end_date ? ` → ${c.end_date}` : ""}</TableCell>
                  <TableCell>{c.lines?.length ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {c.status === "DRAFT" && (
                        <Button size="sm" onClick={() => updateStatus(c._id, "ACTIVE")}>Activate</Button>
                      )}
                      {c.status === "ACTIVE" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(c._id, "EXPIRED")}>Expire</Button>
                      )}
                      {(c.status === "DRAFT" || c.status === "ACTIVE") && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            const reason = prompt("Reason for termination?") || undefined;
                            if (reason !== undefined) updateStatus(c._id, "TERMINATED", reason);
                          }}
                        >
                          Terminate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New contract</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Annual Office Supplies — Pilot" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Supplier</Label>
                <Select value={draft.supplier_id} onValueChange={(v) => setDraft({ ...draft, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: any) => (
                      <SelectItem key={s._id} value={s._id}>{s.public_id} — {s.company_name ?? "—"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Client (optional)</Label>
                <Select value={draft.client_id || "__any"} onValueChange={(v) => setDraft({ ...draft, client_id: v === "__any" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any">All clients</SelectItem>
                    {clients.map((c: any) => (
                      <SelectItem key={c._id} value={c._id}>{c.public_id} — {c.company_name ?? "—"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start date</Label>
                <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
              </div>
              <div>
                <Label>End date (optional)</Label>
                <Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment terms</Label>
                <Input value={draft.payment_terms} onChange={(e) => setDraft({ ...draft, payment_terms: e.target.value })} placeholder="Net 30" />
              </div>
              <div>
                <Label>Discount %</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={draft.discount_percent}
                  onChange={(e) => setDraft({ ...draft, discount_percent: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Terms (free text)</Label>
              <Textarea value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} />
            </div>
            <div>
              <Label>Internal notes</Label>
              <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminContracts;

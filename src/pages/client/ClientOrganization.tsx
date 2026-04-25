import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash01 } from "@untitledui/icons";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatSAR } from "@/components/shared/VatBadge";
import { Badge } from "@/components/ui/badge";

type FieldDef = { name: keyof FormState; label: string; type?: "text" | "textarea"; placeholder?: string };

type FormState = {
  code?: string;
  name: string;
  location?: string;
  notes?: string;
};

const SectionEmpty = ({ label }: { label: string }) => (
  <p className="text-sm text-muted-foreground italic px-4 py-6 text-center">{label}</p>
);

type RuleDraft = {
  id?: string;
  name: string;
  min_amount: string;
  max_amount: string;
  category?: string;
  cost_center_id?: string;
  branch_id?: string;
  department_id?: string;
  enabled: boolean;
  notes?: string;
};

const emptyRule = (): RuleDraft => ({
  name: "",
  min_amount: "",
  max_amount: "",
  enabled: true,
});

const ClientOrganization = () => {
  const costCenters = useQuery(api.organization.listMyCostCenters) ?? [];
  const branches = useQuery(api.organization.listMyBranches) ?? [];
  const departments = useQuery(api.organization.listMyDepartments) ?? [];
  const rules = useQuery(api.approvals.listMyRules) ?? [];
  const upsertRule = useMutation(api.approvals.upsertRule);
  const deleteRule = useMutation(api.approvals.deleteRule);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [ruleBusy, setRuleBusy] = useState(false);

  const saveRule = async () => {
    if (!ruleDraft) return;
    if (!ruleDraft.name.trim()) {
      toast.error("Name required");
      return;
    }
    const min = Number(ruleDraft.min_amount);
    if (!Number.isFinite(min) || min < 0) {
      toast.error("Minimum amount required");
      return;
    }
    const maxRaw = ruleDraft.max_amount.trim();
    let max: number | undefined;
    if (maxRaw) {
      max = Number(maxRaw);
      if (!Number.isFinite(max) || max < min) {
        toast.error("Maximum must be ≥ minimum");
        return;
      }
    }
    setRuleBusy(true);
    try {
      await upsertRule({
        id: ruleDraft.id ? (ruleDraft.id as any) : undefined,
        name: ruleDraft.name.trim(),
        min_amount: min,
        max_amount: max,
        category: ruleDraft.category?.trim() || undefined,
        cost_center_id: ruleDraft.cost_center_id ? (ruleDraft.cost_center_id as any) : undefined,
        branch_id: ruleDraft.branch_id ? (ruleDraft.branch_id as any) : undefined,
        department_id: ruleDraft.department_id ? (ruleDraft.department_id as any) : undefined,
        enabled: ruleDraft.enabled,
        notes: ruleDraft.notes?.trim() || undefined,
      });
      toast.success("Rule saved");
      setRuleDraft(null);
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setRuleBusy(false);
    }
  };

  const removeRule = async (id: string) => {
    if (!confirm("Delete this approval rule?")) return;
    try {
      await deleteRule({ id: id as any });
      toast.success("Rule deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const createCostCenter = useMutation(api.organization.createCostCenter);
  const updateCostCenter = useMutation(api.organization.updateCostCenter);
  const archiveCostCenter = useMutation(api.organization.archiveCostCenter);
  const createBranch = useMutation(api.organization.createBranch);
  const updateBranch = useMutation(api.organization.updateBranch);
  const archiveBranch = useMutation(api.organization.archiveBranch);
  const createDepartment = useMutation(api.organization.createDepartment);
  const updateDepartment = useMutation(api.organization.updateDepartment);
  const archiveDepartment = useMutation(api.organization.archiveDepartment);

  type Section = "cost_center" | "branch" | "department";
  const [editing, setEditing] = useState<{
    section: Section;
    id?: string;
    state: FormState;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const openNew = (section: Section) => setEditing({ section, state: { name: "" } });
  const openEdit = (section: Section, row: any) =>
    setEditing({
      section,
      id: row._id,
      state: { code: row.code, name: row.name, location: row.location, notes: row.notes },
    });

  const sectionFields: Record<Section, FieldDef[]> = {
    cost_center: [
      { name: "code", label: "Code", placeholder: "CC-001" },
      { name: "name", label: "Name", placeholder: "Operations" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    branch: [
      { name: "name", label: "Name", placeholder: "Riyadh HQ" },
      { name: "location", label: "Location", placeholder: "Riyadh, KSA" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    department: [
      { name: "name", label: "Name", placeholder: "Procurement" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  };

  const handleSave = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const { section, id, state } = editing;
      if (section === "cost_center") {
        if (!state.code?.trim() || !state.name.trim()) throw new Error("Code and name required");
        if (id) await updateCostCenter({ id: id as any, code: state.code, name: state.name, notes: state.notes });
        else await createCostCenter({ code: state.code, name: state.name, notes: state.notes });
      } else if (section === "branch") {
        if (!state.name.trim()) throw new Error("Name required");
        if (id) await updateBranch({ id: id as any, name: state.name, location: state.location, notes: state.notes });
        else await createBranch({ name: state.name, location: state.location, notes: state.notes });
      } else {
        if (!state.name.trim()) throw new Error("Name required");
        if (id) await updateDepartment({ id: id as any, name: state.name, notes: state.notes });
        else await createDepartment({ name: state.name, notes: state.notes });
      }
      toast.success("Saved");
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async (section: Section, id: string) => {
    if (!confirm("Archive this entry? It can no longer be selected on new RFQs.")) return;
    try {
      if (section === "cost_center") await archiveCostCenter({ id: id as any });
      else if (section === "branch") await archiveBranch({ id: id as any });
      else await archiveDepartment({ id: id as any });
      toast.success("Archived");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Organization</h1>
          <p className="text-muted-foreground mt-1">
            Set up cost centers, branches, and departments to tag RFQs and orders.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cost centers</CardTitle>
                <CardDescription>Track spend by code (e.g. project, GL account).</CardDescription>
              </div>
              <Button size="sm" onClick={() => openNew("cost_center")}>
                <Plus className="w-4 h-4 mr-2" /> New cost center
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {costCenters.length === 0 ? <SectionEmpty label="No cost centers yet." /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costCenters.map((cc: any) => (
                    <TableRow key={cc._id}>
                      <TableCell className="font-mono text-sm">{cc.code}</TableCell>
                      <TableCell className="font-medium">{cc.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cc.notes ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit("cost_center", cc)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleArchive("cost_center", cc._id)}>
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Branches</CardTitle>
                <CardDescription>Physical locations and delivery sites.</CardDescription>
              </div>
              <Button size="sm" onClick={() => openNew("branch")}>
                <Plus className="w-4 h-4 mr-2" /> New branch
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {branches.length === 0 ? <SectionEmpty label="No branches yet." /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((b: any) => (
                    <TableRow key={b._id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-sm">{b.location ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.notes ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit("branch", b)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleArchive("branch", b._id)}>
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Departments</CardTitle>
                <CardDescription>Functional teams (HR, IT, Operations, …).</CardDescription>
              </div>
              <Button size="sm" onClick={() => openNew("department")}>
                <Plus className="w-4 h-4 mr-2" /> New department
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {departments.length === 0 ? <SectionEmpty label="No departments yet." /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((d: any) => (
                    <TableRow key={d._id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.notes ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit("department", d)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleArchive("department", d._id)}>
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Approval rules</CardTitle>
                <CardDescription>
                  Quote acceptances are held for MWRD approval when they match a rule. First match wins.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setRuleDraft(emptyRule())}>
                <Plus className="w-4 h-4 mr-2" /> New rule
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {rules.length === 0 ? <SectionEmpty label="No approval rules yet — every quote auto-creates an order on accept." /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Filters</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule: any) => (
                    <TableRow key={rule._id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell className="text-sm">
                        ≥ {formatSAR(rule.min_amount)}
                        {rule.max_amount != null ? ` · ≤ ${formatSAR(rule.max_amount)}` : ""}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground space-x-1">
                        {rule.category && <Badge variant="outline">cat: {rule.category}</Badge>}
                        {rule.cost_center_id && (
                          <Badge variant="outline">cc: {costCenters.find((c: any) => c._id === rule.cost_center_id)?.code ?? "?"}</Badge>
                        )}
                        {rule.branch_id && (
                          <Badge variant="outline">br: {branches.find((b: any) => b._id === rule.branch_id)?.name ?? "?"}</Badge>
                        )}
                        {rule.department_id && (
                          <Badge variant="outline">dept: {departments.find((d: any) => d._id === rule.department_id)?.name ?? "?"}</Badge>
                        )}
                        {!rule.category && !rule.cost_center_id && !rule.branch_id && !rule.department_id && (
                          <span>Any</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={rule.enabled ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                          {rule.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setRuleDraft({
                              id: rule._id,
                              name: rule.name,
                              min_amount: String(rule.min_amount),
                              max_amount: rule.max_amount != null ? String(rule.max_amount) : "",
                              category: rule.category ?? undefined,
                              cost_center_id: rule.cost_center_id ?? undefined,
                              branch_id: rule.branch_id ?? undefined,
                              department_id: rule.department_id ?? undefined,
                              enabled: rule.enabled,
                              notes: rule.notes ?? undefined,
                            })
                          }
                        >
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeRule(rule._id)}>
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

      <Dialog open={ruleDraft !== null} onOpenChange={(o) => !o && setRuleDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{ruleDraft?.id ? "Edit rule" : "New approval rule"}</DialogTitle>
          </DialogHeader>
          {ruleDraft && (
            <div className="space-y-3 py-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={ruleDraft.name}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, name: e.target.value })}
                  placeholder="High-value purchase, IT equipment, Branch HQ…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Min amount (SAR)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ruleDraft.min_amount}
                    onChange={(e) => setRuleDraft({ ...ruleDraft, min_amount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Max amount (optional)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ruleDraft.max_amount}
                    onChange={(e) => setRuleDraft({ ...ruleDraft, max_amount: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Category (optional)</Label>
                <Input
                  value={ruleDraft.category ?? ""}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, category: e.target.value })}
                  placeholder="Match RFQ category exactly"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Cost center</Label>
                  <Select
                    value={ruleDraft.cost_center_id ?? "__any"}
                    onValueChange={(v) => setRuleDraft({ ...ruleDraft, cost_center_id: v === "__any" ? undefined : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">Any</SelectItem>
                      {costCenters.map((cc: any) => (
                        <SelectItem key={cc._id} value={cc._id}>{cc.code} — {cc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Branch</Label>
                  <Select
                    value={ruleDraft.branch_id ?? "__any"}
                    onValueChange={(v) => setRuleDraft({ ...ruleDraft, branch_id: v === "__any" ? undefined : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">Any</SelectItem>
                      {branches.map((b: any) => (
                        <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Department</Label>
                  <Select
                    value={ruleDraft.department_id ?? "__any"}
                    onValueChange={(v) => setRuleDraft({ ...ruleDraft, department_id: v === "__any" ? undefined : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">Any</SelectItem>
                      {departments.map((d: any) => (
                        <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Enabled</p>
                  <p className="text-xs text-muted-foreground">Disabled rules don't gate quote acceptance.</p>
                </div>
                <Switch
                  checked={ruleDraft.enabled}
                  onCheckedChange={(v) => setRuleDraft({ ...ruleDraft, enabled: v })}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={ruleDraft.notes ?? ""}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDraft(null)}>Cancel</Button>
            <Button onClick={saveRule} disabled={ruleBusy}>Save rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Edit" : "New"}{" "}
              {editing?.section === "cost_center" ? "cost center" : editing?.section === "branch" ? "branch" : "department"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {editing && sectionFields[editing.section].map((f) => (
              <div key={String(f.name)}>
                <Label>{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    value={(editing.state[f.name] ?? "") as string}
                    onChange={(e) => setEditing({ ...editing, state: { ...editing.state, [f.name]: e.target.value } })}
                    placeholder={f.placeholder}
                  />
                ) : (
                  <Input
                    value={(editing.state[f.name] ?? "") as string}
                    onChange={(e) => setEditing({ ...editing, state: { ...editing.state, [f.name]: e.target.value } })}
                    placeholder={f.placeholder}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientOrganization;

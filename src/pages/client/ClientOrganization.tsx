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
import { useLanguage } from "@/contexts/LanguageContext";

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

type StepDraft = {
  label: string;
  parallel_group: number;
  approver_admin_id?: string;
};

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
  auto_approve_threshold: string;
  escalation_hours: string;
  steps: StepDraft[];
};

const emptyRule = (): RuleDraft => ({
  name: "",
  min_amount: "",
  max_amount: "",
  enabled: true,
  auto_approve_threshold: "",
  escalation_hours: "",
  steps: [],
});

const ClientOrganization = () => {
  const { tr } = useLanguage();
  const costCenters = useQuery(api.organization.listMyCostCenters) ?? [];
  const branches = useQuery(api.organization.listMyBranches) ?? [];
  const departments = useQuery(api.organization.listMyDepartments) ?? [];
  const rules = useQuery(api.approvals.listMyRules) ?? [];
  const upsertRule = useMutation(api.approvals.upsertRule);
  const deleteRule = useMutation(api.approvals.deleteRule);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [ruleBusy, setRuleBusy] = useState(false);
  const ruleStepsForEdit = useQuery(
    api.approvals.listStepsForRule,
    ruleDraft?.id ? { rule_id: ruleDraft.id as any } : "skip",
  );
  // When the dialog opens for an existing rule, fetched steps land via this
  // effect — we hydrate the draft once.
  const [stepsHydratedForId, setStepsHydratedForId] = useState<string | null>(null);
  if (ruleDraft?.id && ruleStepsForEdit && stepsHydratedForId !== ruleDraft.id) {
    setStepsHydratedForId(ruleDraft.id);
    setRuleDraft({
      ...ruleDraft,
      steps: (ruleStepsForEdit as any[]).map((s) => ({
        label: s.label,
        parallel_group: s.parallel_group,
        approver_admin_id: s.approver_admin_id ?? undefined,
      })),
    });
  }

  const saveRule = async () => {
    if (!ruleDraft) return;
    if (!ruleDraft.name.trim()) {
      toast.error(tr("Name required"));
      return;
    }
    const min = Number(ruleDraft.min_amount);
    if (!Number.isFinite(min) || min < 0) {
      toast.error(tr("Minimum amount required"));
      return;
    }
    const maxRaw = ruleDraft.max_amount.trim();
    let max: number | undefined;
    if (maxRaw) {
      max = Number(maxRaw);
      if (!Number.isFinite(max) || max < min) {
        toast.error(tr("Maximum must be ≥ minimum"));
        return;
      }
    }
    let autoApprove: number | undefined;
    if (ruleDraft.auto_approve_threshold.trim()) {
      autoApprove = Number(ruleDraft.auto_approve_threshold);
      if (!Number.isFinite(autoApprove) || autoApprove < 0) {
        toast.error(tr("Auto-approve threshold must be non-negative"));
        return;
      }
    }
    let escalation: number | undefined;
    if (ruleDraft.escalation_hours.trim()) {
      escalation = Number(ruleDraft.escalation_hours);
      if (!Number.isFinite(escalation) || escalation <= 0) {
        toast.error(tr("Escalation hours must be positive"));
        return;
      }
    }
    for (const s of ruleDraft.steps) {
      if (!s.label.trim()) {
        toast.error(tr("Each step needs a label"));
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
        auto_approve_threshold: autoApprove,
        escalation_hours: escalation,
        steps: ruleDraft.steps.map((s) => ({
          label: s.label.trim(),
          parallel_group: s.parallel_group,
          approver_admin_id: s.approver_admin_id ? (s.approver_admin_id as any) : undefined,
        })),
      });
      toast.success(tr("Rule saved"));
      setRuleDraft(null);
      setStepsHydratedForId(null);
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setRuleBusy(false);
    }
  };

  const removeRule = async (id: string) => {
    if (!confirm(tr("Delete this approval rule?"))) return;
    try {
      await deleteRule({ id: id as any });
      toast.success(tr("Rule deleted"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
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
        if (!state.code?.trim() || !state.name.trim()) throw new Error(tr("Code and name required"));
        if (id) await updateCostCenter({ id: id as any, code: state.code, name: state.name, notes: state.notes });
        else await createCostCenter({ code: state.code, name: state.name, notes: state.notes });
      } else if (section === "branch") {
        if (!state.name.trim()) throw new Error(tr("Name required"));
        if (id) await updateBranch({ id: id as any, name: state.name, location: state.location, notes: state.notes });
        else await createBranch({ name: state.name, location: state.location, notes: state.notes });
      } else {
        if (!state.name.trim()) throw new Error(tr("Name required"));
        if (id) await updateDepartment({ id: id as any, name: state.name, notes: state.notes });
        else await createDepartment({ name: state.name, notes: state.notes });
      }
      toast.success(tr("Saved"));
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async (section: Section, id: string) => {
    if (!confirm(tr("Archive this entry? It can no longer be selected on new RFQs."))) return;
    try {
      if (section === "cost_center") await archiveCostCenter({ id: id as any });
      else if (section === "branch") await archiveBranch({ id: id as any });
      else await archiveDepartment({ id: id as any });
      toast.success(tr("Archived"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    }
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("Organization")}</h1>
          <p className="text-muted-foreground mt-1">
            {tr("Set up cost centers, branches, and departments to tag RFQs and orders.")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{tr("Cost centers")}</CardTitle>
                <CardDescription>{tr("Track spend by code (e.g. project, GL account).")}</CardDescription>
              </div>
              <Button size="sm" onClick={() => openNew("cost_center")}>
                <Plus className="w-4 h-4 me-2" /> {tr("New cost center")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {costCenters.length === 0 ? <SectionEmpty label={tr("No cost centers yet.")} /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("Code")}</TableHead>
                    <TableHead>{tr("Name")}</TableHead>
                    <TableHead>{tr("Notes")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costCenters.map((cc: any) => (
                    <TableRow key={cc._id}>
                      <TableCell className="font-mono text-sm">{cc.code}</TableCell>
                      <TableCell className="font-medium">{cc.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cc.notes ?? "—"}</TableCell>
                      <TableCell className="text-end">
                        <Button variant="ghost" size="sm" onClick={() => openEdit("cost_center", cc)}>{tr("Edit")}</Button>
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
                <CardTitle>{tr("Branches")}</CardTitle>
                <CardDescription>{tr("Physical locations and delivery sites.")}</CardDescription>
              </div>
              <Button size="sm" onClick={() => openNew("branch")}>
                <Plus className="w-4 h-4 me-2" /> {tr("New branch")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {branches.length === 0 ? <SectionEmpty label={tr("No branches yet.")} /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("Name")}</TableHead>
                    <TableHead>{tr("Location")}</TableHead>
                    <TableHead>{tr("Notes")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((b: any) => (
                    <TableRow key={b._id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-sm">{b.location ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.notes ?? "—"}</TableCell>
                      <TableCell className="text-end">
                        <Button variant="ghost" size="sm" onClick={() => openEdit("branch", b)}>{tr("Edit")}</Button>
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
                <CardTitle>{tr("Departments")}</CardTitle>
                <CardDescription>{tr("Functional teams (HR, IT, Operations, …).")}</CardDescription>
              </div>
              <Button size="sm" onClick={() => openNew("department")}>
                <Plus className="w-4 h-4 me-2" /> {tr("New department")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {departments.length === 0 ? <SectionEmpty label={tr("No departments yet.")} /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("Name")}</TableHead>
                    <TableHead>{tr("Notes")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((d: any) => (
                    <TableRow key={d._id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.notes ?? "—"}</TableCell>
                      <TableCell className="text-end">
                        <Button variant="ghost" size="sm" onClick={() => openEdit("department", d)}>{tr("Edit")}</Button>
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
                <CardTitle>{tr("Approval rules")}</CardTitle>
                <CardDescription>
                  {tr("Quote acceptances are held for MWRD approval when they match a rule. First match wins.")}
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setRuleDraft(emptyRule())}>
                <Plus className="w-4 h-4 me-2" /> {tr("New rule")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {rules.length === 0 ? <SectionEmpty label={tr("No approval rules yet — every quote auto-creates an order on accept.")} /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("Name")}</TableHead>
                    <TableHead>{tr("Threshold")}</TableHead>
                    <TableHead>{tr("Filters")}</TableHead>
                    <TableHead>{tr("Status")}</TableHead>
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
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex flex-wrap gap-1">
                          {rule.category && <Badge variant="outline">{tr("Category")}: {rule.category}</Badge>}
                          {rule.cost_center_id && (
                            <Badge variant="outline">
                              {tr("Cost center")}: {costCenters.find((c: any) => c._id === rule.cost_center_id)?.code ?? "?"}
                            </Badge>
                          )}
                          {rule.branch_id && (
                            <Badge variant="outline">
                              {tr("Branch")}: {branches.find((b: any) => b._id === rule.branch_id)?.name ?? "?"}
                            </Badge>
                          )}
                          {rule.department_id && (
                            <Badge variant="outline">
                              {tr("Department")}: {departments.find((d: any) => d._id === rule.department_id)?.name ?? "?"}
                            </Badge>
                          )}
                          {!rule.category && !rule.cost_center_id && !rule.branch_id && !rule.department_id && (
                            <span>{tr("Any")}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={rule.enabled ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                          {rule.enabled ? tr("Enabled") : tr("Disabled")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setStepsHydratedForId(null);
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
                              auto_approve_threshold:
                                (rule as any).auto_approve_threshold != null
                                  ? String((rule as any).auto_approve_threshold)
                                  : "",
                              escalation_hours:
                                (rule as any).escalation_hours != null
                                  ? String((rule as any).escalation_hours)
                                  : "",
                              steps: [], // hydrated by listStepsForRule
                            });
                          }}
                        >
                          {tr("Edit")}
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
            <DialogTitle>{ruleDraft?.id ? tr("Edit rule") : tr("New approval rule")}</DialogTitle>
          </DialogHeader>
          {ruleDraft && (
            <div className="space-y-3 py-2">
              <div>
                <Label>{tr("Name")}</Label>
                <Input
                  value={ruleDraft.name}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, name: e.target.value })}
                  placeholder={tr("High-value purchase, IT equipment, Branch HQ…")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{tr("Min amount (SAR)")}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ruleDraft.min_amount}
                    onChange={(e) => setRuleDraft({ ...ruleDraft, min_amount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{tr("Max amount (optional)")}</Label>
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
                <Label>{tr("Category (optional)")}</Label>
                <Input
                  value={ruleDraft.category ?? ""}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, category: e.target.value })}
                  placeholder={tr("Match RFQ category exactly")}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{tr("Cost center")}</Label>
                  <Select
                    value={ruleDraft.cost_center_id ?? "__any"}
                    onValueChange={(v) => setRuleDraft({ ...ruleDraft, cost_center_id: v === "__any" ? undefined : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">{tr("Any")}</SelectItem>
                      {costCenters.map((cc: any) => (
                        <SelectItem key={cc._id} value={cc._id}>{cc.code} — {cc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{tr("Branch")}</Label>
                  <Select
                    value={ruleDraft.branch_id ?? "__any"}
                    onValueChange={(v) => setRuleDraft({ ...ruleDraft, branch_id: v === "__any" ? undefined : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">{tr("Any")}</SelectItem>
                      {branches.map((b: any) => (
                        <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{tr("Department")}</Label>
                  <Select
                    value={ruleDraft.department_id ?? "__any"}
                    onValueChange={(v) => setRuleDraft({ ...ruleDraft, department_id: v === "__any" ? undefined : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">{tr("Any")}</SelectItem>
                      {departments.map((d: any) => (
                        <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{tr("Enabled")}</p>
                  <p className="text-xs text-muted-foreground">{tr("Disabled rules don't gate quote acceptance.")}</p>
                </div>
                <Switch
                  checked={ruleDraft.enabled}
                  onCheckedChange={(v) => setRuleDraft({ ...ruleDraft, enabled: v })}
                />
              </div>
              <div>
                <Label>{tr("Notes")}</Label>
                <Textarea
                  value={ruleDraft.notes ?? ""}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, notes: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{tr("Auto-approve under (SAR)")}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ruleDraft.auto_approve_threshold}
                    onChange={(e) =>
                      setRuleDraft({ ...ruleDraft, auto_approve_threshold: e.target.value })
                    }
                    placeholder={tr("Optional — quotes ≤ this skip approval")}
                  />
                </div>
                <div>
                  <Label>{tr("Escalation after (hours)")}</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={ruleDraft.escalation_hours}
                    onChange={(e) =>
                      setRuleDraft({ ...ruleDraft, escalation_hours: e.target.value })
                    }
                    placeholder={tr("Optional — alert if step pending past N hours")}
                  />
                </div>
              </div>

              <div className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{tr("Approval steps")}</p>
                    <p className="text-xs text-muted-foreground">
                      {tr("Steps with the same group number run in parallel; lower groups run first.")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const nextGroup =
                        ruleDraft.steps.length > 0
                          ? Math.max(...ruleDraft.steps.map((s) => s.parallel_group)) + 1
                          : 1;
                      setRuleDraft({
                        ...ruleDraft,
                        steps: [
                          ...ruleDraft.steps,
                          { label: "", parallel_group: nextGroup },
                        ],
                      });
                    }}
                  >
                    {tr("+ Add step")}
                  </Button>
                </div>
                {ruleDraft.steps.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    {tr("No steps — any admin can approve this in one click.")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ruleDraft.steps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          className="flex-1"
                          value={step.label}
                          onChange={(e) => {
                            const next = [...ruleDraft.steps];
                            next[idx] = { ...next[idx], label: e.target.value };
                            setRuleDraft({ ...ruleDraft, steps: next });
                          }}
                          placeholder={tr("Step label, e.g. Finance review")}
                        />
                        <Input
                          className="w-20"
                          type="number"
                          min="1"
                          value={step.parallel_group}
                          onChange={(e) => {
                            const next = [...ruleDraft.steps];
                            next[idx] = {
                              ...next[idx],
                              parallel_group: Math.max(1, Number(e.target.value) || 1),
                            };
                            setRuleDraft({ ...ruleDraft, steps: next });
                          }}
                          title={tr("Group")}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const next = ruleDraft.steps.filter((_, i) => i !== idx);
                            setRuleDraft({ ...ruleDraft, steps: next });
                          }}
                        >
                          <Trash01 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRuleDraft(null);
                setStepsHydratedForId(null);
              }}
            >
              {tr("Cancel")}
            </Button>
            <Button onClick={saveRule} disabled={ruleBusy}>{tr("Save rule")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.section === "cost_center"
                ? editing?.id ? tr("Edit cost center") : tr("New cost center")
                : editing?.section === "branch"
                ? editing?.id ? tr("Edit branch") : tr("New branch")
                : editing?.id ? tr("Edit department") : tr("New department")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {editing && sectionFields[editing.section].map((f) => (
              <div key={String(f.name)}>
                <Label>{tr(f.label)}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    value={(editing.state[f.name] ?? "") as string}
                    onChange={(e) => setEditing({ ...editing, state: { ...editing.state, [f.name]: e.target.value } })}
                    placeholder={f.placeholder ? tr(f.placeholder) : undefined}
                  />
                ) : (
                  <Input
                    value={(editing.state[f.name] ?? "") as string}
                    onChange={(e) => setEditing({ ...editing, state: { ...editing.state, [f.name]: e.target.value } })}
                    placeholder={f.placeholder ? tr(f.placeholder) : undefined}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{tr("Cancel")}</Button>
            <Button onClick={handleSave} disabled={busy}>{tr("Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientOrganization;

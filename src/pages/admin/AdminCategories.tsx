import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronDown, ChevronRight, Plus, Pencil, Archive, Check, X } from "lucide-react";

type TaxClass = "STANDARD" | "ZERO_RATED" | "EXEMPT";

type CategoryNode = {
  _id: Id<"categories">;
  parent_id?: Id<"categories">;
  level: number;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar?: string;
  description_en?: string;
  default_uom?: string;
  tax_class?: TaxClass;
  display_order?: number;
  status: "ACTIVE" | "PROPOSED" | "REJECTED" | "ARCHIVED";
  is_active: boolean;
  children: CategoryNode[];
};

const MAX_LEVEL = 3;

const LEVEL_LABEL_KEYS = [
  "Category",
  "Subcategory",
  "Family",
  "Item-class",
] as const;

type FormState = {
  parent_id?: Id<"categories">;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  default_uom: string;
  tax_class: TaxClass | "";
  display_order: string;
};

const emptyForm: FormState = {
  parent_id: undefined,
  name_ar: "",
  name_en: "",
  description_ar: "",
  description_en: "",
  default_uom: "",
  tax_class: "",
  display_order: "0",
};

const AdminCategories = () => {
  const { tr, lang } = useLanguage();
  const tree = useQuery(api.categories.tree, {}) as CategoryNode[] | undefined;
  const proposals = useQuery(api.categories.listProposals, {}) ?? [];
  const create = useMutation(api.categories.create);
  const update = useMutation(api.categories.update);
  const archive = useMutation(api.categories.archive);
  const approveProposal = useMutation(api.categories.approveProposal);
  const rejectProposal = useMutation(api.categories.rejectProposal);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryNode | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);

  const [rejectId, setRejectId] = useState<Id<"categories"> | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const loading = tree === undefined;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openCreate = (parent?: CategoryNode) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      parent_id: parent?._id,
    });
    setEditorOpen(true);
  };

  const openEdit = (node: CategoryNode) => {
    setEditing(node);
    setForm({
      parent_id: node.parent_id,
      name_ar: node.name_ar,
      name_en: node.name_en,
      description_ar: node.description_ar ?? "",
      description_en: node.description_en ?? "",
      default_uom: node.default_uom ?? "",
      tax_class: node.tax_class ?? "",
      display_order: String(node.display_order ?? 0),
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.name_ar.trim() || !form.name_en.trim()) {
      toast.error(tr("Both Arabic and English names are required"));
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await update({
          id: editing._id,
          name_ar: form.name_ar.trim(),
          name_en: form.name_en.trim(),
          description_ar: form.description_ar.trim() || undefined,
          description_en: form.description_en.trim() || undefined,
          default_uom: form.default_uom.trim() || undefined,
          tax_class: form.tax_class === "" ? undefined : form.tax_class,
          display_order: form.display_order ? Number(form.display_order) : undefined,
        });
        toast.success(tr("Category updated"));
      } else {
        await create({
          parent_id: form.parent_id,
          name_ar: form.name_ar.trim(),
          name_en: form.name_en.trim(),
          description_ar: form.description_ar.trim() || undefined,
          description_en: form.description_en.trim() || undefined,
          default_uom: form.default_uom.trim() || undefined,
          tax_class: form.tax_class === "" ? undefined : form.tax_class,
          display_order: form.display_order ? Number(form.display_order) : undefined,
        });
        toast.success(tr("Category created"));
      }
      setEditorOpen(false);
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async (node: CategoryNode) => {
    if (!confirm(tr("Archive this category and all its children?"))) return;
    try {
      await archive({ id: node._id });
      toast.success(tr("Category archived"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    }
  };

  const handleApprove = async (id: Id<"categories">) => {
    try {
      await approveProposal({ id });
      toast.success(tr("Proposal approved"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    if (!rejectNote.trim()) {
      toast.error(tr("A reason is required to reject a proposal"));
      return;
    }
    try {
      await rejectProposal({ id: rejectId, decision_note: rejectNote.trim() });
      toast.success(tr("Proposal rejected"));
      setRejectId(null);
      setRejectNote("");
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    }
  };

  const renderName = (node: CategoryNode) =>
    lang === "ar" ? node.name_ar : node.name_en;

  const renderNode = (node: CategoryNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node._id);
    const canAddChild = node.level < MAX_LEVEL;
    return (
      <div key={node._id}>
        <div
          className="group flex items-center gap-2 rounded-md py-1.5 hover:bg-muted/50"
          style={{ paddingInlineStart: `${depth * 20 + 8}px` }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggle(node._id)}
            className="flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={hasChildren ? (isExpanded ? tr("Collapse") : tr("Expand")) : undefined}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            ) : (
              <span className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            )}
          </button>
          <span className="flex-1 truncate text-sm font-medium">
            {renderName(node)}
            <span className="ms-2 text-xs text-muted-foreground">
              {lang === "ar" ? node.name_en : node.name_ar}
            </span>
          </span>
          <Badge variant="outline" className="text-xs">
            {tr(LEVEL_LABEL_KEYS[node.level] ?? "Category")}
          </Badge>
          {node.default_uom && (
            <Badge variant="secondary" className="text-xs">{node.default_uom}</Badge>
          )}
          {node.tax_class && node.tax_class !== "STANDARD" && (
            <Badge variant="outline" className="text-xs">
              {tr(node.tax_class === "ZERO_RATED" ? "Zero-rated" : "Exempt")}
            </Badge>
          )}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {canAddChild && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openCreate(node)}
                title={tr("Add subcategory")}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(node)}
              title={tr("Edit")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleArchive(node)}
              title={tr("Archive")}
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  // Resolve flat list of possible parents (active categories with level < MAX_LEVEL)
  const parentOptions = useMemo(() => {
    const out: { id: Id<"categories">; label: string; level: number }[] = [];
    const walk = (nodes: CategoryNode[], prefix: string[]) => {
      for (const n of nodes) {
        const path = [...prefix, lang === "ar" ? n.name_ar : n.name_en];
        if (n.level < MAX_LEVEL) {
          out.push({ id: n._id, label: path.join(" / "), level: n.level });
        }
        walk(n.children, path);
      }
    };
    walk(tree ?? [], []);
    return out;
  }, [tree, lang]);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">{tr("Master Category Tree")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("Bilingual taxonomy used across catalog, RFQs, and margin rules.")}
          </p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="me-1.5 h-4 w-4" /> {tr("New top-level category")}
        </Button>
      </div>

      <Tabs defaultValue="tree" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tree">{tr("Tree")}</TabsTrigger>
          <TabsTrigger value="proposals">
            {tr("Proposals")}
            {proposals.length > 0 && (
              <Badge variant="secondary" className="ms-2">{proposals.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tree">
          <Card>
            <CardContent className="p-3">
              {loading ? (
                <p className="p-4 text-sm text-muted-foreground">{tr("Loading…")}</p>
              ) : (tree ?? []).length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {tr("No categories yet. Start by creating a top-level category.")}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {(tree ?? []).map((node) => renderNode(node))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proposals">
          <Card>
            <CardContent className="p-3">
              {proposals.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {tr("No category proposals waiting for review.")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {proposals.map((p: any) => (
                    <div key={p._id} className="rounded-md border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {lang === "ar" ? p.name_ar : p.name_en}
                            <span className="ms-2 text-sm text-muted-foreground">
                              {lang === "ar" ? p.name_en : p.name_ar}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {tr("Proposed by")}: {p.proposer_company_name || p.proposer_public_id || "—"}
                          </p>
                          {p.proposed_justification && (
                            <p className="mt-2 rounded bg-muted/40 p-2 text-sm">
                              {p.proposed_justification}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <Button size="sm" onClick={() => handleApprove(p._id)}>
                            <Check className="me-1 h-3.5 w-3.5" /> {tr("Approve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectId(p._id);
                              setRejectNote("");
                            }}
                          >
                            <X className="me-1 h-3.5 w-3.5" /> {tr("Reject")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? tr("Edit category") : tr("New category")}
            </DialogTitle>
            <DialogDescription>
              {form.parent_id
                ? tr("Adding a child under the selected parent.")
                : tr("Top-level categories live at the root of the tree.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!editing && (
              <div className="space-y-1.5">
                <Label>{tr("Parent")}</Label>
                <Select
                  value={form.parent_id ?? "ROOT"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      parent_id: v === "ROOT" ? undefined : (v as Id<"categories">),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ROOT">{tr("(Top-level — no parent)")}</SelectItem>
                    {parentOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("Name (Arabic)")} *</Label>
                <Input
                  dir="rtl"
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Name (English)")} *</Label>
                <Input
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("Description (Arabic)")}</Label>
                <Textarea
                  dir="rtl"
                  rows={2}
                  value={form.description_ar}
                  onChange={(e) => setForm((f) => ({ ...f, description_ar: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Description (English)")}</Label>
                <Textarea
                  rows={2}
                  value={form.description_en}
                  onChange={(e) => setForm((f) => ({ ...f, description_en: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("Default UoM")}</Label>
                <Input
                  placeholder={tr("e.g. PCS, KG, BOX")}
                  value={form.default_uom}
                  onChange={(e) => setForm((f) => ({ ...f, default_uom: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Tax class")}</Label>
                <Select
                  value={form.tax_class === "" ? "NONE" : form.tax_class}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      tax_class: v === "NONE" ? "" : (v as TaxClass),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{tr("(Inherit)")}</SelectItem>
                    <SelectItem value="STANDARD">{tr("Standard 15%")}</SelectItem>
                    <SelectItem value="ZERO_RATED">{tr("Zero-rated")}</SelectItem>
                    <SelectItem value="EXEMPT">{tr("Exempt")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Display order")}</Label>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>{tr("Cancel")}</Button>
            <Button onClick={handleSave} disabled={busy}>
              {editing ? tr("Save changes") : tr("Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject proposal dialog */}
      <Dialog open={rejectId !== null} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Reject proposal")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{tr("Reason")}</Label>
            <Textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder={tr("Tell the supplier why this category is being rejected…")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>{tr("Cancel")}</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectNote.trim()}>
              {tr("Reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCategories;

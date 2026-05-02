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
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { useCategoryNames } from "@/components/categories/useCategoryNames";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Plus, Pencil, Archive, RotateCcw, Trash2 } from "lucide-react";

type PackType = {
  code: string;
  label_en: string;
  label_ar: string;
  base_qty: number;
  uom?: string;
};

type MasterProduct = {
  _id: Id<"master_products">;
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  category_id: Id<"categories">;
  sku?: string;
  brand?: string;
  images: string[];
  pack_types: PackType[];
  status: "DRAFT" | "ACTIVE" | "DEPRECATED";
  display_order?: number;
};

type FormState = {
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  category_id?: Id<"categories">;
  sku: string;
  brand: string;
  images: string[];
  pack_types: PackType[];
  status: "DRAFT" | "ACTIVE";
};

const emptyPack: PackType = {
  code: "EACH",
  label_en: "Each",
  label_ar: "حبة",
  base_qty: 1,
  uom: "PCS",
};

const emptyForm: FormState = {
  name_en: "",
  name_ar: "",
  description_en: "",
  description_ar: "",
  category_id: undefined,
  sku: "",
  brand: "",
  images: [],
  pack_types: [{ ...emptyPack }],
  status: "DRAFT",
};

const AdminMasterCatalog = () => {
  const { tr, lang } = useLanguage();
  const { localize } = useCategoryNames();

  const [tab, setTab] = useState<"ACTIVE" | "DRAFT" | "DEPRECATED">("ACTIVE");
  const data = useQuery(api.masterProducts.listAll, { status: tab }) as
    | MasterProduct[]
    | undefined;

  const create = useMutation(api.masterProducts.create);
  const update = useMutation(api.masterProducts.update);
  const deprecate = useMutation(api.masterProducts.deprecate);
  const reactivate = useMutation(api.masterProducts.reactivate);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"master_products"> | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [imageDraft, setImageDraft] = useState("");

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (m: MasterProduct) => {
    setEditingId(m._id);
    setForm({
      name_en: m.name_en,
      name_ar: m.name_ar,
      description_en: m.description_en ?? "",
      description_ar: m.description_ar ?? "",
      category_id: m.category_id,
      sku: m.sku ?? "",
      brand: m.brand ?? "",
      images: m.images,
      pack_types: m.pack_types.map((p) => ({ ...p })),
      status: m.status === "DEPRECATED" ? "DRAFT" : m.status,
    });
    setOpen(true);
  };

  const setPack = (idx: number, patch: Partial<PackType>) => {
    setForm((f) => ({
      ...f,
      pack_types: f.pack_types.map((p, i) =>
        i === idx ? { ...p, ...patch } : p,
      ),
    }));
  };

  const addPack = () => {
    setForm((f) => ({
      ...f,
      pack_types: [
        ...f.pack_types,
        { code: "", label_en: "", label_ar: "", base_qty: 1, uom: "" },
      ],
    }));
  };

  const removePack = (idx: number) => {
    setForm((f) => ({
      ...f,
      pack_types: f.pack_types.filter((_, i) => i !== idx),
    }));
  };

  const validate = (): string | null => {
    if (!form.name_en.trim() || !form.name_ar.trim()) {
      return tr("Name (English & Arabic) is required");
    }
    if (!form.category_id) return tr("Category is required");
    if (form.pack_types.length === 0) return tr("At least one pack type is required");
    const codes = new Set<string>();
    for (const p of form.pack_types) {
      if (!p.code.trim()) return tr("Pack type code cannot be empty");
      if (codes.has(p.code)) return tr("Duplicate pack type code: ") + p.code;
      if (!p.label_en.trim() || !p.label_ar.trim()) {
        return tr("Pack labels (EN & AR) are required");
      }
      if (!(p.base_qty > 0)) return tr("Pack base_qty must be > 0");
      codes.add(p.code);
    }
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name_en: form.name_en.trim(),
        name_ar: form.name_ar.trim(),
        description_en: form.description_en.trim() || undefined,
        description_ar: form.description_ar.trim() || undefined,
        category_id: form.category_id!,
        sku: form.sku.trim() || undefined,
        brand: form.brand.trim() || undefined,
        images: form.images,
        pack_types: form.pack_types.map((p) => ({
          code: p.code.trim(),
          label_en: p.label_en.trim(),
          label_ar: p.label_ar.trim(),
          base_qty: Number(p.base_qty),
          uom: p.uom?.trim() || undefined,
        })),
      };
      if (editingId) {
        await update({ id: editingId, ...payload, status: form.status });
        toast.success(tr("Master product updated"));
      } else {
        await create({ ...payload, status: form.status });
        toast.success(tr("Master product created"));
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeprecate = async (id: Id<"master_products">) => {
    const reason = window.prompt(tr("Reason for deprecation (optional)") ?? "") ?? undefined;
    try {
      await deprecate({ id, reason });
      toast.success(tr("Deprecated"));
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    }
  };

  const handleReactivate = async (id: Id<"master_products">) => {
    try {
      await reactivate({ id });
      toast.success(tr("Reactivated"));
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    }
  };

  const rows = useMemo(() => data ?? [], [data]);
  const loading = data === undefined;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="font-display text-3xl font-bold text-foreground">
          {tr("Master Catalog")}
        </h1>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 me-1.5" />
          {tr("New master product")}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="ACTIVE">{tr("Active")}</TabsTrigger>
          <TabsTrigger value="DRAFT">{tr("Draft")}</TabsTrigger>
          <TabsTrigger value="DEPRECATED">{tr("Deprecated")}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {tr("No master products in this state.")}
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((m) => (
                <Card key={m._id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                      {m.images[0] && (
                        <img
                          src={m.images[0]}
                          alt=""
                          className="w-20 h-20 rounded-lg object-cover border border-border flex-shrink-0"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-lg font-bold text-foreground">
                              {lang === "ar" ? m.name_ar : m.name_en}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {lang === "ar" ? m.name_en : m.name_ar}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {localize(m.category_id)}
                              {m.brand ? ` · ${m.brand}` : ""}
                              {m.sku ? ` · SKU ${m.sku}` : ""}
                            </p>
                          </div>
                          <Badge
                            variant={m.status === "ACTIVE" ? "default" : "outline"}
                          >
                            {m.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {m.pack_types.map((p) => (
                            <Badge key={p.code} variant="secondary" className="font-mono text-xs">
                              {p.code} · {p.base_qty}
                              {p.uom ? ` ${p.uom}` : ""}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex md:flex-col gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                          <Pencil className="w-4 h-4 me-1" />
                          {tr("Edit")}
                        </Button>
                        {m.status === "DEPRECATED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReactivate(m._id)}
                          >
                            <RotateCcw className="w-4 h-4 me-1" />
                            {tr("Reactivate")}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeprecate(m._id)}
                          >
                            <Archive className="w-4 h-4 me-1" />
                            {tr("Deprecate")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? tr("Edit master product") : tr("New master product")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("Name (English)")} *</Label>
                <Input
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Name (Arabic)")} *</Label>
                <Input
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                  dir="rtl"
                />
              </div>
            </div>

            <CategoryPicker
              categoryId={form.category_id}
              onChange={(next) =>
                setForm((f) => ({
                  ...f,
                  category_id: next.subcategory_id ?? next.category_id,
                }))
              }
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("SKU")}</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Brand")}</Label>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("Description (English)")}</Label>
                <Textarea
                  rows={3}
                  value={form.description_en}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description_en: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Description (Arabic)")}</Label>
                <Textarea
                  rows={3}
                  dir="rtl"
                  value={form.description_ar}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description_ar: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tr("Images (URLs)")}</Label>
              <div className="flex flex-wrap gap-2">
                {form.images.map((url, i) => (
                  <div key={i} className="relative">
                    <img
                      src={url}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover border border-border"
                    />
                    <button
                      type="button"
                      className="absolute -top-1.5 -end-1.5 bg-background border border-border rounded-full p-0.5"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          images: f.images.filter((_, idx) => idx !== i),
                        }))
                      }
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="https://..."
                  value={imageDraft}
                  onChange={(e) => setImageDraft(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const url = imageDraft.trim();
                    if (!url) return;
                    setForm((f) => ({ ...f, images: [...f.images, url] }));
                    setImageDraft("");
                  }}
                >
                  {tr("Add")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{tr("Pack types")} *</Label>
                <Button type="button" size="sm" variant="outline" onClick={addPack}>
                  <Plus className="w-3.5 h-3.5 me-1" />
                  {tr("Add pack")}
                </Button>
              </div>
              <div className="space-y-2">
                {form.pack_types.map((p, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-end border border-border rounded-md p-2.5"
                  >
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">{tr("Code")}</Label>
                      <Input
                        value={p.code}
                        onChange={(e) => setPack(idx, { code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">{tr("Label EN")}</Label>
                      <Input
                        value={p.label_en}
                        onChange={(e) => setPack(idx, { label_en: e.target.value })}
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">{tr("Label AR")}</Label>
                      <Input
                        dir="rtl"
                        value={p.label_ar}
                        onChange={(e) => setPack(idx, { label_ar: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs">{tr("Qty")}</Label>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={p.base_qty}
                        onChange={(e) =>
                          setPack(idx, { base_qty: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs">{tr("UoM")}</Label>
                      <Input
                        value={p.uom ?? ""}
                        onChange={(e) => setPack(idx, { uom: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removePack(idx)}
                        disabled={form.pack_types.length === 1}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{tr("Status")}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={form.status === "DRAFT" ? "default" : "outline"}
                  onClick={() => setForm((f) => ({ ...f, status: "DRAFT" }))}
                >
                  {tr("Draft")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={form.status === "ACTIVE" ? "default" : "outline"}
                  onClick={() => setForm((f) => ({ ...f, status: "ACTIVE" }))}
                >
                  {tr("Active (publish)")}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {tr("Cancel")}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : null}
              {editingId ? tr("Save") : tr("Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminMasterCatalog;

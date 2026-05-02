import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { useCategoryNames } from "@/components/categories/useCategoryNames";
import { ImageListUpload } from "@/components/shared/ImageListUpload";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Plus, Pencil, Archive, Trash2 } from "lucide-react";

type BundleItemDraft = {
  key: string;
  master_product_id: Id<"master_products"> | null;
  pack_type_code: string;
  quantity: number;
  notes: string;
};

const emptyItem = (): BundleItemDraft => ({
  key: crypto.randomUUID(),
  master_product_id: null,
  pack_type_code: "",
  quantity: 1,
  notes: "",
});

const AdminBundles = () => {
  const { tr, lang } = useLanguage();
  const { localize } = useCategoryNames();

  const [tab, setTab] = useState<"ACTIVE" | "DRAFT" | "ARCHIVED">("ACTIVE");
  const data = useQuery(api.bundles.listAll, { status: tab });
  const masterProducts = useQuery(api.masterProducts.listAll, { status: "ACTIVE" }) as
    | any[]
    | undefined;

  const create = useMutation(api.bundles.create);
  const update = useMutation(api.bundles.update);
  const archive = useMutation(api.bundles.archive);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"bundles"> | null>(null);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [descAr, setDescAr] = useState("");
  const [categoryId, setCategoryId] = useState<Id<"categories"> | undefined>();
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">("DRAFT");
  const [items, setItems] = useState<BundleItemDraft[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const masterById = useMemo(() => {
    const m = new Map<string, any>();
    for (const mp of masterProducts ?? []) m.set(mp._id, mp);
    return m;
  }, [masterProducts]);

  const reset = () => {
    setEditingId(null);
    setNameEn("");
    setNameAr("");
    setDescEn("");
    setDescAr("");
    setCategoryId(undefined);
    setImageUrl("");
    setStatus("DRAFT");
    setItems([emptyItem()]);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (b: any) => {
    setEditingId(b._id);
    setNameEn(b.name_en);
    setNameAr(b.name_ar);
    setDescEn(b.description_en ?? "");
    setDescAr(b.description_ar ?? "");
    setCategoryId(b.category_id);
    setImageUrl(b.image_url ?? "");
    setStatus(b.status === "ARCHIVED" ? "DRAFT" : b.status);
    setItems(
      b.items.map((it: any) => ({
        key: crypto.randomUUID(),
        master_product_id: it.master_product_id,
        pack_type_code: it.pack_type_code,
        quantity: it.quantity,
        notes: it.notes ?? "",
      })),
    );
    setOpen(true);
  };

  const setItem = (key: string, patch: Partial<BundleItemDraft>) =>
    setItems((arr) => arr.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const addItem = () => setItems((arr) => [...arr, emptyItem()]);
  const removeItem = (key: string) =>
    setItems((arr) => arr.filter((i) => i.key !== key));

  const submit = async () => {
    if (!nameEn.trim() || !nameAr.trim()) {
      toast.error(tr("Name (English & Arabic) required"));
      return;
    }
    if (items.length === 0) {
      toast.error(tr("Add at least one item"));
      return;
    }
    for (const item of items) {
      if (!item.master_product_id) {
        toast.error(tr("Each item must reference a master product"));
        return;
      }
      if (!item.pack_type_code) {
        toast.error(tr("Each item must select a pack type"));
        return;
      }
      if (!(item.quantity > 0)) {
        toast.error(tr("Quantity must be > 0"));
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        name_en: nameEn.trim(),
        name_ar: nameAr.trim(),
        description_en: descEn.trim() || undefined,
        description_ar: descAr.trim() || undefined,
        category_id: categoryId,
        image_url: imageUrl.trim() || undefined,
        status,
        items: items.map((i) => ({
          master_product_id: i.master_product_id!,
          pack_type_code: i.pack_type_code,
          quantity: i.quantity,
          notes: i.notes.trim() || undefined,
        })),
      };
      if (editingId) {
        await update({ id: editingId, ...payload });
        toast.success(tr("Bundle updated"));
      } else {
        await create(payload);
        toast.success(tr("Bundle created"));
      }
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: Id<"bundles">) => {
    if (!confirm(tr("Archive this bundle?"))) return;
    try {
      await archive({ id });
      toast.success(tr("Archived"));
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    }
  };

  const rows = data ?? [];
  const loading = data === undefined;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="font-display text-3xl font-bold text-foreground">
          {tr("Bundles")}
        </h1>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 me-1.5" />
          {tr("New bundle")}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="ACTIVE">{tr("Active")}</TabsTrigger>
          <TabsTrigger value="DRAFT">{tr("Draft")}</TabsTrigger>
          <TabsTrigger value="ARCHIVED">{tr("Archived")}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {tr("No bundles in this state.")}
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((b: any) => (
                <Card key={b._id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                      {b.image_url && (
                        <img
                          src={b.image_url}
                          alt=""
                          className="w-20 h-20 rounded-lg object-cover border border-border flex-shrink-0"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-lg font-bold text-foreground">
                              {lang === "ar" ? b.name_ar : b.name_en}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {lang === "ar" ? b.name_en : b.name_ar}
                            </p>
                            {b.category_id && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {localize(b.category_id)}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={b.status === "ACTIVE" ? "default" : "outline"}
                          >
                            {b.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <Badge variant="secondary">
                            {tr("{n} items", { n: b.items.length })}
                          </Badge>
                          {b.items.slice(0, 4).map((it: any) => (
                            <Badge
                              key={it._id}
                              variant="outline"
                              className="text-[10px]"
                            >
                              {it.master?.name_en ?? "—"} × {it.quantity}
                            </Badge>
                          ))}
                          {b.items.length > 4 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{b.items.length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex md:flex-col gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => openEdit(b)}>
                          <Pencil className="w-4 h-4 me-1" />
                          {tr("Edit")}
                        </Button>
                        {b.status !== "ARCHIVED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleArchive(b._id)}
                          >
                            <Archive className="w-4 h-4 me-1" />
                            {tr("Archive")}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? tr("Edit bundle") : tr("New bundle")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("Name (English)")} *</Label>
                <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Name (Arabic)")} *</Label>
                <Input
                  dir="rtl"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                />
              </div>
            </div>

            <CategoryPicker
              categoryId={categoryId}
              onChange={(next) =>
                setCategoryId(next.subcategory_id ?? next.category_id)
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("Description (English)")}</Label>
                <Textarea
                  rows={2}
                  value={descEn}
                  onChange={(e) => setDescEn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Description (Arabic)")}</Label>
                <Textarea
                  rows={2}
                  dir="rtl"
                  value={descAr}
                  onChange={(e) => setDescAr(e.target.value)}
                />
              </div>
            </div>

            <ImageListUpload
              label={tr("Image")}
              images={imageUrl ? [imageUrl] : []}
              onChange={(next) => setImageUrl(next[0] ?? "")}
              max={1}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{tr("Items")} *</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="w-3.5 h-3.5 me-1" />
                  {tr("Add item")}
                </Button>
              </div>
              {items.map((item) => {
                const master = item.master_product_id
                  ? masterById.get(item.master_product_id)
                  : null;
                return (
                  <div
                    key={item.key}
                    className="grid grid-cols-12 gap-2 items-end border border-border rounded-md p-2.5"
                  >
                    <div className="col-span-5 space-y-1">
                      <Label className="text-xs">{tr("Master product")}</Label>
                      <Select
                        value={item.master_product_id ?? ""}
                        onValueChange={(v) => {
                          const m = masterById.get(v);
                          setItem(item.key, {
                            master_product_id: v as Id<"master_products">,
                            pack_type_code: m?.pack_types?.[0]?.code ?? "",
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={tr("Select…")} />
                        </SelectTrigger>
                        <SelectContent>
                          {(masterProducts ?? []).map((m: any) => (
                            <SelectItem key={m._id} value={m._id}>
                              {m.name_en}
                              {m.brand ? ` · ${m.brand}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">{tr("Pack")}</Label>
                      <Select
                        value={item.pack_type_code}
                        onValueChange={(v) =>
                          setItem(item.key, { pack_type_code: v })
                        }
                        disabled={!master}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(master?.pack_types ?? []).map((p: any) => (
                            <SelectItem key={p.code} value={p.code}>
                              {p.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">{tr("Qty")}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          setItem(item.key, {
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeItem(item.key)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <Label>{tr("Status")}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={status === "DRAFT" ? "default" : "outline"}
                  onClick={() => setStatus("DRAFT")}
                >
                  {tr("Draft")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={status === "ACTIVE" ? "default" : "outline"}
                  onClick={() => setStatus("ACTIVE")}
                >
                  {tr("Active")}
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

export default AdminBundles;

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCategoryNames } from "@/components/categories/useCategoryNames";
import { Loader2, Plus, Trash2, ArrowLeft } from "lucide-react";

type PackType = {
  code: string;
  label_en: string;
  label_ar: string;
  base_qty: number;
  uom?: string;
};

const emptyPack: PackType = {
  code: "EACH",
  label_en: "Each",
  label_ar: "حبة",
  base_qty: 1,
  uom: "PCS",
};

const SupplierProductRequest = () => {
  const { tr, lang } = useLanguage();
  const { localize } = useCategoryNames();
  const navigate = useNavigate();

  const submit = useMutation(api.productAdditionRequests.submit);
  const myRequests = useQuery(api.productAdditionRequests.listMine);

  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [descAr, setDescAr] = useState("");
  const [categoryId, setCategoryId] = useState<Id<"categories"> | undefined>();
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [imageDraft, setImageDraft] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [packs, setPacks] = useState<PackType[]>([{ ...emptyPack }]);
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);

  const setPack = (idx: number, patch: Partial<PackType>) =>
    setPacks((arr) =>
      arr.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  const addPack = () =>
    setPacks((arr) => [
      ...arr,
      { code: "", label_en: "", label_ar: "", base_qty: 1, uom: "" },
    ]);
  const removePack = (idx: number) =>
    setPacks((arr) => arr.filter((_, i) => i !== idx));

  const submitForm = async () => {
    if (!nameEn.trim() || !nameAr.trim()) {
      toast.error(tr("Name (English & Arabic) is required"));
      return;
    }
    if (!categoryId) {
      toast.error(tr("Category is required"));
      return;
    }
    const codes = new Set<string>();
    for (const p of packs) {
      if (!p.code.trim() || !p.label_en.trim() || !p.label_ar.trim()) {
        toast.error(tr("Pack code and labels (EN & AR) are required"));
        return;
      }
      if (codes.has(p.code)) {
        toast.error(tr("Duplicate pack type code: ") + p.code);
        return;
      }
      if (!(p.base_qty > 0)) {
        toast.error(tr("Pack base_qty must be > 0"));
        return;
      }
      codes.add(p.code);
    }
    setSaving(true);
    try {
      await submit({
        proposed_name_en: nameEn.trim(),
        proposed_name_ar: nameAr.trim(),
        proposed_description_en: descEn.trim() || undefined,
        proposed_description_ar: descAr.trim() || undefined,
        category_id: categoryId,
        proposed_sku: sku.trim() || undefined,
        proposed_brand: brand.trim() || undefined,
        images,
        proposed_pack_types: packs.map((p) => ({
          code: p.code.trim(),
          label_en: p.label_en.trim(),
          label_ar: p.label_ar.trim(),
          base_qty: Number(p.base_qty),
          uom: p.uom?.trim() || undefined,
        })),
        justification: justification.trim() || undefined,
      });
      toast.success(tr("Submitted — admin will review"));
      navigate("/supplier/catalog");
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SupplierLayout>
      <Link
        to="/supplier/catalog"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center mb-3"
      >
        <ArrowLeft className="w-4 h-4 me-1" /> {tr("Back to catalog")}
      </Link>

      <h1 className="font-display text-3xl font-bold text-foreground mb-2">
        {tr("Propose a new product")}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {tr(
          "If the master catalog doesn't list a product you sell, propose it here. Admin reviews proposals and either creates the master entry or rejects with a reason.",
        )}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6 space-y-4">
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
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("SKU (your reference)")}</Label>
                <Input value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Brand")}</Label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("Description (English)")}</Label>
                <Textarea
                  rows={3}
                  value={descEn}
                  onChange={(e) => setDescEn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Description (Arabic)")}</Label>
                <Textarea
                  rows={3}
                  dir="rtl"
                  value={descAr}
                  onChange={(e) => setDescAr(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tr("Images (URLs)")}</Label>
              <div className="flex flex-wrap gap-2">
                {images.map((url, i) => (
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
                        setImages((arr) => arr.filter((_, idx) => idx !== i))
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
                    setImages((arr) => [...arr, url]);
                    setImageDraft("");
                  }}
                >
                  {tr("Add")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{tr("Pack types you sell")} *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addPack}
                >
                  <Plus className="w-3.5 h-3.5 me-1" />
                  {tr("Add pack")}
                </Button>
              </div>
              {packs.map((p, idx) => (
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
                      disabled={packs.length === 1}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>{tr("Why should we add this? (optional)")}</Label>
              <Textarea
                rows={2}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder={tr("Helps admin understand demand or context.")}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate(-1)}>
                {tr("Cancel")}
              </Button>
              <Button onClick={submitForm} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : null}
                {tr("Submit proposal")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold text-foreground mb-3">
              {tr("Your previous proposals")}
            </h3>
            {myRequests === undefined ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (myRequests ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tr("None yet.")}
              </p>
            ) : (
              <div className="space-y-2">
                {myRequests.map((r) => (
                  <div
                    key={r._id}
                    className="border border-border rounded-md p-2.5 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium line-clamp-1">
                        {lang === "ar" ? r.proposed_name_ar : r.proposed_name_en}
                      </span>
                      <Badge
                        variant={
                          r.status === "APPROVED"
                            ? "default"
                            : r.status === "REJECTED"
                            ? "destructive"
                            : "outline"
                        }
                        className="flex-shrink-0 text-[10px]"
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {localize(r.category_id)}
                    </p>
                    {r.status === "REJECTED" && r.rejection_reason && (
                      <p className="text-xs text-destructive mt-1">
                        {r.rejection_reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SupplierLayout>
  );
};

export default SupplierProductRequest;

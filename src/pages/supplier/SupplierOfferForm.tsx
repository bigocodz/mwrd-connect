import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useParams, Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategoryNames } from "@/components/categories/useCategoryNames";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, ArrowLeft } from "lucide-react";

type PackType = {
  code: string;
  label_en: string;
  label_ar: string;
  base_qty: number;
  uom?: string;
};

type ReviewWindow = "INSTANT" | "MIN_30" | "HR_2";

const SupplierOfferForm = () => {
  const { tr, lang } = useLanguage();
  const { localize } = useCategoryNames();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { offerId: editId } = useParams<{ offerId?: string }>();

  const masterIdParam = params.get("master") as Id<"master_products"> | null;

  const editingOffer = useQuery(
    api.products.getById,
    editId ? { id: editId as Id<"products"> } : "skip",
  );

  const masterId = (editingOffer?.master_product_id ?? masterIdParam) as
    | Id<"master_products">
    | undefined;

  const master = useQuery(
    api.masterProducts.getById,
    masterId ? { id: masterId } : "skip",
  );

  const myOffers = useQuery(
    api.products.myOffersByMaster,
    masterId ? { master_product_id: masterId } : "skip",
  );

  const createOffer = useMutation(api.products.createOffer);
  const updateOffer = useMutation(api.products.updateOffer);

  const [packTypeCode, setPackTypeCode] = useState<string>("");
  const [costPrice, setCostPrice] = useState<string>("");
  const [leadTimeDays, setLeadTimeDays] = useState<string>("3");
  const [moq, setMoq] = useState<string>("");
  const [autoQuote, setAutoQuote] = useState(false);
  const [reviewWindow, setReviewWindow] = useState<ReviewWindow>("INSTANT");
  const [availability, setAvailability] = useState<
    "AVAILABLE" | "LIMITED_STOCK" | "OUT_OF_STOCK"
  >("AVAILABLE");
  const [stockQty, setStockQty] = useState<string>("");
  const [lowStock, setLowStock] = useState<string>("");
  const [supplierSku, setSupplierSku] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Populate when editing
  useEffect(() => {
    if (!editingOffer) return;
    setPackTypeCode(editingOffer.pack_type_code ?? "");
    setCostPrice(String(editingOffer.cost_price));
    setLeadTimeDays(String(editingOffer.lead_time_days));
    setMoq(editingOffer.moq != null ? String(editingOffer.moq) : "");
    setAutoQuote(editingOffer.auto_quote ?? false);
    setReviewWindow((editingOffer.review_window ?? "INSTANT") as ReviewWindow);
    setAvailability(editingOffer.availability_status);
    setStockQty(
      editingOffer.stock_quantity != null
        ? String(editingOffer.stock_quantity)
        : "",
    );
    setLowStock(
      editingOffer.low_stock_threshold != null
        ? String(editingOffer.low_stock_threshold)
        : "",
    );
    setSupplierSku(editingOffer.sku ?? "");
  }, [editingOffer]);

  // Default pack type to first available when creating new
  useEffect(() => {
    if (editId) return;
    if (!master || packTypeCode) return;
    const taken = new Set((myOffers ?? []).map((o) => o.pack_type_code));
    const firstFree = master.pack_types.find((p) => !taken.has(p.code));
    if (firstFree) setPackTypeCode(firstFree.code);
  }, [master, myOffers, packTypeCode, editId]);

  const availablePacks = useMemo<PackType[]>(() => {
    if (!master) return [];
    if (editId) return master.pack_types; // editing — keep current pack visible
    const taken = new Set((myOffers ?? []).map((o) => o.pack_type_code));
    return master.pack_types.filter((p) => !taken.has(p.code));
  }, [master, myOffers, editId]);

  const submit = async () => {
    if (!masterId || !master) {
      toast.error(tr("Pick a master product first"));
      return;
    }
    if (!packTypeCode) {
      toast.error(tr("Pick a pack type"));
      return;
    }
    const cost = Number(costPrice);
    const lead = Number(leadTimeDays);
    if (!(cost > 0)) {
      toast.error(tr("Cost price must be > 0"));
      return;
    }
    if (!(lead >= 0)) {
      toast.error(tr("Lead time invalid"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        cost_price: cost,
        lead_time_days: lead,
        moq: moq ? Number(moq) : undefined,
        auto_quote: autoQuote,
        review_window: reviewWindow,
        availability_status: availability,
        stock_quantity: stockQty ? Number(stockQty) : undefined,
        low_stock_threshold: lowStock ? Number(lowStock) : undefined,
        sku: supplierSku.trim() || undefined,
      };
      if (editId) {
        await updateOffer({ id: editId as Id<"products">, ...payload });
        toast.success(tr("Offer updated — sent for review"));
      } else {
        await createOffer({
          master_product_id: masterId,
          pack_type_code: packTypeCode,
          ...payload,
        });
        toast.success(tr("Offer created — sent for review"));
      }
      navigate("/supplier/products");
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    } finally {
      setSaving(false);
    }
  };

  const loading =
    masterId === undefined ||
    master === undefined ||
    (editId && editingOffer === undefined);

  return (
    <SupplierLayout>
      <Link
        to="/supplier/catalog"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center mb-3"
      >
        <ArrowLeft className="w-4 h-4 me-1" /> {tr("Back to catalog")}
      </Link>

      <h1 className="font-display text-3xl font-bold text-foreground mb-6">
        {editId ? tr("Edit offer") : tr("Create offer")}
      </h1>

      {!masterId ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>{tr("No master product selected.")}</p>
            <Link to="/supplier/catalog" className="text-primary hover:underline mt-2 inline-block">
              {tr("Browse the catalog")}
            </Link>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !master ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {tr("Master product not found")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-1">
            <CardContent className="pt-6">
              {master.images[0] && (
                <img
                  src={master.images[0]}
                  alt=""
                  className="w-full h-40 rounded-md object-cover border border-border mb-3"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
              <h2 className="font-display text-lg font-bold text-foreground">
                {lang === "ar" ? master.name_ar : master.name_en}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {localize(master.category_id)}
                {master.brand ? ` · ${master.brand}` : ""}
              </p>
              {master.description_en && (
                <p className="text-sm text-muted-foreground mt-2">
                  {lang === "ar" && master.description_ar
                    ? master.description_ar
                    : master.description_en}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {master.pack_types.map((p) => (
                  <Badge
                    key={p.code}
                    variant="secondary"
                    className="font-mono text-xs"
                  >
                    {p.code} · {p.base_qty}
                    {p.uom ? ` ${p.uom}` : ""}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>{tr("Pack type")} *</Label>
                <Select
                  value={packTypeCode}
                  onValueChange={setPackTypeCode}
                  disabled={!!editId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tr("Select a pack type")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePacks.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.code} —{" "}
                        {lang === "ar" ? p.label_ar : p.label_en} · {p.base_qty}
                        {p.uom ? ` ${p.uom}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!editId && availablePacks.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {tr("You already have offers on every pack type for this product.")}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{tr("Cost price (per pack, SAR)")} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{tr("Lead time (days)")} *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{tr("Min order qty (MOQ)")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={moq}
                    onChange={(e) => setMoq(e.target.value)}
                    placeholder={tr("Optional")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{tr("Your SKU")}</Label>
                  <Input
                    value={supplierSku}
                    onChange={(e) => setSupplierSku(e.target.value)}
                    placeholder={tr("Optional")}
                  />
                </div>
              </div>

              <div className="border border-border rounded-md p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="auto_quote"
                    checked={autoQuote}
                    onCheckedChange={(v) => setAutoQuote(v === true)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="auto_quote" className="cursor-pointer">
                      {tr("Auto-quote enabled")}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tr(
                        "When an RFQ includes this offer, a draft quote is generated automatically using the cost price above.",
                      )}
                    </p>
                  </div>
                </div>
                {autoQuote && (
                  <div className="space-y-1.5 ms-6">
                    <Label>{tr("Review window before auto-send")}</Label>
                    <Select
                      value={reviewWindow}
                      onValueChange={(v) => setReviewWindow(v as ReviewWindow)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INSTANT">
                          {tr("Instant (send immediately)")}
                        </SelectItem>
                        <SelectItem value="MIN_30">
                          {tr("30 minutes")}
                        </SelectItem>
                        <SelectItem value="HR_2">{tr("2 hours")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{tr("Availability")}</Label>
                  <Select
                    value={availability}
                    onValueChange={(v) => setAvailability(v as typeof availability)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AVAILABLE">{tr("Available")}</SelectItem>
                      <SelectItem value="LIMITED_STOCK">
                        {tr("Limited stock")}
                      </SelectItem>
                      <SelectItem value="OUT_OF_STOCK">
                        {tr("Out of stock")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{tr("Stock quantity")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    placeholder={tr("Optional")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{tr("Low stock threshold")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={lowStock}
                    onChange={(e) => setLowStock(e.target.value)}
                    placeholder={tr("Optional")}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => navigate(-1)}>
                  {tr("Cancel")}
                </Button>
                <Button onClick={submit} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : null}
                  {editId ? tr("Save offer") : tr("Create offer")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </SupplierLayout>
  );
};

export default SupplierOfferForm;

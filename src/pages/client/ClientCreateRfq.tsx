import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import { useAuth } from "@/hooks/useAuth";
import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingBag, AlertTriangle, Loader2, FileText, Sparkles } from "lucide-react";
import { getRfqTemplate, rfqTemplates } from "@/data/rfqTemplates";
import { useLanguage } from "@/contexts/LanguageContext";

interface RfqItemDraft {
  key: string;
  // Two paths into the RFQ:
  //   - master_product_id (+ pack_type_code) → preferred; targets the master
  //     catalog so every supplier with an offer on the master can quote.
  //   - product_id → legacy direct supplier-offer path (cart-derived items).
  master_product_id: string | null;
  pack_type_code: string | null;
  product_id: string | null;
  custom_item_description: string;
  quantity: number;
  flexibility: "EXACT_MATCH" | "OPEN_TO_EQUIVALENT" | "OPEN_TO_ALTERNATIVES";
  special_notes: string;
}

interface RfqAttachmentDraft {
  key: string;
  document_type:
    | "SPECIFICATION"
    | "PURCHASE_POLICY"
    | "SUPPORTING_DOCUMENT"
    | "SUPPLIER_QUOTATION"
    | "COMMERCIAL_TERMS"
    | "OTHER";
  name: string;
  url: string;
  storage_id: string | null;
  content_type: string;
  size: number | null;
  notes: string;
}

const emptyItem = (): RfqItemDraft => ({
  key: crypto.randomUUID(),
  master_product_id: null,
  pack_type_code: null,
  product_id: null,
  custom_item_description: "",
  quantity: 1,
  flexibility: "EXACT_MATCH",
  special_notes: "",
});

const emptyAttachment = (): RfqAttachmentDraft => ({
  key: crypto.randomUUID(),
  document_type: "SPECIFICATION",
  name: "",
  url: "",
  storage_id: null,
  content_type: "",
  size: null,
  notes: "",
});

const dateInputFromToday = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const ClientCreateRfq = () => {
  const { profile } = useAuth();
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const createRfq = useMutation(api.rfqs.create);
  const generateUploadUrl = useMutation(api.rfqs.generateAttachmentUploadUrl);
  const clearCart = useMutation(api.clientCatalog.clearCart);

  const productsData = useQuery(api.products.listApproved);
  const loadingProducts = productsData === undefined;
  const products = productsData ?? [];
  const masterProductsData = useQuery(api.masterProducts.listActive, {});
  const masterProducts = masterProductsData ?? [];
  const bundlesData = useQuery(api.bundles.listActive, {});
  const bundles = bundlesData ?? [];
  const costCenters = useQuery(api.organization.listMyCostCenters) ?? [];
  const branches = useQuery(api.organization.listMyBranches) ?? [];
  const departments = useQuery(api.organization.listMyDepartments) ?? [];
  const createSchedule = useMutation(api.schedules.create);

  const cartItems = (location.state as any)?.cartItems as
    | { product_id: string; product_name: string; quantity: number }[]
    | undefined;
  const fromCart = !!cartItems?.length;

  const [items, setItems] = useState<RfqItemDraft[]>(
    fromCart
      ? cartItems!.map((c) => ({
          key: crypto.randomUUID(),
          master_product_id: null,
          pack_type_code: null,
          product_id: c.product_id,
          custom_item_description: "",
          quantity: c.quantity,
          flexibility: "EXACT_MATCH",
          special_notes: "",
        }))
      : [emptyItem()],
  );
  const [templateKey, setTemplateKey] = useState("blank");
  const [category, setCategory] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [requiredBy, setRequiredBy] = useState("");
  const [notes, setNotes] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [attachments, setAttachments] = useState<RfqAttachmentDraft[]>([]);
  const [uploadingAttachmentKey, setUploadingAttachmentKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleCadence, setScheduleCadence] = useState<"WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY">("MONTHLY");
  const [scheduleStart, setScheduleStart] = useState(dateInputFromToday(7));
  const [scheduleLeadDays, setScheduleLeadDays] = useState("7");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const handleSaveSchedule = async () => {
    if (!scheduleName.trim()) {
      toast.error(tr("Schedule name required"));
      return;
    }
    if (items.length === 0) {
      toast.error(tr("Add at least one item"));
      return;
    }
    setSavingSchedule(true);
    try {
      await createSchedule({
        name: scheduleName.trim(),
        cadence: scheduleCadence,
        start_at: new Date(scheduleStart).getTime(),
        template: {
          category: category || undefined,
          template_key: templateKey === "blank" ? undefined : templateKey,
          notes: notes || undefined,
          delivery_location: deliveryLocation || undefined,
          lead_time_days: Math.max(1, parseInt(scheduleLeadDays, 10) || 7),
          cost_center_id: costCenterId ? (costCenterId as any) : undefined,
          branch_id: branchId ? (branchId as any) : undefined,
          department_id: departmentId ? (departmentId as any) : undefined,
          items: items.map((item) => ({
            product_id: item.product_id ? (item.product_id as any) : undefined,
            custom_item_description: item.custom_item_description || undefined,
            quantity: item.quantity,
            flexibility: item.flexibility,
            special_notes: item.special_notes || undefined,
          })),
        },
      });
      toast.success(tr("Schedule saved"));
      setScheduleOpen(false);
      setScheduleName("");
      navigate("/client/schedules");
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setSavingSchedule(false);
    }
  };

  const isFrozen = profile?.status === "FROZEN";

  const updateItem = (key: string, updates: Partial<RfqItemDraft>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...updates } : i)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const applyTemplate = (key: string) => {
    setTemplateKey(key);
    const template = getRfqTemplate(key);
    if (!template) return;

    setCategory(template.category);
    setRequiredBy(dateInputFromToday(template.daysUntilRequired));
    setDeliveryLocation(template.delivery_location ?? "");
    setNotes(template.notes);
    setItems(
      template.items.map((item) => ({
        key: crypto.randomUUID(),
        master_product_id: null,
        pack_type_code: null,
        product_id: null,
        custom_item_description: item.custom_item_description,
        quantity: item.quantity,
        flexibility: item.flexibility,
        special_notes: item.special_notes ?? "",
      })),
    );
  };

  const updateAttachment = (key: string, updates: Partial<RfqAttachmentDraft>) => {
    setAttachments((prev) => prev.map((attachment) => (attachment.key === key ? { ...attachment, ...updates } : attachment)));
  };

  const removeAttachment = (key: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.key !== key));
  };

  const handleAttachmentUpload = async (key: string, file?: File) => {
    if (!file) return;
    setUploadingAttachmentKey(key);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw new Error(tr("Upload failed"));
      const { storageId } = await response.json();
      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.key === key
            ? {
                ...attachment,
                name: attachment.name || file.name,
                url: "",
                storage_id: storageId,
                content_type: file.type,
                size: file.size,
              }
            : attachment,
        ),
      );
      toast.success(tr("Document uploaded"));
    } catch (err: any) {
      toast.error(`${tr("Upload error:")} ${err.message}`);
    } finally {
      setUploadingAttachmentKey(null);
    }
  };

  const handleSubmit = async () => {
    if (isFrozen) return;
    if (items.length === 0) {
      toast.error(tr("Add at least one item"));
      return;
    }
    for (const item of items) {
      const hasProduct = item.master_product_id || item.product_id;
      if (!hasProduct && !item.custom_item_description.trim()) {
        toast.error(tr("Each item must have a product or description"));
        return;
      }
      if (item.quantity < 1) {
        toast.error(tr("Quantity must be at least 1"));
        return;
      }
    }
    for (const attachment of attachments) {
      if (!attachment.name.trim() || (!attachment.url.trim() && !attachment.storage_id)) {
        toast.error(tr("Each document needs a name and either a file upload or URL"));
        return;
      }
    }

    setSubmitting(true);
    try {
      await createRfq({
        category: category || undefined,
        template_key: templateKey === "blank" ? undefined : templateKey,
        notes: notes || undefined,
        expiry_date: expiryDate || undefined,
        required_by: requiredBy || undefined,
        delivery_location: deliveryLocation || undefined,
        cost_center_id: costCenterId ? (costCenterId as any) : undefined,
        branch_id: branchId ? (branchId as any) : undefined,
        department_id: departmentId ? (departmentId as any) : undefined,
        attachments: attachments.map(({ key: _key, notes: attachmentNotes, storage_id, url, content_type, size, ...attachment }) => ({
          ...attachment,
          storage_id: storage_id ? (storage_id as any) : undefined,
          url: url || undefined,
          content_type: content_type || undefined,
          size: size || undefined,
          notes: attachmentNotes || undefined,
        })),
        items: items.map((item) => ({
          master_product_id: item.master_product_id ? (item.master_product_id as any) : undefined,
          pack_type_code: item.pack_type_code || undefined,
          product_id: item.product_id ? (item.product_id as any) : undefined,
          custom_item_description: item.custom_item_description || undefined,
          quantity: item.quantity,
          flexibility: item.flexibility,
          special_notes: item.special_notes || undefined,
        })),
      });
      if (fromCart) {
        try {
          await clearCart();
        } catch {
          // non-fatal
        }
      }
      toast.success(tr("RFQ submitted successfully"));
      navigate("/client/rfqs");
    } catch (err: any) {
      toast.error(`${tr("Error creating RFQ:")} ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProducts) {
    return (
      <ClientLayout>
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("New Request for Quote")}</h1>
          <p className="text-muted-foreground mt-1">{tr("Use a template, attach requirements, and describe exactly what suppliers should quote.")}</p>
        </div>

        {isFrozen && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive font-medium">
                {tr("Your account is currently frozen. Please contact MWRD support.")}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              {tr("RFQ setup")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{tr("Template")}</Label>
              <Select value={templateKey} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Start from a template")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">{tr("Blank RFQ")}</SelectItem>
                  {rfqTemplates.map((template) => (
                    <SelectItem key={template.key} value={template.key}>
                      {template.label} ({template.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templateKey !== "blank" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {getRfqTemplate(templateKey)?.description}
                </p>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>{tr("Category")}</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={tr("Office Supplies, IT, Facilities…")} />
              </div>
              <div>
                <Label>{tr("Required By")}</Label>
                <Input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>{tr("Delivery Location")}</Label>
              <Input
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder={tr("Branch, city, warehouse, or delivery instruction")}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <Card key={item.key}>
              <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-sm font-medium">{tr("Item {n}", { n: idx + 1 })}</CardTitle>
                {items.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeItem(item.key)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                {item.product_id && !item.master_product_id ? (
                  // Legacy cart-derived line — keep the direct supplier offer link
                  // until the cart is migrated to masters.
                  <div className="rounded-md border border-border p-2.5 text-sm">
                    <div className="text-muted-foreground text-xs">{tr("From cart")}</div>
                    <div className="font-medium">
                      {products.find((p) => p._id === item.product_id)?.name ?? item.product_id}
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>{tr("Product from Catalog")}</Label>
                      <Select
                        value={item.master_product_id || "custom"}
                        onValueChange={(v) => {
                          if (v === "custom") {
                            updateItem(item.key, {
                              master_product_id: null,
                              pack_type_code: null,
                            });
                            return;
                          }
                          // Default pack_type to first available so suppliers
                          // can match a specific orderable unit.
                          const m = masterProducts.find((mp: any) => mp._id === v);
                          updateItem(item.key, {
                            master_product_id: v,
                            pack_type_code: m?.pack_types?.[0]?.code ?? null,
                            custom_item_description: "",
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={tr("Select a product or choose custom…")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">{tr("— Custom item (not in catalog)")}</SelectItem>
                          {masterProducts.map((m: any) => (
                            <SelectItem key={m._id} value={m._id}>
                              {m.name_en}
                              {m.brand ? ` · ${m.brand}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {item.master_product_id && (
                      <div>
                        <Label>{tr("Pack type")}</Label>
                        <Select
                          value={item.pack_type_code ?? ""}
                          onValueChange={(v) => updateItem(item.key, { pack_type_code: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={tr("Select a pack type")} />
                          </SelectTrigger>
                          <SelectContent>
                            {(masterProducts.find((m: any) => m._id === item.master_product_id)
                              ?.pack_types ?? []).map((p: any) => (
                              <SelectItem key={p.code} value={p.code}>
                                {p.code} — {p.label_en} · {p.base_qty}
                                {p.uom ? ` ${p.uom}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {!item.master_product_id && (
                      <div>
                        <Label>{tr("Custom Item Description")}</Label>
                        <Textarea
                          value={item.custom_item_description}
                          onChange={(e) => updateItem(item.key, { custom_item_description: e.target.value })}
                          placeholder={tr("Describe the item you need…")}
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{tr("Quantity")}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, { quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <Label>{tr("Flexibility")}</Label>
                    <Select
                      value={item.flexibility}
                      onValueChange={(v) => updateItem(item.key, { flexibility: v as any })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EXACT_MATCH">{tr("Exact Match")}</SelectItem>
                        <SelectItem value="OPEN_TO_EQUIVALENT">{tr("Open to Equivalent")}</SelectItem>
                        <SelectItem value="OPEN_TO_ALTERNATIVES">{tr("Open to Alternatives")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>{tr("Special Notes (optional)")}</Label>
                  <Input
                    value={item.special_notes}
                    onChange={(e) => updateItem(item.key, { special_notes: e.target.value })}
                    placeholder={tr("Any specific requirements…")}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setItems([...items, emptyItem()])}
            >
              <Plus className="w-4 h-4 me-2" /> {tr("Add Another Item")}
            </Button>
            {bundles.length > 0 && (
              <Select
                onValueChange={(bundleId) => {
                  const b = bundles.find((bb: any) => bb._id === bundleId);
                  if (!b) return;
                  setItems((prev) => [
                    ...prev.filter((p) => {
                      // Drop the empty starter line if it's still pristine.
                      return (
                        p.master_product_id ||
                        p.product_id ||
                        p.custom_item_description.trim()
                      );
                    }),
                    ...b.items.map((it: any) => ({
                      key: crypto.randomUUID(),
                      master_product_id: it.master_product_id,
                      pack_type_code: it.pack_type_code,
                      product_id: null,
                      custom_item_description: "",
                      quantity: it.quantity,
                      flexibility: "EXACT_MATCH" as const,
                      special_notes: it.notes ?? "",
                    })),
                  ]);
                  toast.success(tr("Bundle added"));
                }}
              >
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder={tr("+ Add a bundle")} />
                </SelectTrigger>
                <SelectContent>
                  {bundles.map((b: any) => (
                    <SelectItem key={b._id} value={b._id}>
                      {b.name_en} ({b.items.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <div>
              <Label>{tr("Expiry Date (optional)")}</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
            <div>
              <Label>{tr("Notes (optional)")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tr("General notes for this RFQ…")}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>{tr("Cost center (optional)")}</Label>
                <Select value={costCenterId || "__none"} onValueChange={(v) => setCostCenterId(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder={tr("None")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{tr("None")}</SelectItem>
                    {costCenters.map((cc: any) => (
                      <SelectItem key={cc._id} value={cc._id}>{cc.code} — {cc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr("Branch (optional)")}</Label>
                <Select value={branchId || "__none"} onValueChange={(v) => setBranchId(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder={tr("None")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{tr("None")}</SelectItem>
                    {branches.map((b: any) => (
                      <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr("Department (optional)")}</Label>
                <Select value={departmentId || "__none"} onValueChange={(v) => setDepartmentId(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder={tr("None")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{tr("None")}</SelectItem>
                    {departments.map((d: any) => (
                      <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {costCenters.length === 0 && branches.length === 0 && departments.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {tr("Set up cost centers, branches, and departments in")}{" "}
                <span className="font-medium">{tr("Account → Organization")}</span>{" "}
                {tr("to tag RFQs.")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                {tr("Supporting documents")}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{tr("Add links to specs, purchase policies, drawings, or other files.")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAttachments([...attachments, emptyAttachment()])}>
              <Plus className="h-4 w-4 me-2" />
              {tr("Add")}
            </Button>
          </CardHeader>
          {attachments.length > 0 && (
            <CardContent className="space-y-3">
              {attachments.map((attachment) => (
                <div key={attachment.key} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[160px_1fr_1fr_auto]">
                  <div>
                    <Label>{tr("Type")}</Label>
                    <Select
                      value={attachment.document_type}
                      onValueChange={(v) => updateAttachment(attachment.key, { document_type: v as RfqAttachmentDraft["document_type"] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SPECIFICATION">{tr("Specification")}</SelectItem>
                        <SelectItem value="PURCHASE_POLICY">{tr("Purchase Policy")}</SelectItem>
                        <SelectItem value="SUPPORTING_DOCUMENT">{tr("Supporting Document")}</SelectItem>
                        <SelectItem value="OTHER">{tr("Other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr("Name")}</Label>
                    <Input
                      value={attachment.name}
                      onChange={(e) => updateAttachment(attachment.key, { name: e.target.value })}
                      placeholder={tr("Document name")}
                    />
                  </div>
                  <div>
                    <Label>{tr("URL")}</Label>
                    <Input
                      value={attachment.url}
                      onChange={(e) => updateAttachment(attachment.key, { url: e.target.value, storage_id: null, content_type: "", size: null })}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="icon" onClick={() => removeAttachment(attachment.key)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="md:col-span-4">
                    <Label>{tr("Notes")}</Label>
                    <Input
                      value={attachment.notes}
                      onChange={(e) => updateAttachment(attachment.key, { notes: e.target.value })}
                      placeholder={tr("Optional context for suppliers")}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Label>{tr("Upload File")}</Label>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      disabled={uploadingAttachmentKey === attachment.key}
                      onChange={(e) => handleAttachmentUpload(attachment.key, e.target.files?.[0])}
                    />
                    {attachment.storage_id && (
                      <p className="mt-1 text-xs text-primary">
                        {tr("Uploaded file ready")}
                        {attachment.size ? ` · ${(attachment.size / 1024 / 1024).toFixed(2)} MB` : ""}
                      </p>
                    )}
                    {uploadingAttachmentKey === attachment.key && <p className="mt-1 text-xs text-muted-foreground">{tr("Uploading…")}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/client/rfqs")}>{tr("Cancel")}</Button>
          <Button variant="outline" onClick={() => setScheduleOpen(true)} disabled={isFrozen || items.length === 0}>
            {tr("Save as schedule")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || isFrozen}>
            <ShoppingBag className="w-4 h-4 me-2" />
            {submitting ? tr("Submitting…") : tr("Submit RFQ")}
          </Button>
        </div>
      </div>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("Save as repeat RFQ")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{tr("Schedule name")}</Label>
              <Input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} placeholder={tr("Monthly office supplies")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tr("Cadence")}</Label>
                <Select value={scheduleCadence} onValueChange={(v) => setScheduleCadence(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">{tr("Weekly")}</SelectItem>
                    <SelectItem value="BIWEEKLY">{tr("Every 2 weeks")}</SelectItem>
                    <SelectItem value="MONTHLY">{tr("Monthly")}</SelectItem>
                    <SelectItem value="QUARTERLY">{tr("Quarterly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr("First run")}</Label>
                <Input type="date" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{tr("Lead time per RFQ (days)")}</Label>
              <Input
                type="number"
                min="1"
                value={scheduleLeadDays}
                onChange={(e) => setScheduleLeadDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {tr("Each generated RFQ will have required_by set this many days after creation.")}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {tr("Items, category, notes, delivery, and org tags above are stored as the template.")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>{tr("Cancel")}</Button>
            <Button onClick={handleSaveSchedule} disabled={savingSchedule}>{tr("Save schedule")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientCreateRfq;

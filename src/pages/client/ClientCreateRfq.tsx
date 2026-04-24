import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { toast } from "sonner";
import { Plus, Trash2, ShoppingBag, AlertTriangle, Loader2, FileText, Sparkles } from "lucide-react";
import { getRfqTemplate, rfqTemplates } from "@/data/rfqTemplates";

interface RfqItemDraft {
  key: string;
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
  const navigate = useNavigate();
  const createRfq = useMutation(api.rfqs.create);
  const generateUploadUrl = useMutation(api.rfqs.generateAttachmentUploadUrl);

  const productsData = useQuery(api.products.listApproved);
  const loadingProducts = productsData === undefined;
  const products = productsData ?? [];

  const [items, setItems] = useState<RfqItemDraft[]>([emptyItem()]);
  const [templateKey, setTemplateKey] = useState("blank");
  const [category, setCategory] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [requiredBy, setRequiredBy] = useState("");
  const [notes, setNotes] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [attachments, setAttachments] = useState<RfqAttachmentDraft[]>([]);
  const [uploadingAttachmentKey, setUploadingAttachmentKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      if (!response.ok) throw new Error("Upload failed");
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
      toast.success("Document uploaded");
    } catch (err: any) {
      toast.error("Upload error: " + err.message);
    } finally {
      setUploadingAttachmentKey(null);
    }
  };

  const handleSubmit = async () => {
    if (isFrozen) return;
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    for (const item of items) {
      if (!item.product_id && !item.custom_item_description.trim()) {
        toast.error("Each item must have a product or description");
        return;
      }
      if (item.quantity < 1) {
        toast.error("Quantity must be at least 1");
        return;
      }
    }
    for (const attachment of attachments) {
      if (!attachment.name.trim() || (!attachment.url.trim() && !attachment.storage_id)) {
        toast.error("Each document needs a name and either a file upload or URL");
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
        attachments: attachments.map(({ key: _key, notes: attachmentNotes, storage_id, url, content_type, size, ...attachment }) => ({
          ...attachment,
          storage_id: storage_id ? (storage_id as any) : undefined,
          url: url || undefined,
          content_type: content_type || undefined,
          size: size || undefined,
          notes: attachmentNotes || undefined,
        })),
        items: items.map((item) => ({
          product_id: item.product_id ? (item.product_id as any) : undefined,
          custom_item_description: item.custom_item_description || undefined,
          quantity: item.quantity,
          flexibility: item.flexibility,
          special_notes: item.special_notes || undefined,
        })),
      });
      toast.success("RFQ submitted successfully");
      navigate("/client/rfqs");
    } catch (err: any) {
      toast.error("Error creating RFQ: " + err.message);
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
          <h1 className="text-2xl font-display font-bold text-foreground">New Request for Quote</h1>
          <p className="text-muted-foreground mt-1">Use a template, attach requirements, and describe exactly what suppliers should quote.</p>
        </div>

        {isFrozen && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive font-medium">
                Your account is currently frozen. Please contact MWRD support.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              RFQ setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Template</Label>
              <Select value={templateKey} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Start from a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Blank RFQ</SelectItem>
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
                <Label>Category</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Office Supplies, IT, Facilities…" />
              </div>
              <div>
                <Label>Required By</Label>
                <Input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Delivery Location</Label>
              <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="Branch, city, warehouse, or delivery instruction" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <Card key={item.key}>
              <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-sm font-medium">Item {idx + 1}</CardTitle>
                {items.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeItem(item.key)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                <div>
                  <Label>Product from Catalog</Label>
                  <Select
                    value={item.product_id || "custom"}
                    onValueChange={(v) =>
                      updateItem(item.key, {
                        product_id: v === "custom" ? null : v,
                        custom_item_description: v === "custom" ? item.custom_item_description : "",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product or choose custom…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">— Custom item (not in catalog)</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name} ({p.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!item.product_id && (
                  <div>
                    <Label>Custom Item Description</Label>
                    <Textarea
                      value={item.custom_item_description}
                      onChange={(e) => updateItem(item.key, { custom_item_description: e.target.value })}
                      placeholder="Describe the item you need…"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, { quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <Label>Flexibility</Label>
                    <Select
                      value={item.flexibility}
                      onValueChange={(v) => updateItem(item.key, { flexibility: v as any })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EXACT_MATCH">Exact Match</SelectItem>
                        <SelectItem value="OPEN_TO_EQUIVALENT">Open to Equivalent</SelectItem>
                        <SelectItem value="OPEN_TO_ALTERNATIVES">Open to Alternatives</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Special Notes (optional)</Label>
                  <Input
                    value={item.special_notes}
                    onChange={(e) => updateItem(item.key, { special_notes: e.target.value })}
                    placeholder="Any specific requirements…"
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" className="w-full" onClick={() => setItems([...items, emptyItem()])}>
            <Plus className="w-4 h-4 mr-2" /> Add Another Item
          </Button>
        </div>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <div>
              <Label>Expiry Date (optional)</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="General notes for this RFQ…"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Supporting documents
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Add links to specs, purchase policies, drawings, or other files.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAttachments([...attachments, emptyAttachment()])}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </CardHeader>
          {attachments.length > 0 && (
            <CardContent className="space-y-3">
              {attachments.map((attachment) => (
                <div key={attachment.key} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[160px_1fr_1fr_auto]">
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={attachment.document_type}
                      onValueChange={(v) => updateAttachment(attachment.key, { document_type: v as RfqAttachmentDraft["document_type"] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SPECIFICATION">Specification</SelectItem>
                        <SelectItem value="PURCHASE_POLICY">Purchase Policy</SelectItem>
                        <SelectItem value="SUPPORTING_DOCUMENT">Supporting Document</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input value={attachment.name} onChange={(e) => updateAttachment(attachment.key, { name: e.target.value })} placeholder="Document name" />
                  </div>
                  <div>
                    <Label>URL</Label>
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
                    <Label>Notes</Label>
                    <Input value={attachment.notes} onChange={(e) => updateAttachment(attachment.key, { notes: e.target.value })} placeholder="Optional context for suppliers" />
                  </div>
                  <div className="md:col-span-4">
                    <Label>Upload File</Label>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      disabled={uploadingAttachmentKey === attachment.key}
                      onChange={(e) => handleAttachmentUpload(attachment.key, e.target.files?.[0])}
                    />
                    {attachment.storage_id && (
                      <p className="mt-1 text-xs text-primary">
                        Uploaded file ready{attachment.size ? ` · ${(attachment.size / 1024 / 1024).toFixed(2)} MB` : ""}
                      </p>
                    )}
                    {uploadingAttachmentKey === attachment.key && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/client/rfqs")}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || isFrozen}>
            <ShoppingBag className="w-4 h-4 mr-2" />
            {submitting ? "Submitting…" : "Submit RFQ"}
          </Button>
        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientCreateRfq;

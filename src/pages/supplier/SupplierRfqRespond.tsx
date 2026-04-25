import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, FileText, Plus, Send, Trash2 } from "lucide-react";

const flexLabel: Record<string, string> = {
  EXACT_MATCH: "Exact Match",
  OPEN_TO_EQUIVALENT: "Open to Equivalent",
  OPEN_TO_ALTERNATIVES: "Open to Alternatives",
};

interface ItemResponse {
  rfq_item_id: string;
  is_quoted: boolean;
  cost_price: number;
  lead_time_days: number;
  supplier_product_id: string | null;
  alternative_product_id: string | null;
}

interface QuoteAttachmentDraft {
  key: string;
  document_type: "SUPPLIER_QUOTATION" | "COMMERCIAL_TERMS" | "SUPPORTING_DOCUMENT" | "OTHER";
  name: string;
  url: string;
  storage_id: string | null;
  content_type: string;
  size: number | null;
  notes: string;
}

const emptyAttachment = (): QuoteAttachmentDraft => ({
  key: crypto.randomUUID(),
  document_type: "SUPPLIER_QUOTATION",
  name: "",
  url: "",
  storage_id: null,
  content_type: "",
  size: null,
  notes: "",
});

const documentLabel: Record<string, string> = {
  SPECIFICATION: "Specification",
  PURCHASE_POLICY: "Purchase Policy",
  SUPPORTING_DOCUMENT: "Supporting Document",
  SUPPLIER_QUOTATION: "Supplier Quotation",
  COMMERCIAL_TERMS: "Commercial Terms",
  OTHER: "Other",
};

const SupplierRfqRespond = () => {
  const { rfqId } = useParams();
  const navigate = useNavigate();
  const submitQuote = useMutation(api.quotes.submit);
  const reviseQuote = useMutation(api.quotes.reviseBySupplier);
  const generateUploadUrl = useMutation(api.rfqs.generateAttachmentUploadUrl);

  const rfqData = useQuery(api.rfqs.getAssigned, rfqId ? { rfq_id: rfqId as any } : "skip");
  const loading = rfqData === undefined;

  const [responses, setResponses] = useState<Record<string, ItemResponse>>({});
  const [supplierNotes, setSupplierNotes] = useState("");
  const [attachments, setAttachments] = useState<QuoteAttachmentDraft[]>([]);
  const [uploadingAttachmentKey, setUploadingAttachmentKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const existingQuote = rfqData?.existingQuote;
  const isRevision = existingQuote?.status === "SUPPLIER_REVISION_REQUESTED";

  useEffect(() => {
    if (!rfqData) return;
    const init: Record<string, ItemResponse> = {};
    for (const item of rfqData.items ?? []) {
      const existingItem = existingQuote?.items?.find((quoteItem: any) => quoteItem.rfq_item_id === item._id);
      init[item._id] = {
        rfq_item_id: item._id,
        is_quoted: existingItem?.is_quoted ?? true,
        cost_price: existingItem?.cost_price ?? 0,
        lead_time_days: existingItem?.lead_time_days ?? 7,
        supplier_product_id: existingItem?.supplier_product_id ?? item.product_id ?? null,
        alternative_product_id: existingItem?.alternative_product_id ?? null,
      };
    }
    setResponses(init);
    setSupplierNotes(existingQuote?.supplier_notes ?? "");
  }, [rfqData?._id, existingQuote?._id]);

  const updateResponse = (itemId: string, updates: Partial<ItemResponse>) => {
    setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...updates } }));
  };

  const updateAttachment = (key: string, updates: Partial<QuoteAttachmentDraft>) => {
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
    if (!rfqId) return;
    for (const attachment of attachments) {
      if (!attachment.name.trim() || (!attachment.url.trim() && !attachment.storage_id)) {
        toast.error("Each quote document needs a name and either a file upload or URL");
        return;
      }
    }
    setSubmitting(true);
    try {
      const items = Object.values(responses).map((r) => ({
        rfq_item_id: r.rfq_item_id as any,
        is_quoted: r.is_quoted,
        cost_price: r.is_quoted ? r.cost_price : undefined,
        lead_time_days: r.is_quoted ? r.lead_time_days : undefined,
        supplier_product_id: r.supplier_product_id ? (r.supplier_product_id as any) : undefined,
        alternative_product_id: r.alternative_product_id ? (r.alternative_product_id as any) : undefined,
      }));
      const payload = {
        supplier_notes: supplierNotes || undefined,
        attachments: attachments.map(({ key: _key, notes, storage_id, url, content_type, size, ...attachment }) => ({
          ...attachment,
          storage_id: storage_id ? (storage_id as any) : undefined,
          url: url || undefined,
          content_type: content_type || undefined,
          size: size || undefined,
          notes: notes || undefined,
        })),
        items,
      };
      if (isRevision && existingQuote?._id) {
        await reviseQuote({ quote_id: existingQuote._id as any, ...payload });
        toast.success("Revised quote submitted for MWRD review");
      } else {
        await submitQuote({ rfq_id: rfqId as any, ...payload });
        toast.success("Quote submitted for admin review");
      }
      navigate("/supplier/rfqs");
    } catch (err: any) {
      toast.error("Error submitting quote: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <SupplierLayout><div className="text-muted-foreground text-center py-20">Loading…</div></SupplierLayout>;
  }

  if (!rfqData) {
    return <SupplierLayout><div className="text-muted-foreground text-center py-20">RFQ not found or not assigned.</div></SupplierLayout>;
  }

  const rfqItems = rfqData.items ?? [];
  const myProducts = rfqData.myProducts ?? [];
  const requestAttachments = rfqData.attachments ?? [];
  const revisionEvents = existingQuote?.revision_events ?? [];

  return (
    <SupplierLayout>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/supplier/rfqs")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{isRevision ? "Revise Quote" : "Respond to RFQ"}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              RFQ <span className="font-mono">{rfqId?.slice(0, 8)}</span> — {isRevision ? "Update pricing, documents, or terms requested by MWRD" : "Provide pricing for each item"}
            </p>
          </div>
        </div>

        {existingQuote && !isRevision && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4 text-sm text-amber-900">
              This RFQ already has a quote with status <span className="font-medium">{existingQuote.status.replace(/_/g, " ")}</span>.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Category</p>
              <p className="font-medium">{rfqData.category || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Required by</p>
              <p className="font-medium">{rfqData.required_by ? new Date(rfqData.required_by).toLocaleDateString() : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Delivery</p>
              <p className="font-medium">{rfqData.delivery_location || "—"}</p>
            </div>
            {rfqData.notes && (
              <div className="md:col-span-3">
                <p className="text-muted-foreground">Client notes</p>
                <p className="font-medium">{rfqData.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {requestAttachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Client documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {requestAttachments.map((attachment: any) => (
                <div key={attachment._id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <Badge variant="secondary" className="mb-2">{documentLabel[attachment.document_type] || attachment.document_type}</Badge>
                    <p className="font-medium">{attachment.name}</p>
                    {attachment.notes && <p className="text-sm text-muted-foreground">{attachment.notes}</p>}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={attachment.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="me-2 h-4 w-4" />
                      Open
                    </a>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {revisionEvents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revision history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {revisionEvents.map((event: any) => (
                <div key={event._id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="secondary">{event.actor_role}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{event.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {rfqItems.map((item: any, idx: number) => {
          const resp = responses[item._id];
          if (!resp) return null;

          return (
            <Card key={item._id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Item {idx + 1}: {item.product?.name || item.custom_item_description || "Custom Item"}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {flexLabel[item.flexibility] || item.flexibility}
                  </Badge>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  <span>Qty: {item.quantity}</span>
                  {item.product?.category && <span>Category: {item.product.category}</span>}
                  {item.special_notes && <span>Notes: {item.special_notes}</span>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={resp.is_quoted}
                    onCheckedChange={(v) => updateResponse(item._id, { is_quoted: v })}
                  />
                  <Label className="text-sm">
                    {resp.is_quoted ? "Available — provide pricing" : "Unavailable"}
                  </Label>
                </div>

                {resp.is_quoted && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Your Price (SAR)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={resp.cost_price || ""}
                          onChange={(e) => updateResponse(item._id, { cost_price: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Lead Time (days)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={resp.lead_time_days}
                          onChange={(e) => updateResponse(item._id, { lead_time_days: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    </div>

                    {(item.flexibility === "OPEN_TO_EQUIVALENT" || item.flexibility === "OPEN_TO_ALTERNATIVES") && (
                      <div>
                        <Label>Offer Alternative Product (optional)</Label>
                        <Select
                          value={resp.alternative_product_id || "none"}
                          onValueChange={(v) => updateResponse(item._id, { alternative_product_id: v === "none" ? null : v })}
                        >
                          <SelectTrigger><SelectValue placeholder="No alternative" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No alternative</SelectItem>
                            {myProducts.map((p: any) => (
                              <SelectItem key={p._id} value={p._id}>{p.name} ({p.category})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Commercial notes and documents</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Attach quotation PDFs, technical sheets, or delivery terms for admin review.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAttachments([...attachments, emptyAttachment()])}>
              <Plus className="me-2 h-4 w-4" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Supplier Notes</Label>
              <Textarea value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} placeholder="Warranty, delivery schedule, substitutions, or payment notes…" />
            </div>
            {attachments.map((attachment) => (
              <div key={attachment.key} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[180px_1fr_1fr_auto]">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={attachment.document_type}
                    onValueChange={(v) => updateAttachment(attachment.key, { document_type: v as QuoteAttachmentDraft["document_type"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPPLIER_QUOTATION">Supplier Quotation</SelectItem>
                      <SelectItem value="COMMERCIAL_TERMS">Commercial Terms</SelectItem>
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
                  <Input value={attachment.notes} onChange={(e) => updateAttachment(attachment.key, { notes: e.target.value })} placeholder="Optional context for MWRD" />
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
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/supplier/rfqs")}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || (!!existingQuote && !isRevision)}>
            <Send className="w-4 h-4 me-2" />
            {submitting ? "Submitting…" : isRevision ? "Submit Revision" : "Submit Quote"}
          </Button>
        </div>
      </div>
    </SupplierLayout>
  );
};

export default SupplierRfqRespond;

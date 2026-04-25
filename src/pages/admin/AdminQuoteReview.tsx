import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import { calculateFinalPrice, calculatePriceWithVat } from "@/lib/margin";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, FileText, MessageSquare, Send } from "lucide-react";
import { VatBadge, formatSAR } from "@/components/shared/VatBadge";

const documentLabel: Record<string, string> = {
  SPECIFICATION: "Specification",
  PURCHASE_POLICY: "Purchase Policy",
  SUPPORTING_DOCUMENT: "Supporting Document",
  SUPPLIER_QUOTATION: "Supplier Quotation",
  COMMERCIAL_TERMS: "Commercial Terms",
  OTHER: "Other",
};

const AdminQuoteReview = () => {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const sendToClient = useMutation(api.quotes.sendToClient);
  const requestSupplierRevision = useMutation(api.quotes.requestSupplierRevision);

  const quoteData = useQuery(api.quotes.getForReview, quoteId ? { id: quoteId as any } : "skip");
  const loading = quoteData === undefined;

  const contractProductIds: any[] = (quoteData?.items ?? [])
    .map((item: any) => item.rfq_item?.product?._id)
    .filter((id: any): id is string => !!id);
  const contractsData = useQuery(
    api.contracts.findApplicable,
    quoteData && quoteData.supplier_id && quoteData.rfq?.client_id
      ? {
          supplier_id: quoteData.supplier_id as any,
          client_id: quoteData.rfq.client_id as any,
          product_ids: contractProductIds as any,
        }
      : "skip",
  );
  const contractPricing: Record<string, any> = (contractsData?.pricing as any) ?? {};
  const applicableContracts: any[] = contractsData?.contracts ?? [];

  const [margins, setMargins] = useState<Record<string, number>>({});
  const [revisionInstructions, setRevisionInstructions] = useState("");
  const [sending, setSending] = useState(false);
  const [requestingRevision, setRequestingRevision] = useState(false);

  useEffect(() => {
    if (!quoteData) return;
    const globalMargin = quoteData.marginSettings?.find((m: any) => m.type === "GLOBAL")?.margin_percent ?? 15;
    const catMargins: Record<string, number> = {};
    for (const m of quoteData.marginSettings ?? []) {
      if (m.type === "CATEGORY" && m.category) catMargins[m.category] = m.margin_percent;
    }
    const clientMargin = quoteData.rfq?.client_margin;

    const initMargins: Record<string, number> = {};
    for (const item of quoteData.items ?? []) {
      const category = item.rfq_item?.product?.category;
      let suggested = globalMargin;
      if (clientMargin != null && clientMargin >= 0) {
        suggested = clientMargin;
      } else if (category && catMargins[category] != null) {
        suggested = catMargins[category];
      }
      initMargins[item._id] = suggested;
    }
    setMargins(initMargins);
  }, [quoteData?._id]);

  const globalMargin = quoteData?.marginSettings?.find((m: any) => m.type === "GLOBAL")?.margin_percent ?? 15;
  const catMargins: Record<string, number> = {};
  for (const m of quoteData?.marginSettings ?? []) {
    if ((m as any).type === "CATEGORY" && (m as any).category) catMargins[(m as any).category] = (m as any).margin_percent;
  }
  const clientMargin = quoteData?.rfq?.client_margin;

  const getCalculated = (costPrice: number, marginPct: number) => {
    const finalPrice = calculateFinalPrice(costPrice, marginPct);
    const withVat = calculatePriceWithVat(finalPrice);
    return { finalPrice: Math.round(finalPrice * 100) / 100, withVat: Math.round(withVat * 100) / 100 };
  };

  const handleSendToClient = async () => {
    if (!quoteData) return;
    setSending(true);
    try {
      const itemsPayload = quoteData.items
        .filter((item: any) => item.is_quoted)
        .map((item: any) => {
          const margin = margins[item._id] ?? globalMargin;
          const costPrice = item.cost_price ?? 0;
          const { finalPrice, withVat } = getCalculated(costPrice, margin);
          return { id: item._id, margin_percent: margin, final_price_before_vat: finalPrice, final_price_with_vat: withVat };
        });
      await sendToClient({ id: quoteId as any, items: itemsPayload });
      toast.success("Quote sent to client");
      navigate("/admin/quotes/pending");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleRequestSupplierRevision = async () => {
    if (!quoteData || !revisionInstructions.trim()) {
      toast.error("Add instructions for the supplier");
      return;
    }
    setRequestingRevision(true);
    try {
      await requestSupplierRevision({ id: quoteId as any, message: revisionInstructions.trim() });
      toast.success("Revision request sent to supplier");
      navigate("/admin/quotes/pending");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setRequestingRevision(false);
    }
  };

  if (loading) {
    return <AdminLayout><div className="text-muted-foreground text-center py-20">Loading…</div></AdminLayout>;
  }

  if (!quoteData) {
    return <AdminLayout><div className="text-center py-20 text-muted-foreground">Quote not found.</div></AdminLayout>;
  }

  const items = quoteData.items ?? [];
  const attachments = quoteData.attachments ?? [];
  const revisionEvents = quoteData.revision_events ?? [];
  const productIds: string[] = items
    .map((item: any) => item.rfq_item?.product?._id)
    .filter((id: any): id is string => !!id);
  const canRequestSupplierRevision = ["PENDING_ADMIN", "CLIENT_REVISION_REQUESTED", "REVISION_SUBMITTED"].includes(quoteData.status);
  const canSendToClient = quoteData.status !== "SUPPLIER_REVISION_REQUESTED";

  const totalWithVat = items
    .filter((i: any) => i.is_quoted)
    .reduce((sum: number, i: any) => {
      const margin = margins[i._id] ?? globalMargin;
      const { withVat } = getCalculated(i.cost_price ?? 0, margin);
      return sum + withVat * (i.rfq_item?.quantity || 1);
    }, 0);

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/quotes/pending")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Review Quote</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span>Quote <span className="font-mono">{quoteId?.slice(0, 8)}</span></span>
              <span>•</span>
              <span>Supplier: {quoteData.supplier_public_id}</span>
              <span>•</span>
              <span>Client: {quoteData.rfq?.client_public_id}</span>
            </div>
          </div>
        </div>

        {(quoteData.supplier_notes || attachments.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Supplier context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quoteData.supplier_notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm font-medium">{quoteData.supplier_notes}</p>
                </div>
              )}
              {attachments.map((attachment: any) => (
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
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4 text-primary" />
                Revision timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {revisionEvents.map((event: any) => (
                <div key={event._id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{event.actor_role}</Badge>
                      <span className="text-xs text-muted-foreground">{event.event_type.replace(/_/g, " ")}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{event.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {applicableContracts.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Applicable contracts ({applicableContracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 text-sm space-y-1">
              {applicableContracts.map((c: any) => (
                <div key={c._id} className="flex justify-between gap-3">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {c.start_date}{c.end_date ? ` → ${c.end_date}` : ""}
                    {c.discount_percent != null ? ` · ${c.discount_percent}% discount` : ""}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {items.map((item: any, idx: number) => {
          const margin = margins[item._id] ?? globalMargin;
          const calc = item.is_quoted ? getCalculated(item.cost_price ?? 0, margin) : null;
          const itemName = item.rfq_item?.product?.name || item.rfq_item?.custom_item_description || "Custom Item";
          const category = item.rfq_item?.product?.category;
          const productId = item.rfq_item?.product?._id;
          const contractMatch = productId ? contractPricing[String(productId)] : null;

          let marginSource = "Global";
          if (clientMargin != null && clientMargin >= 0) marginSource = "Client";
          else if (category && catMargins[category] != null) marginSource = "Category";

          return (
            <Card key={item._id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Item {idx + 1}: {itemName}</CardTitle>
                  {!item.is_quoted && <Badge variant="destructive">Unavailable</Badge>}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  <span>Qty: {item.rfq_item?.quantity}</span>
                  {category && <span>Category: {category}</span>}
                  {item.alternative_product && <span className="text-primary">Alt: {item.alternative_product.name}</span>}
                </div>
              </CardHeader>
              {item.is_quoted && (
                <CardContent className="px-4 pb-4 space-y-3">
                  {contractMatch && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                      Contracted price for this product: <span className="font-medium">{formatSAR(contractMatch.price)}</span>
                      <span className="text-muted-foreground"> · {contractMatch.contract_name}</span>
                      {Math.abs((item.cost_price ?? 0) - contractMatch.price) > 0.01 && (
                        <span className="ms-2 text-amber-700">
                          Supplier quoted {formatSAR(item.cost_price ?? 0)} ({(((item.cost_price ?? 0) - contractMatch.price) >= 0 ? "+" : "")}{((((item.cost_price ?? 0) - contractMatch.price) / contractMatch.price) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Supplier Cost (SAR)</Label>
                      <p className="font-medium">{(item.cost_price ?? 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Lead Time</Label>
                      <p className="font-medium">{item.lead_time_days} days</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Margin % <span className="text-primary">({marginSource})</span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        value={margin}
                        onChange={(e) => setMargins((prev) => ({ ...prev, [item._id]: parseFloat(e.target.value) || 0 }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">Final <VatBadge /></Label>
                      <p className="font-bold text-lg text-primary">{formatSAR(calc?.withVat || 0)}</p>
                      <p className="text-xs text-muted-foreground">Before VAT: {formatSAR(calc?.finalPrice || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {canRequestSupplierRevision && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4 text-primary" />
                Request supplier revision
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Instructions</Label>
                <Textarea
                  value={revisionInstructions}
                  onChange={(e) => setRevisionInstructions(e.target.value)}
                  placeholder="Ask for revised prices, faster delivery, alternate product details, missing documents, or commercial clarification…"
                />
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleRequestSupplierRevision} disabled={requestingRevision}>
                  <MessageSquare className="me-2 h-4 w-4" />
                  {requestingRevision ? "Sending…" : "Send Revision Request"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">Total <VatBadge /></p>
              <p className="text-2xl font-bold text-primary">{formatSAR(totalWithVat)}</p>
            </div>
            <Button onClick={handleSendToClient} disabled={sending || !canSendToClient} size="lg">
              <Send className="w-4 h-4 me-2" />
              {quoteData.status === "SUPPLIER_REVISION_REQUESTED" ? "Waiting for Supplier" : sending ? "Sending…" : "Send to Client"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminQuoteReview;

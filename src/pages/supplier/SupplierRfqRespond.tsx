import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

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

const SupplierRfqRespond = () => {
  const { rfqId } = useParams();
  const navigate = useNavigate();
  const submitQuote = useMutation(api.quotes.submit);

  const rfqData = useQuery(api.rfqs.getAssigned, rfqId ? { rfq_id: rfqId as any } : "skip");
  const loading = rfqData === undefined;

  const [responses, setResponses] = useState<Record<string, ItemResponse>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!rfqData) return;
    const init: Record<string, ItemResponse> = {};
    for (const item of rfqData.items ?? []) {
      init[item._id] = {
        rfq_item_id: item._id,
        is_quoted: true,
        cost_price: 0,
        lead_time_days: 7,
        supplier_product_id: item.product_id ?? null,
        alternative_product_id: null,
      };
    }
    setResponses(init);
  }, [rfqData?._id]);

  const updateResponse = (itemId: string, updates: Partial<ItemResponse>) => {
    setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...updates } }));
  };

  const handleSubmit = async () => {
    if (!rfqId) return;
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
      await submitQuote({ rfq_id: rfqId as any, items });
      toast.success("Quote submitted for admin review");
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

  return (
    <SupplierLayout>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/supplier/rfqs")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Respond to RFQ</h1>
            <p className="text-muted-foreground text-sm mt-1">
              RFQ <span className="font-mono">{rfqId?.slice(0, 8)}</span> — Provide pricing for each item
            </p>
          </div>
        </div>

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

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/supplier/rfqs")}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <Send className="w-4 h-4 mr-2" />
            {submitting ? "Submitting…" : "Submit Quote"}
          </Button>
        </div>
      </div>
    </SupplierLayout>
  );
};

export default SupplierRfqRespond;

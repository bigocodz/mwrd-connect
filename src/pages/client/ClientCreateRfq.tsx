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
import { Plus, Trash2, ShoppingBag, AlertTriangle, Loader2 } from "lucide-react";

interface RfqItemDraft {
  key: string;
  product_id: string | null;
  custom_item_description: string;
  quantity: number;
  flexibility: "EXACT_MATCH" | "OPEN_TO_EQUIVALENT" | "OPEN_TO_ALTERNATIVES";
  special_notes: string;
}

const emptyItem = (): RfqItemDraft => ({
  key: crypto.randomUUID(),
  product_id: null,
  custom_item_description: "",
  quantity: 1,
  flexibility: "EXACT_MATCH",
  special_notes: "",
});

const ClientCreateRfq = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const createRfq = useMutation(api.rfqs.create);

  const productsData = useQuery(api.products.listApproved);
  const loadingProducts = productsData === undefined;
  const products = productsData ?? [];

  const [items, setItems] = useState<RfqItemDraft[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isFrozen = profile?.status === "FROZEN";

  const updateItem = (key: string, updates: Partial<RfqItemDraft>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...updates } : i)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
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

    setSubmitting(true);
    try {
      await createRfq({
        notes: notes || undefined,
        expiry_date: expiryDate || undefined,
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
          <p className="text-muted-foreground mt-1">Select products or describe custom items you need.</p>
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

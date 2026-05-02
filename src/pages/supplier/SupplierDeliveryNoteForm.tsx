import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, ArrowLeft } from "lucide-react";

type LineDraft = {
  quote_item_id?: Id<"quote_items">;
  rfq_item_id?: Id<"rfq_items">;
  description: string;
  ordered_qty: number;
  shipped_qty: number;
  notes: string;
};

const SupplierDeliveryNoteForm = () => {
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderId = params.get("order") as Id<"orders"> | null;

  const order = useQuery(
    api.orders.getById,
    orderId ? { id: orderId } : "skip",
  );

  const create = useMutation(api.deliveryNotes.create);

  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [issueNow, setIssueNow] = useState(true);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Hydrate lines from the order's quote items.
  useEffect(() => {
    if (!order) return;
    if (lines.length > 0) return;
    setCarrier((order.carrier as string) ?? "");
    setTrackingNumber((order.tracking_number as string) ?? "");
    const initial: LineDraft[] = (order.items ?? [])
      .filter((it: any) => it.is_quoted)
      .map((it: any) => {
        const orderedQty = it.rfq_item?.quantity ?? 1;
        const desc =
          it.rfq_item?.product?.name ??
          it.rfq_item?.custom_item_description ??
          tr("Item");
        return {
          quote_item_id: it._id as Id<"quote_items">,
          rfq_item_id: (it.rfq_item?._id as Id<"rfq_items">) ?? undefined,
          description: desc,
          ordered_qty: orderedQty,
          shipped_qty: orderedQty,
          notes: "",
        };
      });
    setLines(initial);
  }, [order, lines.length, tr]);

  const setLine = (idx: number, patch: Partial<LineDraft>) =>
    setLines((arr) => arr.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const submit = async () => {
    if (!orderId) return;
    if (lines.length === 0) {
      toast.error(tr("No lines to ship"));
      return;
    }
    for (const line of lines) {
      if (line.shipped_qty < 0) {
        toast.error(tr("Shipped qty cannot be negative"));
        return;
      }
      if (line.shipped_qty > line.ordered_qty) {
        toast.error(tr("Shipped qty cannot exceed ordered qty"));
        return;
      }
    }
    setSubmitting(true);
    try {
      await create({
        order_id: orderId,
        carrier: carrier.trim() || undefined,
        tracking_number: trackingNumber.trim() || undefined,
        expected_delivery_at: expectedAt
          ? new Date(expectedAt).getTime()
          : undefined,
        notes: notes.trim() || undefined,
        issue_now: issueNow,
        lines: lines.map((l) => ({
          quote_item_id: l.quote_item_id,
          rfq_item_id: l.rfq_item_id,
          description: l.description,
          ordered_qty: l.ordered_qty,
          shipped_qty: l.shipped_qty,
          notes: l.notes.trim() || undefined,
        })),
      });
      toast.success(
        issueNow
          ? tr("Delivery note issued")
          : tr("Delivery note saved as draft"),
      );
      navigate(`/supplier/orders/${orderId}`);
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SupplierLayout>
      <Link
        to={orderId ? `/supplier/orders/${orderId}` : "/supplier/orders"}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center mb-3"
      >
        <ArrowLeft className="w-4 h-4 me-1" /> {tr("Back to order")}
      </Link>

      <h1 className="font-display text-3xl font-bold text-foreground mb-6">
        {tr("New Delivery Note")}
      </h1>

      {!orderId ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {tr("No order selected.")}
          </CardContent>
        </Card>
      ) : order === undefined ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !order ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {tr("Order not found")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline">
                {tr("Order")} {String(order._id).slice(0, 8)}…
              </Badge>
              <Badge variant="outline">{order.status}</Badge>
              <span className="text-sm text-muted-foreground">
                {tr("Client")} {(order as any).client_public_id}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("Carrier")}</Label>
                <Input
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder={tr("e.g., Aramex, SMSA")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Tracking number")}</Label>
                <Input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Expected delivery")}</Label>
                <Input
                  type="date"
                  value={expectedAt}
                  onChange={(e) => setExpectedAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{tr("Notes (optional)")}</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{tr("Lines shipped")}</Label>
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-end border border-border rounded-md p-2.5"
                >
                  <div className="col-span-5 space-y-0.5">
                    <p className="text-sm font-medium line-clamp-1">
                      {line.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tr("Ordered")}: {line.ordered_qty}
                    </p>
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">{tr("Shipped qty")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={line.ordered_qty}
                      value={line.shipped_qty}
                      onChange={(e) =>
                        setLine(idx, {
                          shipped_qty: Math.max(
                            0,
                            Math.min(
                              line.ordered_qty,
                              parseInt(e.target.value) || 0,
                            ),
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs">{tr("Note")}</Label>
                    <Input
                      value={line.notes}
                      onChange={(e) => setLine(idx, { notes: e.target.value })}
                      placeholder={tr("Optional")}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                id="issue_now"
                type="checkbox"
                checked={issueNow}
                onChange={(e) => setIssueNow(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="issue_now" className="cursor-pointer">
                {tr("Issue now (notifies client and updates order to DISPATCHED)")}
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate(-1)}>
                {tr("Cancel")}
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : null}
                {issueNow ? tr("Issue") : tr("Save as draft")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </SupplierLayout>
  );
};

export default SupplierDeliveryNoteForm;

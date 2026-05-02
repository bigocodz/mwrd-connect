import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Send, X, Check, Clock, Inbox } from "lucide-react";

type DraftLine = {
  _id: Id<"quote_items">;
  is_quoted: boolean;
  cost_price?: number;
  lead_time_days?: number;
  master_product_id?: Id<"master_products">;
  pack_type_code?: string;
  master?: { name_en: string; name_ar: string } | null;
  rfq_item?: { quantity: number; custom_item_description?: string } | null;
};

type Draft = {
  _id: Id<"quotes">;
  rfq_id: Id<"rfqs">;
  rfq_client_public_id: string;
  rfq_required_by?: string;
  review_until?: number;
  items: DraftLine[];
};

const formatCountdown = (ms: number, tr: (s: string) => string) => {
  if (ms <= 0) return tr("Releasing…");
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remainingM = m % 60;
    return `${h}h ${remainingM}m`;
  }
  return `${m}m ${s.toString().padStart(2, "0")}s`;
};

const SupplierAutoQuoteQueue = () => {
  const { tr, lang } = useLanguage();
  const data = useQuery(api.autoQuote.myAutoDraftQueue) as Draft[] | undefined;
  const sendNow = useMutation(api.autoQuote.sendDraftNow);
  const decline = useMutation(api.autoQuote.declineDraft);
  const editLine = useMutation(api.autoQuote.editDraftLine);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [declineOpen, setDeclineOpen] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<Id<"quotes"> | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Inline cost edits
  const [editing, setEditing] = useState<Record<string, { cost: string; lead: string }>>({});

  const drafts = data ?? [];
  const loading = data === undefined;

  const handleSendNow = async (id: Id<"quotes">) => {
    setBusy(true);
    try {
      await sendNow({ quote_id: id });
      toast.success(tr("Sent for admin review"));
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const openDecline = (id: Id<"quotes">) => {
    setActiveDraftId(id);
    setDeclineReason("");
    setDeclineOpen(true);
  };

  const submitDecline = async () => {
    if (!activeDraftId) return;
    setBusy(true);
    try {
      await decline({
        quote_id: activeDraftId,
        reason: declineReason.trim() || undefined,
      });
      toast.success(tr("Draft declined"));
      setDeclineOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const saveLine = async (
    quoteId: Id<"quotes">,
    itemId: Id<"quote_items">,
  ) => {
    const draft = editing[itemId];
    if (!draft) return;
    setBusy(true);
    try {
      await editLine({
        quote_id: quoteId,
        item_id: itemId,
        cost_price: draft.cost ? Number(draft.cost) : undefined,
        lead_time_days: draft.lead ? Number(draft.lead) : undefined,
      });
      toast.success(tr("Line updated"));
      setEditing((m) => {
        const { [itemId]: _, ...rest } = m;
        return rest;
      });
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const toggleLineQuoted = async (
    quoteId: Id<"quotes">,
    itemId: Id<"quote_items">,
    next: boolean,
  ) => {
    setBusy(true);
    try {
      await editLine({ quote_id: quoteId, item_id: itemId, is_quoted: next });
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SupplierLayout>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground">
          {tr("Auto-Quote Queue")}
        </h1>
        <Badge variant="outline">
          {tr("{n} drafts", { n: drafts.length })}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {tr(
          "Drafts auto-generated for RFQs that match offers you've enabled for auto-quote. They're invisible to the client until your review window expires or you send/decline.",
        )}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{tr("No drafts in your review window.")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((d) => {
            const remaining = (d.review_until ?? 0) - now;
            return (
              <Card key={d._id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {tr("Client")}{" "}
                        <span className="font-mono">
                          {d.rfq_client_public_id}
                        </span>
                        {d.rfq_required_by ? (
                          <>
                            {" · "}
                            {tr("Need by")} {d.rfq_required_by}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <Badge
                      variant={remaining < 60_000 ? "destructive" : "outline"}
                      className="flex items-center gap-1"
                    >
                      <Clock className="w-3 h-3" />
                      {formatCountdown(remaining, tr)}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {d.items.map((line) => {
                      const editingState = editing[line._id];
                      const masterName = line.master
                        ? lang === "ar"
                          ? line.master.name_ar
                          : line.master.name_en
                        : line.rfq_item?.custom_item_description ?? tr("Item");
                      return (
                        <div
                          key={line._id}
                          className={`grid grid-cols-12 gap-2 items-end border border-border rounded-md p-2.5 ${line.is_quoted ? "" : "opacity-60"}`}
                        >
                          <div className="col-span-4 space-y-0.5">
                            <p className="text-sm font-medium line-clamp-1">
                              {masterName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tr("Qty")}: {line.rfq_item?.quantity ?? "—"}
                              {line.pack_type_code
                                ? ` · ${line.pack_type_code}`
                                : ""}
                            </p>
                          </div>
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">{tr("Cost / pack")}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={editingState?.cost ?? line.cost_price ?? ""}
                              onChange={(e) =>
                                setEditing((m) => ({
                                  ...m,
                                  [line._id]: {
                                    cost: e.target.value,
                                    lead:
                                      m[line._id]?.lead ??
                                      String(line.lead_time_days ?? ""),
                                  },
                                }))
                              }
                              disabled={!line.is_quoted}
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">{tr("Lead (d)")}</Label>
                            <Input
                              type="number"
                              min={0}
                              value={editingState?.lead ?? line.lead_time_days ?? ""}
                              onChange={(e) =>
                                setEditing((m) => ({
                                  ...m,
                                  [line._id]: {
                                    cost:
                                      m[line._id]?.cost ??
                                      String(line.cost_price ?? ""),
                                    lead: e.target.value,
                                  },
                                }))
                              }
                              disabled={!line.is_quoted}
                            />
                          </div>
                          <div className="col-span-3 flex justify-end gap-1">
                            {editingState ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => saveLine(d._id, line._id)}
                                disabled={busy}
                              >
                                <Check className="w-3.5 h-3.5 me-1" />
                                {tr("Save")}
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                toggleLineQuoted(d._id, line._id, !line.is_quoted)
                              }
                              disabled={busy}
                            >
                              {line.is_quoted ? tr("Skip") : tr("Quote")}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      variant="ghost"
                      onClick={() => openDecline(d._id)}
                      disabled={busy}
                    >
                      <X className="w-4 h-4 me-1.5" />
                      {tr("Decline")}
                    </Button>
                    <Button onClick={() => handleSendNow(d._id)} disabled={busy}>
                      <Send className="w-4 h-4 me-1.5" />
                      {tr("Send now")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Decline auto-draft")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {tr(
                "The client never sees this draft. The RFQ continues with other suppliers.",
              )}
            </p>
            <div className="space-y-1.5">
              <Label>{tr("Reason (internal, optional)")}</Label>
              <Textarea
                rows={2}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>
              {tr("Cancel")}
            </Button>
            <Button variant="destructive" onClick={submitDecline} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : null}
              {tr("Decline")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SupplierLayout>
  );
};

export default SupplierAutoQuoteQueue;

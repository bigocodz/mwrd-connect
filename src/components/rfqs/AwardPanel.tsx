import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "@cvx/api";
import { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatSAR } from "@/components/shared/VatBadge";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Trophy } from "lucide-react";

interface AwardPanelProps {
  comparison: any;
  rfqId: Id<"rfqs">;
}

type AwardMode = "FULL_BASKET" | "PER_ITEM";

/**
 * Lets a client award an RFQ either as a single supplier basket or split across
 * suppliers per line item (Phase 4 — split CPO).
 *
 * Selection state: per-rfq-item picked quote_id (or "skip" to drop the line).
 * On submit, calls orders.createFromAward; backend creates the parent CPO and
 * one supplier order per supplier with shared transaction_ref.
 */
export const AwardPanel = ({ comparison, rfqId }: AwardPanelProps) => {
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const createFromAward = useMutation(api.orders.createFromAward);

  const items = comparison.items ?? [];
  const quotes = comparison.quotes ?? [];

  // Default mode: PER_ITEM if multiple suppliers have at least one quoted line.
  const initialMode: AwardMode = useMemo(() => {
    if (quotes.length <= 1) return "FULL_BASKET";
    const suppliersByItem = items.map(
      (it: any) =>
        new Set(
          quotes
            .filter((q: any) =>
              q.items?.find(
                (qi: any) => qi.rfq_item_id === it._id && qi.is_quoted,
              ),
            )
            .map((q: any) => q._id),
        ),
    );
    const hasOverlap = suppliersByItem.some((s: Set<string>) => s.size > 1);
    return hasOverlap ? "PER_ITEM" : "FULL_BASKET";
  }, [items, quotes]);

  const [mode, setMode] = useState<AwardMode>(initialMode);
  const [submitting, setSubmitting] = useState(false);
  // For FULL_BASKET, this is the chosen supplier quote id.
  const [basketQuoteId, setBasketQuoteId] = useState<string>(
    quotes.find((q: any) => q._id === comparison.best_quote_id)?._id ??
      quotes[0]?._id ??
      "",
  );
  // For PER_ITEM, map rfq_item_id → quote_id (or "" to skip).
  const [perItemSelection, setPerItemSelection] = useState<Record<string, string>>(
    () => {
      const init: Record<string, string> = {};
      for (const it of items) {
        // Default to the cheapest-quoted line.
        const candidates = quotes
          .map((q: any) => {
            const qi = q.items?.find(
              (candidate: any) =>
                candidate.rfq_item_id === it._id && candidate.is_quoted,
            );
            return qi
              ? { quote_id: q._id, price: qi.final_price_with_vat ?? Infinity }
              : null;
          })
          .filter(Boolean) as { quote_id: string; price: number }[];
        candidates.sort((a, b) => a.price - b.price);
        init[it._id] = candidates[0]?.quote_id ?? "";
      }
      return init;
    },
  );

  const computeAwardLines = () => {
    if (mode === "FULL_BASKET") {
      const quote = quotes.find((q: any) => q._id === basketQuoteId);
      if (!quote) return [];
      return items
        .map((it: any) => {
          const qi = quote.items?.find(
            (c: any) => c.rfq_item_id === it._id && c.is_quoted,
          );
          if (!qi) return null;
          return {
            rfq_item_id: it._id,
            quote_id: quote._id,
            quantity: it.quantity,
          };
        })
        .filter(Boolean) as {
          rfq_item_id: string;
          quote_id: string;
          quantity: number;
        }[];
    }
    return Object.entries(perItemSelection)
      .filter(([, quoteId]) => quoteId)
      .map(([rfqItemId, quoteId]) => {
        const item = items.find((i: any) => i._id === rfqItemId);
        return {
          rfq_item_id: rfqItemId,
          quote_id: quoteId,
          quantity: item?.quantity ?? 1,
        };
      });
  };

  const projectedTotal = useMemo(() => {
    let totalWithVat = 0;
    if (mode === "FULL_BASKET") {
      const quote = quotes.find((q: any) => q._id === basketQuoteId);
      if (!quote) return 0;
      for (const it of items) {
        const qi = quote.items?.find(
          (c: any) => c.rfq_item_id === it._id && c.is_quoted,
        );
        if (!qi) continue;
        totalWithVat += (qi.final_price_with_vat ?? 0) * (it.quantity ?? 1);
      }
    } else {
      for (const it of items) {
        const quoteId = perItemSelection[it._id];
        if (!quoteId) continue;
        const quote = quotes.find((q: any) => q._id === quoteId);
        const qi = quote?.items?.find(
          (c: any) => c.rfq_item_id === it._id && c.is_quoted,
        );
        if (!qi) continue;
        totalWithVat += (qi.final_price_with_vat ?? 0) * (it.quantity ?? 1);
      }
    }
    return totalWithVat;
  }, [mode, basketQuoteId, perItemSelection, items, quotes]);

  const supplierCount = useMemo(() => {
    if (mode === "FULL_BASKET") return basketQuoteId ? 1 : 0;
    const set = new Set<string>();
    for (const quoteId of Object.values(perItemSelection)) {
      if (!quoteId) continue;
      const quote = quotes.find((q: any) => q._id === quoteId);
      if (quote?.supplier_id) set.add(quote.supplier_id);
    }
    return set.size;
  }, [mode, basketQuoteId, perItemSelection, quotes]);

  const submit = async () => {
    const lines = computeAwardLines();
    if (lines.length === 0) {
      toast.error(tr("Pick at least one line to award"));
      return;
    }
    setSubmitting(true);
    try {
      const result = await createFromAward({
        rfq_id: rfqId,
        award_mode: mode,
        lines: lines.map((l) => ({
          rfq_item_id: l.rfq_item_id as Id<"rfq_items">,
          quote_id: l.quote_id as Id<"quotes">,
          quantity: l.quantity,
        })),
      });
      toast.success(
        tr("Awarded — {n} order(s) created", {
          n: result.order_ids.length,
        }),
      );
      navigate("/client/orders");
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (quotes.length === 0) return null;
  // Only show the award panel for an RFQ that's still open.
  if (comparison.rfq?.status === "CLOSED") return null;

  const supplierLabel = (q: any) =>
    q.supplier_company_name || q.supplier_public_id;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("Award this RFQ")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as AwardMode)}
          className="grid grid-cols-1 md:grid-cols-2 gap-2"
        >
          <Label
            htmlFor="award-full"
            className={`cursor-pointer rounded-md border p-3 ${mode === "FULL_BASKET" ? "border-primary" : "border-border"}`}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="award-full" value="FULL_BASKET" />
              <div>
                <p className="font-medium">{tr("Full basket")}</p>
                <p className="text-xs text-muted-foreground">
                  {tr("One supplier wins every line.")}
                </p>
              </div>
            </div>
          </Label>
          <Label
            htmlFor="award-split"
            className={`cursor-pointer rounded-md border p-3 ${mode === "PER_ITEM" ? "border-primary" : "border-border"}`}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="award-split" value="PER_ITEM" />
              <div>
                <p className="font-medium">{tr("Per-item")}</p>
                <p className="text-xs text-muted-foreground">
                  {tr("Award each line to the best supplier — splits the order.")}
                </p>
              </div>
            </div>
          </Label>
        </RadioGroup>

        {mode === "FULL_BASKET" ? (
          <div>
            <Label className="text-sm">{tr("Awarded supplier")}</Label>
            <RadioGroup
              value={basketQuoteId}
              onValueChange={setBasketQuoteId}
              className="mt-2 grid gap-2"
            >
              {quotes.map((q: any) => {
                const total = q.totalWithVat || q.totalCost || 0;
                const isBest = q._id === comparison.best_quote_id;
                const fullCoverage = q.coverage === 100;
                return (
                  <Label
                    key={q._id}
                    htmlFor={`basket-${q._id}`}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 ${basketQuoteId === q._id ? "border-primary" : "border-border"} ${!fullCoverage ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        id={`basket-${q._id}`}
                        value={q._id}
                        disabled={!fullCoverage}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{supplierLabel(q)}</span>
                          {isBest && (
                            <Badge>
                              <Trophy className="me-1 h-3 w-3" /> {tr("Best")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {q.coverage}% {tr("coverage")} ·{" "}
                          {q.avgLeadTime
                            ? tr("{n} days", { n: q.avgLeadTime })
                            : "—"}
                          {!fullCoverage && (
                            <span className="ms-1 text-destructive">
                              {tr("· not full basket eligible")}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold">
                      {total > 0 ? formatSAR(total) : "—"}
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it: any) => {
              const candidates = quotes
                .map((q: any) => {
                  const qi = q.items?.find(
                    (c: any) =>
                      c.rfq_item_id === it._id && c.is_quoted,
                  );
                  return qi ? { quote: q, qi } : null;
                })
                .filter(Boolean) as { quote: any; qi: any }[];

              return (
                <div key={it._id} className="rounded-md border border-border p-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">
                      {it.product?.name ||
                        it.master?.name_en ||
                        it.custom_item_description ||
                        tr("Item")}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {tr("Qty")} {it.quantity}
                    </span>
                  </div>
                  {candidates.length === 0 ? (
                    <p className="text-sm text-destructive">
                      {tr("No supplier quoted this line.")}
                    </p>
                  ) : (
                    <RadioGroup
                      value={perItemSelection[it._id] ?? ""}
                      onValueChange={(v) =>
                        setPerItemSelection((m) => ({ ...m, [it._id]: v }))
                      }
                      className="grid gap-1.5"
                    >
                      <Label
                        htmlFor={`skip-${it._id}`}
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded p-1.5 text-sm ${perItemSelection[it._id] === "" ? "bg-muted" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem
                            id={`skip-${it._id}`}
                            value=""
                          />
                          <span className="text-muted-foreground">
                            {tr("Skip this line")}
                          </span>
                        </div>
                      </Label>
                      {candidates.map(({ quote, qi }) => {
                        const total =
                          (qi.final_price_with_vat ?? 0) * (it.quantity ?? 1);
                        return (
                          <Label
                            key={quote._id}
                            htmlFor={`pl-${it._id}-${quote._id}`}
                            className={`flex cursor-pointer items-center justify-between gap-2 rounded p-1.5 text-sm ${perItemSelection[it._id] === quote._id ? "bg-primary/5" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem
                                id={`pl-${it._id}-${quote._id}`}
                                value={quote._id}
                              />
                              <span>{supplierLabel(quote)}</span>
                              <span className="text-xs text-muted-foreground">
                                {qi.lead_time_days
                                  ? tr("{n}d", { n: qi.lead_time_days })
                                  : ""}
                              </span>
                            </div>
                            <span className="font-mono">{formatSAR(total)}</span>
                          </Label>
                        );
                      })}
                    </RadioGroup>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="text-sm">
            <p className="text-muted-foreground">
              {tr("Suppliers")}: <span className="font-semibold text-foreground">{supplierCount}</span>
              {"  ·  "}
              {tr("Total")}{" "}
              <span className="font-semibold text-foreground">
                {projectedTotal > 0 ? formatSAR(projectedTotal) : "—"}
              </span>
            </p>
          </div>
          <Button onClick={submit} disabled={submitting || supplierCount === 0}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : null}
            {tr("Award & create order(s)")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import type { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatSAR } from "@/components/shared/VatBadge";

type AdjustmentType = "CREDIT" | "DEBIT";

interface InvoiceAdjustmentDialogProps {
  invoice: {
    _id: Id<"client_invoices">;
    invoice_number: string;
    total_amount: number;
    status: string;
    zatca_status?: string;
  };
  type: AdjustmentType;
  trigger: React.ReactNode;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_TONE: Record<string, string> = {
  CLEARED: "bg-green-100 text-green-800",
  PENDING_CLEARANCE: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-800",
  VOID: "bg-zinc-100 text-zinc-700",
};

/**
 * Dialog for issuing a credit or debit note against a client invoice
 * (PRD §8.1.4). Opens prior adjustments inline so admin doesn't double-issue.
 */
export const InvoiceAdjustmentDialog = ({
  invoice,
  type,
  trigger,
}: InvoiceAdjustmentDialogProps) => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";
  const [open, setOpen] = useState(false);

  const existing = useQuery(
    api.clientInvoiceAdjustments.listForInvoice,
    open ? { invoice_id: invoice._id } : "skip",
  ) as any[] | undefined;

  const create = useMutation(api.clientInvoiceAdjustments.create);
  const voidAdj = useMutation(api.clientInvoiceAdjustments.voidAdjustment);

  const [issueDate, setIssueDate] = useState(todayISO());
  const [subtotal, setSubtotal] = useState("");
  const [vatRate, setVatRate] = useState<"15" | "0">("15");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setIssueDate(todayISO());
      setSubtotal("");
      setVatRate("15");
      setReason("");
      setNotes("");
    }
  }, [open]);

  const subtotalNum = Number(subtotal) || 0;
  const vatAmount = vatRate === "15" ? +(subtotalNum * 0.15).toFixed(2) : 0;
  const total = +(subtotalNum + vatAmount).toFixed(2);

  const priorCredit = (existing ?? [])
    .filter((a) => a.type === "CREDIT" && a.status !== "VOID")
    .reduce((s, a) => s + (a.total_amount ?? 0), 0);

  const handleSubmit = async () => {
    if (!subtotal || subtotalNum <= 0) {
      toast.error(tr("Subtotal must be greater than zero"));
      return;
    }
    if (!reason.trim()) {
      toast.error(tr("Reason is required"));
      return;
    }
    setBusy(true);
    try {
      await create({
        invoice_id: invoice._id,
        type,
        issue_date: issueDate,
        subtotal: subtotalNum,
        vat_amount: vatAmount,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
      toast.success(
        type === "CREDIT" ? tr("Credit note issued") : tr("Debit note issued"),
      );
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleVoid = async (adjId: Id<"client_invoice_adjustments">) => {
    const reason = prompt(tr("Void reason?")) ?? "";
    if (!reason.trim()) return;
    try {
      await voidAdj({ id: adjId, reason });
      toast.success(tr("Adjustment voided"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    }
  };

  const titleKey =
    type === "CREDIT" ? "Issue credit note" : "Issue debit note";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tr(titleKey)}</DialogTitle>
          <DialogDescription>
            {type === "CREDIT"
              ? tr("Reduces what the client owes. Cleared through Wafeq for ZATCA.")
              : tr("Adds an additional charge. Cleared through Wafeq for ZATCA.")}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {tr("Original invoice")}:{" "}
              <span className="font-mono">{invoice.invoice_number}</span>
            </span>
            <span>
              {tr("Total")}: <span className="font-medium">{formatSAR(invoice.total_amount)}</span>
            </span>
            {priorCredit > 0 && (
              <span>
                {tr("Already credited")}: <span className="font-medium">{formatSAR(priorCredit)}</span>
              </span>
            )}
          </div>
        </div>

        {existing && existing.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {tr("Existing adjustments")}
            </p>
            <ul className="space-y-1.5">
              {existing.map((a: any) => (
                <li
                  key={a._id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {a.type}
                    </Badge>
                    <span className="font-mono">{a.adjustment_number}</span>
                    <span className="text-muted-foreground">
                      {new Date(a._creationTime).toLocaleDateString(locale)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatSAR(a.total_amount)}</span>
                    <Badge variant="outline" className={STATUS_TONE[a.status] ?? ""}>
                      {a.status}
                    </Badge>
                    {a.status !== "VOID" && a.status !== "CLEARED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => handleVoid(a._id)}
                      >
                        {tr("Void")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{tr("Issue date")}</Label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Subtotal (SAR)")} *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={subtotal}
              onChange={(e) => setSubtotal(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("VAT")}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={vatRate === "15" ? "default" : "outline"}
                onClick={() => setVatRate("15")}
              >
                15%
              </Button>
              <Button
                type="button"
                size="sm"
                variant={vatRate === "0" ? "default" : "outline"}
                onClick={() => setVatRate("0")}
              >
                {tr("Zero-rated")}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Total")}</Label>
            <Input value={formatSAR(total)} disabled className="bg-muted" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{tr("Reason")} *</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              type === "CREDIT"
                ? tr("e.g. Quantity returned, post-delivery discount")
                : tr("e.g. Late fee, additional service")
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>{tr("Notes")}</Label>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tr("Internal context (optional)")}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {tr("Cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {tr(titleKey)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

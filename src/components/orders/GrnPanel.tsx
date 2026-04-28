import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import type { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Upload01, ImagePlus, Trash01 } from "@untitledui/icons";
import { DocumentsDialog } from "@/components/admin/DocumentsDialog";
import { DualDate } from "@/components/shared/DualDate";

type Role = "CLIENT" | "SUPPLIER" | "ADMIN";

type Condition = "GOOD" | "DAMAGED" | "SHORT_SHIPPED" | "WRONG_ITEM";

const STATUS_TONE: Record<string, string> = {
  CONFIRMED: "bg-green-100 text-green-800",
  DISPUTED: "bg-red-100 text-red-800",
  CLOSED: "bg-zinc-100 text-zinc-700",
  DRAFT: "bg-amber-100 text-amber-800",
};

const CONDITION_TONE: Record<Condition, string> = {
  GOOD: "bg-green-100 text-green-800",
  DAMAGED: "bg-red-100 text-red-800",
  SHORT_SHIPPED: "bg-amber-100 text-amber-800",
  WRONG_ITEM: "bg-red-100 text-red-800",
};

interface OrderLine {
  _id: Id<"quote_items">;
  rfq_item_id?: Id<"rfq_items">;
  rfq_item?: {
    quantity?: number;
    product?: { name?: string };
    custom_item_description?: string;
  };
  is_quoted?: boolean;
}

interface GrnPanelProps {
  orderId: string;
  orderStatus: string;
  role: Role;
  /** Quoted line items from the order — drives the receiving form */
  items: OrderLine[];
}

interface DraftLine {
  quote_item_id?: Id<"quote_items">;
  rfq_item_id?: Id<"rfq_items">;
  description: string;
  ordered_qty: number;
  received_qty: string; // string for input control
  condition: Condition;
  notes: string;
}

/**
 * Goods Receipt Notes panel (PRD §6.10). Slotted onto the order detail
 * view; clients record receipts here, suppliers see read-only status,
 * admins see resolution actions for disputed GRNs.
 */
export const GrnPanel = ({ orderId, orderStatus, role, items }: GrnPanelProps) => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";

  const grns = useQuery(api.grn.listForOrder, { order_id: orderId as any }) as any[] | undefined;
  const create = useMutation(api.grn.create);
  const generateUploadUrl = useMutation(api.grn.generateUploadUrl);
  const resolveDiscrepancy = useMutation(api.grn.resolveDiscrepancy);

  const canRecord =
    role === "CLIENT" && ["DISPATCHED", "DELIVERED", "COMPLETED"].includes(orderStatus);

  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftLine[]>([]);
  const [discrepancySummary, setDiscrepancySummary] = useState("");
  const [grnNotes, setGrnNotes] = useState("");
  const [photoIds, setPhotoIds] = useState<Id<"_storage">[]>([]);
  const [busy, setBusy] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<any | null>(null);
  const [resolution, setResolution] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate drafts when the dialog opens — pre-fill received_qty=ordered with
  // GOOD condition, so the happy path is one click for the client.
  useEffect(() => {
    if (!open) return;
    const quoted = items.filter((i) => i.is_quoted !== false);
    setDrafts(
      quoted.map((it) => ({
        quote_item_id: it._id,
        rfq_item_id: it.rfq_item_id,
        description:
          it.rfq_item?.product?.name || it.rfq_item?.custom_item_description || "—",
        ordered_qty: it.rfq_item?.quantity ?? 1,
        received_qty: String(it.rfq_item?.quantity ?? 1),
        condition: "GOOD" as Condition,
        notes: "",
      })),
    );
    setDiscrepancySummary("");
    setGrnNotes("");
    setPhotoIds([]);
  }, [open, items]);

  const willHaveDiscrepancy = useMemo(
    () =>
      drafts.some(
        (d) =>
          d.condition !== "GOOD" || Number(d.received_qty) < d.ordered_qty,
      ),
    [drafts],
  );

  const handlePhotoUpload = async (file: File) => {
    setBusy(true);
    try {
      const url = await generateUploadUrl({});
      const res = await fetch(url, { method: "POST", body: file });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: string };
      setPhotoIds((ids) => [...ids, storageId as any]);
    } catch (err: any) {
      toast.error(err.message || tr("Upload failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (drafts.length === 0) {
      toast.error(tr("At least one line is required"));
      return;
    }
    for (const d of drafts) {
      const qty = Number(d.received_qty);
      if (!Number.isFinite(qty) || qty < 0) {
        toast.error(tr("Received quantity must be a non-negative number"));
        return;
      }
    }
    if (willHaveDiscrepancy && !discrepancySummary.trim()) {
      toast.error(tr("Describe the discrepancy so MWRD can investigate"));
      return;
    }
    setBusy(true);
    try {
      await create({
        order_id: orderId as any,
        notes: grnNotes.trim() || undefined,
        photo_storage_ids: photoIds.length ? photoIds : undefined,
        discrepancy_summary: willHaveDiscrepancy
          ? discrepancySummary.trim()
          : undefined,
        lines: drafts.map((d) => ({
          quote_item_id: d.quote_item_id,
          rfq_item_id: d.rfq_item_id,
          description: d.description,
          ordered_qty: d.ordered_qty,
          received_qty: Number(d.received_qty),
          condition: d.condition,
          notes: d.notes.trim() || undefined,
        })),
      });
      toast.success(
        willHaveDiscrepancy
          ? tr("Receipt recorded — discrepancy flagged for MWRD")
          : tr("Receipt recorded"),
      );
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    if (!resolution.trim()) {
      toast.error(tr("Resolution note is required"));
      return;
    }
    setBusy(true);
    try {
      await resolveDiscrepancy({
        id: resolveTarget._id,
        resolution: resolution.trim(),
      });
      toast.success(tr("Discrepancy resolved"));
      setResolveTarget(null);
      setResolution("");
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>{tr("Goods receipt")}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {tr("Record what was actually received. Multiple receipts are supported for partial deliveries.")}
          </p>
        </div>
        {canRecord && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 me-1.5" /> {tr("Record receipt")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {grns === undefined ? (
          <p className="text-sm text-muted-foreground">{tr("Loading…")}</p>
        ) : grns.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {role === "CLIENT" && canRecord
              ? tr("No receipts yet. Click Record receipt to log delivery.")
              : tr("No receipts have been recorded for this order yet.")}
          </p>
        ) : (
          <div className="space-y-3">
            {grns.map((g: any) => (
              <div key={g._id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{g.grn_number}</span>
                      <Badge variant="outline" className={STATUS_TONE[g.status] ?? ""}>
                        {tr(g.status)}
                      </Badge>
                      {g.has_discrepancy && (
                        <Badge variant="outline" className="bg-red-100 text-red-800">
                          {tr("Discrepancy")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <DualDate value={g.received_at} withTime />
                      {g.received_by_public_id && ` · ${g.received_by_public_id}`}
                    </p>
                    {g.notes && <p className="text-sm">{g.notes}</p>}
                    {g.discrepancy_summary && (
                      <p className="rounded bg-red-50 p-2 text-xs text-red-900">
                        {tr("Reported")}: {g.discrepancy_summary}
                      </p>
                    )}
                    {g.resolution && (
                      <p className="rounded bg-green-50 p-2 text-xs text-green-900">
                        {tr("Resolution")}: {g.resolution}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {role === "ADMIN" && (
                      <DocumentsDialog
                        targetType="grn"
                        targetId={g._id}
                        trigger={
                          <Button size="sm" variant="ghost">
                            {tr("Documents")}
                          </Button>
                        }
                      />
                    )}
                    {role === "ADMIN" && g.status === "DISPUTED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setResolveTarget(g);
                          setResolution("");
                        }}
                      >
                        {tr("Resolve discrepancy")}
                      </Button>
                    )}
                  </div>
                </div>

                {g.lines?.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs">
                    {g.lines.map((ln: any) => (
                      <li key={ln._id} className="flex items-center gap-2">
                        <Badge variant="outline" className={CONDITION_TONE[ln.condition as Condition] ?? ""}>
                          {tr(ln.condition)}
                        </Badge>
                        <span className="flex-1 truncate">{ln.description}</span>
                        <span className="text-muted-foreground">
                          {ln.received_qty} / {ln.ordered_qty}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {g.photos?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {g.photos.map((p: any) =>
                      p.url ? (
                        <a
                          key={p.storage_id}
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded border border-border overflow-hidden"
                        >
                          <img src={p.url} alt="" className="h-16 w-16 object-cover" />
                        </a>
                      ) : null,
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{tr("Record receipt")}</DialogTitle>
            <DialogDescription>
              {tr("Confirm what was received. Anything other than full GOOD-condition delivery is flagged to MWRD.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              {drafts.map((d, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center rounded-md border border-border p-2"
                >
                  <div className="col-span-4 truncate text-sm">{d.description}</div>
                  <div className="col-span-2 flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      value={d.received_qty}
                      onChange={(e) => {
                        const next = [...drafts];
                        next[idx] = { ...next[idx], received_qty: e.target.value };
                        setDrafts(next);
                      }}
                      className="h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      / {d.ordered_qty}
                    </span>
                  </div>
                  <div className="col-span-3">
                    <Select
                      value={d.condition}
                      onValueChange={(v) => {
                        const next = [...drafts];
                        next[idx] = { ...next[idx], condition: v as Condition };
                        setDrafts(next);
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GOOD">{tr("GOOD")}</SelectItem>
                        <SelectItem value="DAMAGED">{tr("DAMAGED")}</SelectItem>
                        <SelectItem value="SHORT_SHIPPED">{tr("SHORT_SHIPPED")}</SelectItem>
                        <SelectItem value="WRONG_ITEM">{tr("WRONG_ITEM")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder={tr("Line note (optional)")}
                      value={d.notes}
                      onChange={(e) => {
                        const next = [...drafts];
                        next[idx] = { ...next[idx], notes: e.target.value };
                        setDrafts(next);
                      }}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            {willHaveDiscrepancy && (
              <div className="space-y-1.5">
                <Label className="text-amber-800">
                  {tr("Discrepancy summary")} *
                </Label>
                <Textarea
                  rows={2}
                  value={discrepancySummary}
                  onChange={(e) => setDiscrepancySummary(e.target.value)}
                  placeholder={tr("What's wrong? MWRD will mediate with the supplier.")}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{tr("Notes (optional)")}</Label>
              <Textarea
                rows={2}
                value={grnNotes}
                onChange={(e) => setGrnNotes(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{tr("Photos")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                {photoIds.map((id, i) => (
                  <div
                    key={String(id)}
                    className="flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-1 text-xs"
                  >
                    <ImagePlus className="w-3 h-3" />
                    {tr("Photo {n}", { n: i + 1 })}
                    <button
                      type="button"
                      onClick={() => setPhotoIds((ids) => ids.filter((x) => x !== id))}
                      className="ms-1 text-muted-foreground hover:text-foreground"
                    >
                      <Trash01 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload01 className="w-3.5 h-3.5 me-1" /> {tr("Add photo")}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tr("Cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={busy}>
              {willHaveDiscrepancy ? tr("Submit with discrepancy") : tr("Submit receipt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resolveTarget !== null}
        onOpenChange={(o) => !o && setResolveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Resolve discrepancy")}</DialogTitle>
            <DialogDescription>
              {resolveTarget?.discrepancy_summary && (
                <span className="block mt-1 rounded bg-red-50 p-2 text-xs text-red-900">
                  {resolveTarget.discrepancy_summary}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{tr("Resolution")} *</Label>
            <Textarea
              rows={3}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder={tr("Refund issued, replacement scheduled, claim closed…")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>
              {tr("Cancel")}
            </Button>
            <Button onClick={handleResolve} disabled={busy || !resolution.trim()}>
              {tr("Close discrepancy")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

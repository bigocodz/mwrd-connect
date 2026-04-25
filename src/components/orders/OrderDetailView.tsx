import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle, MessageSquare01, Truck01, Upload01, XCircle } from "@untitledui/icons";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { formatSAR, VatBadge } from "@/components/shared/VatBadge";
import {
  DISPUTE_BADGE_COLOR,
  DISPUTE_LABEL,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
} from "./orderStatus";
import { OrderTimeline } from "./OrderTimeline";

type Role = "CLIENT" | "SUPPLIER" | "ADMIN";

const TrackingDialog = ({
  open,
  onOpenChange,
  initial,
  onSubmit,
  busy,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: { carrier?: string; tracking_number?: string; tracking_url?: string; estimated_delivery_at?: number };
  onSubmit: (values: {
    carrier?: string;
    tracking_number?: string;
    tracking_url?: string;
    estimated_delivery_at?: number;
  }) => Promise<void>;
  busy: boolean;
  title: string;
}) => {
  const [carrier, setCarrier] = useState(initial.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(initial.tracking_number ?? "");
  const [trackingUrl, setTrackingUrl] = useState(initial.tracking_url ?? "");
  const [eta, setEta] = useState(
    initial.estimated_delivery_at ? new Date(initial.estimated_delivery_at).toISOString().slice(0, 10) : "",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Carrier</Label><Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="DHL, SMSA, Aramex…" /></div>
          <div><Label>Tracking number</Label><Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} /></div>
          <div><Label>Tracking URL</Label><Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://…" /></div>
          <div><Label>Estimated delivery</Label><Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            disabled={busy}
            onClick={async () => {
              await onSubmit({
                carrier: carrier.trim() || undefined,
                tracking_number: trackingNumber.trim() || undefined,
                tracking_url: trackingUrl.trim() || undefined,
                estimated_delivery_at: eta ? new Date(eta).getTime() : undefined,
              });
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RoleActions = ({ order, role }: { order: any; role: Role }) => {
  const confirmBySupplier = useMutation(api.orders.confirmBySupplier);
  const markPreparing = useMutation(api.orders.markPreparing);
  const markDispatched = useMutation(api.orders.markDispatched);
  const updateTracking = useMutation(api.orders.updateTracking);
  const markDelivered = useMutation(api.orders.markDelivered);
  const confirmByClient = useMutation(api.orders.confirmByClient);
  const cancelOrder = useMutation(api.orders.cancel);
  const addNote = useMutation(api.orders.addNote);
  const generatePodUploadUrl = useMutation(api.orders.generatePodUploadUrl);
  const attachProofOfDelivery = useMutation(api.orders.attachProofOfDelivery);
  const openDispute = useMutation(api.orders.openDispute);
  const resolveDispute = useMutation(api.orders.resolveDispute);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [trackingDialog, setTrackingDialog] = useState<"DISPATCH" | "UPDATE" | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [outcome, setOutcome] = useState<"RESOLVED" | "REJECTED">("RESOLVED");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const wrap = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const cancellable = !["COMPLETED", "CANCELLED"].includes(order.status);
  const clientCancellable = role === "CLIENT" && ["PENDING_CONFIRMATION", "CONFIRMED"].includes(order.status);
  const canCancel = role === "ADMIN" ? cancellable : role === "SUPPLIER" ? cancellable : clientCancellable;

  const handlePodFile = async (file: File) => {
    setBusy(true);
    try {
      const uploadUrl = await generatePodUploadUrl();
      const upload = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!upload.ok) throw new Error("Upload failed");
      const { storageId } = await upload.json();
      await attachProofOfDelivery({ id: order._id, storage_id: storageId, name: file.name });
      toast.success("Proof of delivery uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {role === "SUPPLIER" && order.status === "PENDING_CONFIRMATION" && (
        <Button onClick={() => wrap("Order confirmed", () => confirmBySupplier({ id: order._id }))} disabled={busy}>
          <CheckCircle className="w-4 h-4 mr-2" /> Confirm Order
        </Button>
      )}
      {role === "SUPPLIER" && order.status === "CONFIRMED" && (
        <Button onClick={() => wrap("Marked as preparing", () => markPreparing({ id: order._id }))} disabled={busy}>
          Mark as Preparing
        </Button>
      )}
      {role === "SUPPLIER" && (order.status === "PREPARING" || order.status === "CONFIRMED") && (
        <Button onClick={() => setTrackingDialog("DISPATCH")} disabled={busy}>
          <Truck01 className="w-4 h-4 mr-2" /> Dispatch with tracking
        </Button>
      )}
      {role === "SUPPLIER" && order.status === "DISPATCHED" && (
        <>
          <Button variant="outline" onClick={() => setTrackingDialog("UPDATE")} disabled={busy}>
            Update tracking
          </Button>
          <Button onClick={() => wrap("Marked as delivered", () => markDelivered({ id: order._id }))} disabled={busy}>
            Mark as Delivered
          </Button>
        </>
      )}
      {role === "SUPPLIER" && (order.status === "DISPATCHED" || order.status === "DELIVERED") && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePodFile(file);
            }}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            <Upload01 className="w-4 h-4 mr-2" /> {order.pod_storage_id ? "Replace POD" : "Upload POD"}
          </Button>
        </>
      )}
      {role === "CLIENT" && order.status === "DELIVERED" && (
        <Button onClick={() => wrap("Order completed", () => confirmByClient({ id: order._id }))} disabled={busy}>
          <CheckCircle className="w-4 h-4 mr-2" /> Confirm Receipt
        </Button>
      )}
      {role === "CLIENT" &&
        ["DELIVERED", "COMPLETED"].includes(order.status) &&
        order.dispute_status !== "OPEN" && (
          <Button variant="outline" onClick={() => setDisputeOpen(true)} disabled={busy}>
            Open Dispute
          </Button>
        )}
      {role === "ADMIN" && order.dispute_status === "OPEN" && (
        <Button onClick={() => setResolveOpen(true)} disabled={busy}>
          Resolve Dispute
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)} disabled={busy}>
        <MessageSquare01 className="w-4 h-4 mr-2" /> Add Note
      </Button>
      {canCancel && (
        <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)} disabled={busy}>
          <XCircle className="w-4 h-4 mr-2" /> Cancel Order
        </Button>
      )}

      {trackingDialog && (
        <TrackingDialog
          open={trackingDialog !== null}
          onOpenChange={(open) => !open && setTrackingDialog(null)}
          initial={{
            carrier: order.carrier,
            tracking_number: order.tracking_number,
            tracking_url: order.tracking_url,
            estimated_delivery_at: order.estimated_delivery_at,
          }}
          busy={busy}
          title={trackingDialog === "DISPATCH" ? "Dispatch order" : "Update tracking"}
          onSubmit={async (values) => {
            const action =
              trackingDialog === "DISPATCH"
                ? () => markDispatched({ id: order._id, ...values })
                : () => updateTracking({ id: order._id, ...values });
            await wrap(trackingDialog === "DISPATCH" ? "Order dispatched" : "Tracking updated", action);
            setTrackingDialog(null);
          }}
        />
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel order</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this order being cancelled?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Close</Button>
            <Button
              variant="destructive"
              disabled={busy || !reason.trim()}
              onClick={async () => {
                await wrap("Order cancelled", () => cancelOrder({ id: order._id, reason: reason.trim() }));
                setCancelOpen(false);
                setReason("");
              }}
            >
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add note</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible to all parties on this order." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Close</Button>
            <Button
              disabled={busy || !note.trim()}
              onClick={async () => {
                await wrap("Note added", () => addNote({ id: order._id, message: note.trim() }));
                setNoteOpen(false);
                setNote("");
              }}
            >
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Open dispute</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>What went wrong?</Label>
            <Textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Damaged goods, wrong items, missing quantity, late delivery…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>Close</Button>
            <Button
              disabled={busy || !disputeReason.trim()}
              onClick={async () => {
                await wrap("Dispute opened", () =>
                  openDispute({ id: order._id, reason: disputeReason.trim() }),
                );
                setDisputeOpen(false);
                setDisputeReason("");
              }}
            >
              Open Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolve dispute</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESOLVED">Resolved in client favor</SelectItem>
                  <SelectItem value="REJECTED">Closed without action</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resolution notes</Label>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Refund issued, replacement scheduled, claim closed…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>Close</Button>
            <Button
              disabled={busy || !resolution.trim()}
              onClick={async () => {
                await wrap("Dispute updated", () =>
                  resolveDispute({ id: order._id, resolution: resolution.trim(), outcome }),
                );
                setResolveOpen(false);
                setResolution("");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DeliveryCard = ({ order, podUrl }: { order: any; podUrl: string | null }) => {
  if (!order.carrier && !order.tracking_number && !order.estimated_delivery_at && !order.pod_storage_id) {
    return null;
  }
  return (
    <Card><CardContent className="p-4 space-y-2">
      <p className="text-xs text-muted-foreground uppercase">Delivery</p>
      {order.carrier && <p className="text-sm"><span className="text-muted-foreground">Carrier: </span>{order.carrier}</p>}
      {order.tracking_number && (
        <p className="text-sm">
          <span className="text-muted-foreground">Tracking: </span>
          {order.tracking_url ? (
            <a className="underline" href={order.tracking_url} target="_blank" rel="noreferrer">{order.tracking_number}</a>
          ) : (
            order.tracking_number
          )}
        </p>
      )}
      {order.estimated_delivery_at && (
        <p className="text-sm">
          <span className="text-muted-foreground">ETA: </span>
          {new Date(order.estimated_delivery_at).toLocaleDateString()}
        </p>
      )}
      {order.pod_storage_id && (
        <p className="text-sm">
          <span className="text-muted-foreground">Proof of delivery: </span>
          {podUrl ? (
            <a className="underline" href={podUrl} target="_blank" rel="noreferrer">{order.pod_name || "Download"}</a>
          ) : (
            order.pod_name || "Uploaded"
          )}
        </p>
      )}
    </CardContent></Card>
  );
};

const DisputeCard = ({ order }: { order: any }) => {
  if (!order.dispute_status) return null;
  return (
    <Card><CardContent className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase">Dispute</p>
        <Badge variant="outline" className={DISPUTE_BADGE_COLOR[order.dispute_status] || ""}>
          {DISPUTE_LABEL[order.dispute_status] ?? order.dispute_status}
        </Badge>
      </div>
      {order.dispute_reason && (
        <p className="text-sm"><span className="text-muted-foreground">Reason: </span>{order.dispute_reason}</p>
      )}
      {order.dispute_opened_at && (
        <p className="text-xs text-muted-foreground">
          Opened {new Date(order.dispute_opened_at).toLocaleString()}
        </p>
      )}
      {order.dispute_resolution && (
        <p className="text-sm border-t pt-2"><span className="text-muted-foreground">Resolution: </span>{order.dispute_resolution}</p>
      )}
      {order.dispute_resolved_at && (
        <p className="text-xs text-muted-foreground">
          {order.dispute_status === "RESOLVED" ? "Resolved" : "Closed"} {new Date(order.dispute_resolved_at).toLocaleString()}
        </p>
      )}
    </CardContent></Card>
  );
};

export const OrderDetailView = ({ orderId, role }: { orderId: string; role: Role }) => {
  const data = useQuery(api.orders.getById, { id: orderId as any });
  if (data === undefined) return <TableSkeleton rows={5} cols={4} />;
  if (data === null) return <p className="text-muted-foreground">Order not found.</p>;

  const order: any = data;
  const items: any[] = order.items ?? [];
  const quotedItems = items.filter((i) => i.is_quoted);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-mono">Order {order._id.slice(0, 8)}…</p>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={ORDER_STATUS_COLOR[order.status] || ""}>
              {ORDER_STATUS_LABEL[order.status] ?? order.status}
            </Badge>
            {order.dispute_status && (
              <Badge variant="outline" className={DISPUTE_BADGE_COLOR[order.dispute_status] || ""}>
                {DISPUTE_LABEL[order.dispute_status] ?? order.dispute_status}
              </Badge>
            )}
          </div>
        </div>
        <RoleActions order={order} role={role} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase">Client</p>
          <p className="font-medium">{order.client_public_id}</p>
          {order.client_company_name && <p className="text-sm text-muted-foreground">{order.client_company_name}</p>}
          {order.delivery_location && (
            <>
              <p className="text-xs text-muted-foreground uppercase pt-2">Delivery location</p>
              <p className="text-sm">{order.delivery_location}</p>
            </>
          )}
          {order.required_by && (
            <>
              <p className="text-xs text-muted-foreground uppercase pt-2">Required by</p>
              <p className="text-sm">{order.required_by}</p>
            </>
          )}
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase">Supplier</p>
          <p className="font-medium">{order.supplier_public_id}</p>
          {order.supplier_company_name && <p className="text-sm text-muted-foreground">{order.supplier_company_name}</p>}
          <p className="text-xs text-muted-foreground uppercase pt-2">Total <VatBadge className="ml-1" /></p>
          <p className="text-xl font-bold text-primary">{formatSAR(order.total_with_vat)}</p>
        </CardContent></Card>
      </div>

      <DeliveryCard order={order} podUrl={order.pod_url ?? null} />
      <DisputeCard order={order} />

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Lead Time</TableHead>
              <TableHead>Unit Price <VatBadge className="ml-1" /></TableHead>
              <TableHead>Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotedItems.map((item) => {
              const qty = item.rfq_item?.quantity ?? 1;
              const unit = item.final_price_with_vat ?? 0;
              return (
                <TableRow key={item._id}>
                  <TableCell className="font-medium">
                    {item.rfq_item?.product?.name || item.rfq_item?.custom_item_description || "Item"}
                  </TableCell>
                  <TableCell>{qty}</TableCell>
                  <TableCell>{item.lead_time_days ? `${item.lead_time_days} days` : "—"}</TableCell>
                  <TableCell>{formatSAR(unit)}</TableCell>
                  <TableCell className="font-medium">{formatSAR(unit * qty)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <OrderTimeline events={order.events ?? []} />
    </div>
  );
};

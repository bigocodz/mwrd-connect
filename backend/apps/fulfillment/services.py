from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_event
from apps.orders.models import Order, OrderItem

from .models import (
    DeliveryNote,
    DeliveryNoteItem,
    GoodsReceiptItem,
    GoodsReceiptNote,
)


class FulfillmentError(Exception):  # noqa: N818
    pass


@transaction.atomic
def create_dn(*, order: Order, by, lines: list[dict]) -> DeliveryNote:
    """`lines` = [{order_item_id, quantity}, ...]. Quantity is the qty in this
    shipment (≤ remaining qty on the order line)."""
    if order.status not in (Order.Status.CONFIRMED, Order.Status.IN_FULFILLMENT):
        raise FulfillmentError(f"Cannot ship a {order.status} order")
    if not lines:
        raise FulfillmentError("At least one line is required")

    from apps.core.numbering import DocumentKind, next_number
    dn = DeliveryNote.objects.create(
        order=order, supplier_org=order.supplier_org, client_org=order.client_org,
        created_by=by, dn_number=next_number(DocumentKind.DN),
    )
    for ln in lines:
        oi = OrderItem.objects.get(id=ln["order_item_id"], order=order)
        qty = int(ln["quantity"])
        if qty <= 0 or qty > oi.quantity:
            raise FulfillmentError(
                f"Invalid quantity {qty} for line #{oi.line_no} (max {oi.quantity})",
            )
        DeliveryNoteItem.objects.create(delivery_note=dn, order_item=oi, quantity=qty)
    return dn


@transaction.atomic
def dispatch_dn(dn: DeliveryNote) -> DeliveryNote:
    if dn.status != DeliveryNote.Status.DRAFT:
        raise FulfillmentError(f"Cannot dispatch a {dn.status} DN")
    dn.status = DeliveryNote.Status.DISPATCHED
    dn.dispatched_at = timezone.now()
    dn.save(update_fields=["status", "dispatched_at", "updated_at"])
    record_event(action="dn.dispatch", target=dn, organization=dn.supplier_org,
                 payload={"order_id": dn.order_id})
    if dn.order.status == Order.Status.CONFIRMED:
        dn.order.status = Order.Status.IN_FULFILLMENT
        dn.order.save(update_fields=["status", "updated_at"])
    return dn


@transaction.atomic
def mark_delivered(dn: DeliveryNote) -> DeliveryNote:
    if dn.status != DeliveryNote.Status.DISPATCHED:
        raise FulfillmentError(f"Cannot mark a {dn.status} DN as delivered")
    dn.status = DeliveryNote.Status.DELIVERED
    dn.delivered_at = timezone.now()
    dn.save(update_fields=["status", "delivered_at", "updated_at"])
    return dn


@transaction.atomic
def create_grn(*, dn: DeliveryNote, by) -> GoodsReceiptNote:
    if dn.status not in (DeliveryNote.Status.DISPATCHED, DeliveryNote.Status.DELIVERED):
        raise FulfillmentError("DN must be dispatched/delivered before receiving")
    if hasattr(dn, "grn"):
        return dn.grn
    from apps.core.numbering import DocumentKind, next_number
    grn = GoodsReceiptNote.objects.create(
        delivery_note=dn, client_org=dn.client_org, received_by=by,
        grn_number=next_number(DocumentKind.GRN),
    )
    for dni in dn.items.all():
        GoodsReceiptItem.objects.create(
            grn=grn, dn_item=dni, accepted_qty=dni.quantity, rejected_qty=0,
        )
    return grn


@transaction.atomic
def set_grn_line(
    *, grn: GoodsReceiptNote, dn_item_id: int,
    accepted_qty: int, rejected_qty: int = 0, notes: str = "",
) -> GoodsReceiptItem:
    if grn.status != GoodsReceiptNote.Status.DRAFT:
        raise FulfillmentError("GRN is locked")
    item = grn.items.select_related("dn_item").get(dn_item_id=dn_item_id)
    if accepted_qty + rejected_qty > item.dn_item.quantity:
        raise FulfillmentError(
            f"Accepted+rejected ({accepted_qty + rejected_qty}) exceeds shipped "
            f"qty {item.dn_item.quantity}",
        )
    item.accepted_qty = accepted_qty
    item.rejected_qty = rejected_qty
    item.notes = notes
    item.save(update_fields=["accepted_qty", "rejected_qty", "notes"])
    return item


@transaction.atomic
def complete_grn(grn: GoodsReceiptNote) -> GoodsReceiptNote:
    if grn.status != GoodsReceiptNote.Status.DRAFT:
        raise FulfillmentError(f"Cannot complete a {grn.status} GRN")
    grn.status = GoodsReceiptNote.Status.COMPLETED
    grn.received_at = timezone.now()
    grn.save(update_fields=["status", "received_at", "updated_at"])
    record_event(action="grn.complete", target=grn, organization=grn.client_org,
                 payload={"dn_id": grn.delivery_note_id})
    # Mark the DN delivered if it isn't already.
    dn = grn.delivery_note
    if dn.status == DeliveryNote.Status.DISPATCHED:
        mark_delivered(dn)
    return grn


def three_way_match(order: Order) -> dict:
    """R12 — three-way match (PO × GRN × Invoice) with 2% variance.

    Spec § three-way matching: "must match within 2% variance before invoice
    issues. Discrepancy auto-holds the invoice and flags it to backoffice."

    Returns:
        {
          "matched": bool,                # True if every line is within tolerance
          "tolerance_pct": "2.0",
          "lines": [{
              "order_item_id", "ordered", "shipped", "accepted", "rejected",
              "delta", "delta_pct",       # |ordered - accepted| / ordered * 100
              "within_tolerance",         # bool, per-line
          }, ...],
          "ready_for_invoice_qty": {order_item_id: accepted_qty},
        }

    Implementation note: the variance budget is per-line. A line is matched
    when `|ordered - accepted| <= ordered * tolerance`. We use the accepted
    qty (not the rejected) as the truth of "what got delivered usable".
    """
    from decimal import Decimal

    from django.conf import settings

    tolerance_pct = Decimal(getattr(settings, "THREE_WAY_MATCH_VARIANCE_PCT", "2.0"))
    tolerance = tolerance_pct / Decimal("100")

    lines = []
    ready = {}
    matched = True
    for oi in order.items.all():
        shipped = sum(
            (dni.quantity for dni in DeliveryNoteItem.objects.filter(
                order_item=oi, delivery_note__status__in=(
                    DeliveryNote.Status.DISPATCHED, DeliveryNote.Status.DELIVERED,
                ),
            )),
            start=0,
        )
        accepted = sum(
            (gi.accepted_qty for gi in GoodsReceiptItem.objects.filter(
                dn_item__order_item=oi,
                grn__status=GoodsReceiptNote.Status.COMPLETED,
            )),
            start=0,
        )
        rejected = sum(
            (gi.rejected_qty for gi in GoodsReceiptItem.objects.filter(
                dn_item__order_item=oi,
                grn__status=GoodsReceiptNote.Status.COMPLETED,
            )),
            start=0,
        )
        ordered = oi.quantity
        delta = ordered - accepted
        # |delta|/ordered as a percentage; ordered>0 because PositiveIntegerField.
        delta_pct = (Decimal(abs(delta)) / Decimal(ordered) * Decimal("100")).quantize(
            Decimal("0.01"),
        )
        within = abs(delta) <= int(Decimal(ordered) * tolerance)
        if not within:
            matched = False
        lines.append({
            "order_item_id": oi.id,
            "ordered": ordered,
            "shipped": shipped,
            "accepted": accepted,
            "rejected": rejected,
            "delta": delta,
            "delta_pct": str(delta_pct),
            "within_tolerance": within,
        })
        ready[oi.id] = accepted

    return {
        "matched": matched,
        "tolerance_pct": str(tolerance_pct),
        "lines": lines,
        "ready_for_invoice_qty": ready,
    }

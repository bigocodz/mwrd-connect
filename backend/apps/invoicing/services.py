from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_event
from apps.fulfillment.services import three_way_match
from apps.orders.models import Order

from .models import (
    ClientInvoice,
    ClientInvoiceItem,
    SupplierInvoice,
    SupplierInvoiceItem,
)


class InvoicingError(Exception):  # noqa: N818
    pass


def _next_number(prefix: str) -> str:
    """Backwards-compat shim. R11 spec says invoices use MWRD-INV-YYYYMMDD-XXXX
    regardless of supplier vs client (the entity tells you who pays). The
    legacy callers passed 'SI'/'CI' to differentiate; we route both through
    the canonical INV sequence so finance reconciliation has one numbering
    space.
    """
    from apps.core.numbering import DocumentKind, next_number
    return next_number(DocumentKind.INV)


# Default margin if the org's commission_rate isn't set yet.
DEFAULT_MARGIN_RATE = Decimal("0.10")


@transaction.atomic
def create_supplier_invoice_from_order(*, order: Order) -> SupplierInvoice:
    """Issue a supplier invoice for the lines that have been GRN-accepted.

    Refuses if 3-way match isn't yet matched (Phase 5 strict mode). Future
    relaxation: allow partial invoices for partial deliveries; for now we
    require a fully matched order before invoicing."""
    match = three_way_match(order)
    if not match["matched"]:
        raise InvoicingError("Order isn't fully GRN-matched yet")
    if SupplierInvoice.objects.filter(
        order=order, status__in=(SupplierInvoice.Status.DRAFT, SupplierInvoice.Status.ISSUED, SupplierInvoice.Status.PAID),  # noqa: E501
    ).exists():
        raise InvoicingError("Order already has an active supplier invoice")

    si = SupplierInvoice.objects.create(
        order=order, supplier_org=order.supplier_org,
        number=_next_number("SI"),
    )
    subtotal = Decimal("0")
    for oi in order.items.all():
        accepted_qty = match["ready_for_invoice_qty"][oi.id]
        line_total = (Decimal(oi.unit_price) * accepted_qty).quantize(Decimal("0.01"))
        SupplierInvoiceItem.objects.create(
            invoice=si, order_item=oi,
            quantity=accepted_qty,
            unit_price=oi.unit_price, total_price=line_total,
        )
        subtotal += line_total
    si.subtotal = subtotal
    si.total = subtotal
    si.save(update_fields=["subtotal", "total", "updated_at"])
    return si


@transaction.atomic
def issue_supplier_invoice(si: SupplierInvoice) -> SupplierInvoice:
    if si.status != SupplierInvoice.Status.DRAFT:
        raise InvoicingError(f"Cannot issue a {si.status} supplier invoice")
    si.status = SupplierInvoice.Status.ISSUED
    si.issued_at = timezone.now()
    si.save(update_fields=["status", "issued_at", "updated_at"])
    record_event(action="supplier_invoice.issue", target=si,
                 organization=si.supplier_org,
                 payload={"number": si.number, "total": str(si.total)})
    return si


def _margin_rate_for(client_org) -> Decimal:
    rate = client_org.commission_rate
    return rate if rate is not None else DEFAULT_MARGIN_RATE


@transaction.atomic
def create_client_invoice_from_supplier_invoice(
    *, si: SupplierInvoice
) -> ClientInvoice:
    """Auto-generate the client-facing invoice with margin applied."""
    if si.status not in (SupplierInvoice.Status.ISSUED, SupplierInvoice.Status.PAID):
        raise InvoicingError("Source supplier invoice must be ISSUED")
    order = si.order
    if ClientInvoice.objects.filter(
        order=order,
        status__in=(ClientInvoice.Status.DRAFT, ClientInvoice.Status.ISSUED, ClientInvoice.Status.PAID),  # noqa: E501
    ).exists():
        raise InvoicingError("Order already has an active client invoice")

    margin_rate = _margin_rate_for(order.client_org)
    ci = ClientInvoice.objects.create(
        order=order, client_org=order.client_org,
        source_supplier_invoice=si,
        number=_next_number("CI"),
        margin_rate=margin_rate,
    )
    subtotal = Decimal("0")
    for sii in si.items.select_related("order_item").all():
        client_unit_price = (Decimal(sii.unit_price) * (Decimal("1") + margin_rate)).quantize(Decimal("0.01"))  # noqa: E501
        line_total = (client_unit_price * sii.quantity).quantize(Decimal("0.01"))
        ClientInvoiceItem.objects.create(
            invoice=ci, order_item=sii.order_item,
            quantity=sii.quantity, unit_price=client_unit_price, total_price=line_total,
        )
        subtotal += line_total
    margin_amount = (subtotal - si.subtotal).quantize(Decimal("0.01"))
    ci.subtotal = si.subtotal  # cost basis
    ci.margin_amount = margin_amount
    ci.total = subtotal
    ci.save(update_fields=["subtotal", "margin_amount", "total", "updated_at"])
    return ci


@transaction.atomic
def issue_client_invoice(ci: ClientInvoice) -> ClientInvoice:
    if ci.status != ClientInvoice.Status.DRAFT:
        raise InvoicingError(f"Cannot issue a {ci.status} client invoice")
    ci.status = ClientInvoice.Status.ISSUED
    ci.issued_at = timezone.now()
    ci.save(update_fields=["status", "issued_at", "updated_at"])
    record_event(action="client_invoice.issue", target=ci,
                 organization=ci.client_org,
                 payload={"number": ci.number, "total": str(ci.total)})

    # Push to the accounting platform (fake in dev/test, real in prod when wired).
    from apps.integrations.wafeq.tasks import push_client_invoice_to_wafeq
    push_client_invoice_to_wafeq.delay(ci.id)

    return ci


@transaction.atomic
def mark_supplier_invoice_paid(si: SupplierInvoice) -> SupplierInvoice:
    if si.status != SupplierInvoice.Status.ISSUED:
        raise InvoicingError(f"Cannot mark {si.status} supplier invoice as paid")
    si.status = SupplierInvoice.Status.PAID
    si.paid_at = timezone.now()
    si.save(update_fields=["status", "paid_at", "updated_at"])
    record_event(action="supplier_invoice.paid", target=si,
                 organization=si.supplier_org,
                 payload={"number": si.number, "total": str(si.total)})
    return si


@transaction.atomic
def mark_client_invoice_paid(ci: ClientInvoice) -> ClientInvoice:
    if ci.status != ClientInvoice.Status.ISSUED:
        raise InvoicingError(f"Cannot mark {ci.status} client invoice as paid")
    ci.status = ClientInvoice.Status.PAID
    ci.paid_at = timezone.now()
    ci.save(update_fields=["status", "paid_at", "updated_at"])
    record_event(action="client_invoice.paid", target=ci,
                 organization=ci.client_org,
                 payload={"number": ci.number, "total": str(ci.total)})
    return ci

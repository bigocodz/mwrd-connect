from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.invoicing.models import ClientInvoice, SupplierInvoice
from apps.invoicing.services import (
    mark_client_invoice_paid,
    mark_supplier_invoice_paid,
)

from .models import Payment, Payout


class PaymentsError(Exception):  # noqa: N818
    pass


@transaction.atomic
def record_payment(
    *, invoice: ClientInvoice, amount: Decimal, method: str,
    reference: str = "", by, paid_at=None,
) -> Payment:
    if invoice.status != ClientInvoice.Status.ISSUED:
        raise PaymentsError(f"Cannot record payment on a {invoice.status} invoice")
    if Decimal(amount) != Decimal(invoice.total):
        raise PaymentsError("Phase 5: only full-amount payments are supported")
    payment = Payment.objects.create(
        invoice=invoice, client_org=invoice.client_org,
        amount=amount, method=method, reference=reference,
        paid_at=paid_at or timezone.now(),
        recorded_by=by,
    )
    mark_client_invoice_paid(invoice)
    return payment


@transaction.atomic
def record_payout(
    *, invoice: SupplierInvoice, amount: Decimal, method: str,
    reference: str = "", by, paid_at=None,
) -> Payout:
    if invoice.status != SupplierInvoice.Status.ISSUED:
        raise PaymentsError(f"Cannot record payout on a {invoice.status} invoice")
    if Decimal(amount) != Decimal(invoice.total):
        raise PaymentsError("Phase 5: only full-amount payouts are supported")
    payout = Payout.objects.create(
        invoice=invoice, supplier_org=invoice.supplier_org,
        amount=amount, method=method, reference=reference,
        paid_at=paid_at or timezone.now(),
        recorded_by=by,
    )
    mark_supplier_invoice_paid(invoice)
    return payout


# ---------- R13 — Moyasar payment intent flow ----------


@transaction.atomic
def create_payment_intent(*, invoice: ClientInvoice, callback_url: str = "") -> dict:
    """Spec § "createPaymentIntent function exists, returns mock id".

    Generates a Moyasar intent for the client invoice's total. The intent
    id is persisted on a draft Payment row so the capture call can find
    its way back to the right invoice. Returns a dict shape that the
    frontend can render straight into a redirect.
    """
    from .moyasar import get_provider

    if invoice.status != ClientInvoice.Status.ISSUED:
        raise PaymentsError(f"Cannot create intent for {invoice.status} invoice")
    intent = get_provider().create_payment_intent(
        invoice=invoice, callback_url=callback_url,
    )
    return {
        "id": intent.id,
        "amount_sar": str(intent.amount_sar),
        "invoice_id": intent.invoice_id,
        "status": intent.status,
        "redirect_url": intent.redirect_url,
        "provider": intent.provider,
    }


@transaction.atomic
def capture_payment(
    *, invoice: ClientInvoice, intent_id: str, by,
) -> Payment:
    """Captures a Moyasar intent and writes the Payment row, marking the
    invoice paid. Idempotent — a duplicate call for the same intent_id
    returns the existing row."""
    from .moyasar import get_provider

    if invoice.status not in (ClientInvoice.Status.ISSUED,):
        raise PaymentsError(f"Cannot capture on {invoice.status} invoice")

    existing = Payment.objects.filter(
        invoice=invoice, payment_intent_id=intent_id,
    ).first()
    if existing is not None:
        return existing

    intent = get_provider().capture_payment(intent_id)
    payment = Payment.objects.create(
        invoice=invoice, client_org=invoice.client_org,
        amount=Decimal(intent.amount_sar),
        method=Payment.Method.CARD,
        reference=intent_id,
        paid_at=timezone.now(),
        recorded_by=by,
        payment_intent_id=intent_id,
        provider="moyasar",
        provider_status=intent.status,
    )
    mark_client_invoice_paid(invoice)
    return payment


@transaction.atomic
def refund_payment(*, payment: Payment, amount: Decimal) -> Payment:
    """Issues a full or partial refund through Moyasar and updates the row."""
    from .moyasar import get_provider

    amount = Decimal(amount)
    if amount <= 0:
        raise PaymentsError("Refund amount must be positive")
    if Decimal(payment.refunded_amount) + amount > Decimal(payment.amount):
        raise PaymentsError("Refund would exceed captured amount")
    intent = get_provider().refund_payment(payment.payment_intent_id, amount)
    payment.refunded_amount = Decimal(payment.refunded_amount) + amount
    payment.provider_status = intent.status
    payment.save(update_fields=["refunded_amount", "provider_status"])
    return payment


def org_statement(*, organization, since=None, until=None) -> dict:
    """Lightweight statement: list of invoices + payments/payouts in a window.
    PDF rendering is deferred until contract PDFs land."""
    qs_filters = {}
    if since is not None:
        qs_filters["created_at__gte"] = since
    if until is not None:
        qs_filters["created_at__lte"] = until

    if organization.type == organization.Type.CLIENT:
        invoices = list(
            ClientInvoice.objects.filter(client_org=organization, **qs_filters)
            .order_by("-created_at")
            .values("id", "number", "status", "total", "issued_at", "paid_at")
        )
        payments = list(
            Payment.objects.filter(client_org=organization)
            .order_by("-paid_at")
            .values("id", "invoice_id", "amount", "method", "paid_at")
        )
        return {
            "type": "CLIENT", "org_id": organization.id,
            "invoices": invoices, "payments": payments,
        }
    invoices = list(
        SupplierInvoice.objects.filter(supplier_org=organization, **qs_filters)
        .order_by("-created_at")
        .values("id", "number", "status", "total", "issued_at", "paid_at")
    )
    payouts = list(
        Payout.objects.filter(supplier_org=organization)
        .order_by("-paid_at")
        .values("id", "invoice_id", "amount", "method", "paid_at")
    )
    return {
        "type": "SUPPLIER", "org_id": organization.id,
        "invoices": invoices, "payouts": payouts,
    }

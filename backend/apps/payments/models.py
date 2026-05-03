"""Payments and payouts.

Payment: client → MWRD against a ClientInvoice.
Payout : MWRD → supplier against a SupplierInvoice.
Both are recorded as immutable rows; the invoice's `status=PAID` transition
fires only when the matching record is created.

For Phase 5 we record manually-confirmed payments. PSP integration (Stripe /
local rails) lands when monetization decisions are finalized.
"""
from django.conf import settings
from django.db import models


class Payment(models.Model):
    """Client → MWRD payment against a ClientInvoice."""

    class Method(models.TextChoices):
        BANK_TRANSFER = "BANK_TRANSFER", "Bank transfer"
        CARD = "CARD", "Card"
        OTHER = "OTHER", "Other"

    invoice = models.ForeignKey(
        "invoicing.ClientInvoice",
        on_delete=models.PROTECT,
        related_name="payments",
    )
    client_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        related_name="payments", limit_choices_to={"type": "CLIENT"},
    )

    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=24, choices=Method.choices, default=Method.BANK_TRANSFER)
    reference = models.CharField(max_length=128, blank=True)
    paid_at = models.DateTimeField()

    # R13 — Moyasar Payment integration. The payment intent is created
    # before the customer redirects to Moyasar; on capture we store the
    # charge id (Moyasar calls them "payments") and the latest status.
    payment_intent_id = models.CharField(max_length=128, blank=True, db_index=True)
    provider = models.CharField(max_length=16, blank=True)  # e.g. "moyasar"
    provider_status = models.CharField(max_length=24, blank=True)
    refunded_amount = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
    )

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["client_org", "-paid_at"]),
            models.Index(fields=["invoice"]),
        ]

    def __str__(self) -> str:
        return f"Payment<inv={self.invoice_id} amt={self.amount}>"


class Payout(models.Model):
    """MWRD → supplier payout against a SupplierInvoice."""

    class Method(models.TextChoices):
        BANK_TRANSFER = "BANK_TRANSFER", "Bank transfer"
        OTHER = "OTHER", "Other"

    invoice = models.ForeignKey(
        "invoicing.SupplierInvoice",
        on_delete=models.PROTECT,
        related_name="payouts",
    )
    supplier_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        related_name="payouts", limit_choices_to={"type": "SUPPLIER"},
    )

    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=24, choices=Method.choices, default=Method.BANK_TRANSFER)
    reference = models.CharField(max_length=128, blank=True)
    paid_at = models.DateTimeField()

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["supplier_org", "-paid_at"]),
            models.Index(fields=["invoice"]),
        ]

    def __str__(self) -> str:
        return f"Payout<inv={self.invoice_id} amt={self.amount}>"

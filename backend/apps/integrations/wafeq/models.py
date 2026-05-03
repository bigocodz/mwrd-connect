"""Wafeq sync state.

Wafeq is the Saudi accounting platform we push client invoices to. The mapping
between MWRD's ClientInvoice and Wafeq's invoice id lives here so we can
re-find them on webhook callbacks and avoid double-pushing.
"""
from django.db import models


class WafeqContactSync(models.Model):
    """One row per organization that has a Wafeq Contact."""
    organization = models.OneToOneField(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="wafeq_contact",
    )
    wafeq_contact_id = models.CharField(max_length=64, db_index=True)
    last_synced_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"WafeqContact<org={self.organization_id} → {self.wafeq_contact_id}>"


class WafeqInvoiceSync(models.Model):
    """One row per ClientInvoice we've pushed to Wafeq."""

    class Status(models.TextChoices):
        QUEUED = "QUEUED", "Queued"
        PUSHED = "PUSHED", "Pushed"
        FAILED = "FAILED", "Failed"

    client_invoice = models.OneToOneField(
        "invoicing.ClientInvoice",
        on_delete=models.CASCADE,
        related_name="wafeq_sync",
    )
    wafeq_invoice_id = models.CharField(max_length=64, blank=True, db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.QUEUED)
    last_error = models.TextField(blank=True)
    pushed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self) -> str:
        return f"WafeqInvoiceSync<ci={self.client_invoice_id} [{self.status}]>"

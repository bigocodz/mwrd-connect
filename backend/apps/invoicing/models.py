"""Invoicing.

Two parallel invoice rails per fulfilled order:
- SupplierInvoice: what the supplier charges MWRD (cost prices).
- ClientInvoice: what MWRD charges the client (cost + margin).

Both follow the same lifecycle: DRAFT → ISSUED → PAID (or CANCELLED).
A ClientInvoice references the SupplierInvoice that produced it; the margin
is denormalized so historical invoices stay correct if rates change later.
"""
from django.db import models


class SupplierInvoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ISSUED = "ISSUED", "Issued"
        PAID = "PAID", "Paid"
        CANCELLED = "CANCELLED", "Cancelled"

    order = models.ForeignKey(
        "orders.Order", on_delete=models.PROTECT, related_name="supplier_invoices"
    )
    supplier_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        related_name="supplier_invoices", limit_choices_to={"type": "SUPPLIER"},
    )

    number = models.CharField(max_length=32, unique=True)  # human-friendly
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    issued_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["supplier_org", "status", "-created_at"]),
            models.Index(fields=["order", "status"]),
        ]

    def __str__(self) -> str:
        return f"SI<{self.number} [{self.status}]>"


class SupplierInvoiceItem(models.Model):
    invoice = models.ForeignKey(
        SupplierInvoice, on_delete=models.CASCADE, related_name="items"
    )
    order_item = models.ForeignKey(
        "orders.OrderItem", on_delete=models.PROTECT, related_name="+"
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["invoice", "order_item"], name="uniq_si_item",
            ),
        ]
        indexes = [models.Index(fields=["invoice"])]

    def __str__(self) -> str:
        return f"SIItem<si={self.invoice_id} oi={self.order_item_id}>"


class ClientInvoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ISSUED = "ISSUED", "Issued"
        PAID = "PAID", "Paid"
        CANCELLED = "CANCELLED", "Cancelled"

    order = models.ForeignKey(
        "orders.Order", on_delete=models.PROTECT, related_name="client_invoices"
    )
    client_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        related_name="client_invoices", limit_choices_to={"type": "CLIENT"},
    )
    source_supplier_invoice = models.ForeignKey(
        SupplierInvoice, on_delete=models.PROTECT,
        related_name="client_invoices", null=True, blank=True,
    )

    number = models.CharField(max_length=32, unique=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)

    # Pricing breakdown — captured at issue time, denormalized.
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    margin_rate = models.DecimalField(max_digits=5, decimal_places=4, default=0)
    margin_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    issued_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["client_org", "status", "-created_at"]),
            models.Index(fields=["order", "status"]),
        ]

    def __str__(self) -> str:
        return f"CI<{self.number} [{self.status}]>"


class ClientInvoiceItem(models.Model):
    invoice = models.ForeignKey(
        ClientInvoice, on_delete=models.CASCADE, related_name="items"
    )
    order_item = models.ForeignKey(
        "orders.OrderItem", on_delete=models.PROTECT, related_name="+"
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)  # client-facing
    total_price = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["invoice", "order_item"], name="uniq_ci_item",
            ),
        ]
        indexes = [models.Index(fields=["invoice"])]

    def __str__(self) -> str:
        return f"CIItem<ci={self.invoice_id} oi={self.order_item_id}>"

"""Delivery flow.

DeliveryNote: supplier ships goods → creates a DN listing what was shipped.
GoodsReceiptNote: client receives, verifies, and records accepted vs rejected
quantities per line. The 3-way-match service then compares Order ↔ DN ↔ GRN
to decide whether the supplier may invoice.

A single Order may have multiple DNs (partial shipments). Each DN has at most
one open GRN — once the GRN is COMPLETED it's locked.
"""
from django.conf import settings
from django.db import models


class DeliveryNote(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        DISPATCHED = "DISPATCHED", "Dispatched"
        DELIVERED = "DELIVERED", "Delivered"

    # R11 — MWRD-DN-YYYYMMDD-XXXX. Filled by services.create_dn.
    dn_number = models.CharField(max_length=32, blank=True, db_index=True)
    order = models.ForeignKey(
        "orders.Order", on_delete=models.PROTECT, related_name="delivery_notes"
    )
    supplier_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        related_name="delivery_notes", limit_choices_to={"type": "SUPPLIER"},
    )
    client_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        related_name="incoming_deliveries", limit_choices_to={"type": "CLIENT"},
    )

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["order", "status"]),
            models.Index(fields=["client_org", "status", "-created_at"]),
            models.Index(fields=["supplier_org", "status", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"DN#{self.id} order={self.order_id} [{self.status}]"


class DeliveryNoteItem(models.Model):
    delivery_note = models.ForeignKey(
        DeliveryNote, on_delete=models.CASCADE, related_name="items"
    )
    order_item = models.ForeignKey(
        "orders.OrderItem", on_delete=models.PROTECT, related_name="+"
    )
    quantity = models.PositiveIntegerField()  # this shipment's qty for the line

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["delivery_note", "order_item"], name="uniq_dn_item",
            ),
        ]
        indexes = [models.Index(fields=["delivery_note"])]

    def __str__(self) -> str:
        return f"DNItem<dn={self.delivery_note_id} oi={self.order_item_id}>"


class GoodsReceiptNote(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        COMPLETED = "COMPLETED", "Completed"

    # R11 — MWRD-GRN-YYYYMMDD-XXXX. Filled by services.create_grn.
    grn_number = models.CharField(max_length=32, blank=True, db_index=True)
    delivery_note = models.OneToOneField(
        DeliveryNote, on_delete=models.PROTECT, related_name="grn"
    )
    client_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        related_name="grns", limit_choices_to={"type": "CLIENT"},
    )

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    received_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["client_org", "status", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"GRN#{self.id} dn={self.delivery_note_id} [{self.status}]"


class GoodsReceiptItem(models.Model):
    grn = models.ForeignKey(GoodsReceiptNote, on_delete=models.CASCADE, related_name="items")
    dn_item = models.ForeignKey(
        DeliveryNoteItem, on_delete=models.PROTECT, related_name="+"
    )
    accepted_qty = models.PositiveIntegerField(default=0)
    rejected_qty = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["grn", "dn_item"], name="uniq_grn_item"),
        ]
        indexes = [models.Index(fields=["grn"])]

    def __str__(self) -> str:
        return f"GRNItem<grn={self.grn_id} dn_item={self.dn_item_id}>"

"""Order — created when both parties have signed a contract.

R8: each contract issues a *pair* of orders (one CPO + one SPO) sharing
a `transaction_ref` UUID. Both POs reference the same items at the same
prices; what differs is which side acts on which document.

- CPO (Client PO) — the document the client approves and pays against.
  Goes through the Approval Tree (R9), receives a GRN (R12).
- SPO (Supplier PO) — the document the supplier confirms and ships against.
  Issues a Delivery Note.

Lifecycle (per spec):
    AWAITING_APPROVAL → CONFIRMED → IN_TRANSIT → DELIVERED → COMPLETED.
    CANCELLED is terminal.

Backwards compat: the legacy single-Order shape kept `type=JOINT` and
status=DRAFT. New code paths produce CPO+SPO with status=AWAITING_APPROVAL
(client side) / CONFIRMED-on-publish (supplier side starts at DRAFT until
they confirm).
"""
from django.conf import settings
from django.db import models


class Order(models.Model):
    class Type(models.TextChoices):
        # JOINT = the legacy "one row per order" form. Kept for migration
        # compatibility but new flows always create the CPO/SPO pair.
        JOINT = "JOINT", "Joint (legacy)"
        CPO = "CPO", "Client PO"
        SPO = "SPO", "Supplier PO"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        AWAITING_APPROVAL = "AWAITING_APPROVAL", "Awaiting approval"
        CONFIRMED = "CONFIRMED", "Confirmed"
        IN_TRANSIT = "IN_TRANSIT", "In transit"
        DELIVERED = "DELIVERED", "Delivered"
        IN_FULFILLMENT = "IN_FULFILLMENT", "In fulfillment"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    # Was OneToOne; now FK because each contract issues TWO orders (CPO+SPO).
    contract = models.ForeignKey(
        "contracts.Contract", on_delete=models.PROTECT, related_name="orders",
    )
    client_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        related_name="client_orders", limit_choices_to={"type": "CLIENT"},
    )
    supplier_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        related_name="supplier_orders", limit_choices_to={"type": "SUPPLIER"},
    )

    # R8 — dual PO bookkeeping
    type = models.CharField(
        max_length=8, choices=Type.choices, default=Type.JOINT, db_index=True,
    )
    transaction_ref = models.UUIDField(null=True, blank=True, db_index=True)
    # po_number is filled by R11's document numbering service. Blank for now
    # so the migration can run on legacy rows without a backfill.
    po_number = models.CharField(max_length=64, blank=True, db_index=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    delivery_location = models.CharField(max_length=255, blank=True)
    required_by = models.DateField(null=True, blank=True)

    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.PROTECT, related_name="+",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["client_org", "status", "-created_at"]),
            models.Index(fields=["supplier_org", "status", "-created_at"]),
            models.Index(fields=["transaction_ref", "type"]),
        ]

    def __str__(self) -> str:
        return f"Order#{self.id} [{self.type} {self.status}]"

    def paired_order(self) -> "Order | None":
        """Return the partner CPO/SPO sharing the same transaction_ref."""
        if not self.transaction_ref or self.type == Order.Type.JOINT:
            return None
        partner_type = Order.Type.SPO if self.type == Order.Type.CPO else Order.Type.CPO
        return Order.objects.filter(
            transaction_ref=self.transaction_ref, type=partner_type,
        ).first()


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    line_no = models.PositiveSmallIntegerField()
    master_product = models.ForeignKey(
        "catalog.MasterProduct", on_delete=models.PROTECT, related_name="+"
    )
    pack_type_code = models.CharField(max_length=32)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["order", "line_no"], name="uniq_order_line_no"),
        ]
        indexes = [models.Index(fields=["order", "line_no"])]

    def __str__(self) -> str:
        return f"OrderItem<o={self.order_id} ln={self.line_no}>"

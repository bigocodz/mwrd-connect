"""Contract — created when a client awards a supplier's quote.

Lifecycle:
    PENDING_SIGNATURES → SIGNED (both parties sign) → ORDER_ISSUED.
"""
from django.conf import settings
from django.db import models


class Contract(models.Model):
    class Status(models.TextChoices):
        PENDING_SIGNATURES = "PENDING_SIGNATURES", "Pending signatures"
        SIGNED = "SIGNED", "Signed"
        ORDER_ISSUED = "ORDER_ISSUED", "Order issued"
        CANCELLED = "CANCELLED", "Cancelled"

    rfq = models.ForeignKey("rfqs.Rfq", on_delete=models.PROTECT, related_name="contracts")
    quote = models.OneToOneField(
        "quotes.Quote", on_delete=models.PROTECT, related_name="contract"
    )

    client_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        related_name="client_contracts", limit_choices_to={"type": "CLIENT"},
    )
    supplier_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        related_name="supplier_contracts", limit_choices_to={"type": "SUPPLIER"},
    )

    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.PENDING_SIGNATURES
    )
    total = models.DecimalField(max_digits=14, decimal_places=2)
    delivery_location = models.CharField(max_length=255, blank=True)
    required_by = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    client_signed_at = models.DateTimeField(null=True, blank=True)
    client_signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.PROTECT, related_name="+",
    )
    supplier_signed_at = models.DateTimeField(null=True, blank=True)
    supplier_signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.PROTECT, related_name="+",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["client_org", "status"]),
            models.Index(fields=["supplier_org", "status"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Contract#{self.id} [{self.status}]"


class ContractItem(models.Model):
    """Snapshot of the awarded quote items at the moment of award. Decoupled
    from Quote/Rfq so contract data can't change underfoot."""

    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="items")
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
            models.UniqueConstraint(
                fields=["contract", "line_no"], name="uniq_contract_line_no",
            ),
        ]
        indexes = [models.Index(fields=["contract", "line_no"])]

    def __str__(self) -> str:
        return f"ContractItem<c={self.contract_id} ln={self.line_no}>"

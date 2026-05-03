"""RFQ — request for quote.

State machine:
    DRAFT (only client sees) → PUBLISHED (visible to all suppliers) → CLOSED.

Tenancy is cross-org: the RFQ is owned by `client_org`. When PUBLISHED,
suppliers see it via the inbox endpoint. RfqVisibility is reserved for a
later "targeted RFQ" feature; today every published RFQ is broadcast.
"""
from django.conf import settings
from django.db import models


class Rfq(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PUBLISHED = "PUBLISHED", "Published"
        CLOSED = "CLOSED", "Closed"
        AWARDED = "AWARDED", "Awarded"
        PARTIALLY_AWARDED = "PARTIALLY_AWARDED", "Partially awarded"

    class Source(models.TextChoices):
        # Spec § "Custom Request mode". CATALOG = items reference master
        # products (the default flow). CUSTOM_REQUEST = items are free-text
        # because the client is asking for something not in the catalog.
        # Auto-quote engine cannot price-fill custom requests; every supplier
        # gets a DRAFT_MANUAL.
        CATALOG = "CATALOG", "From master catalog"
        CUSTOM_REQUEST = "CUSTOM_REQUEST", "Custom request (off-catalog)"

    client_org = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="rfqs",
        limit_choices_to={"type": "CLIENT"},
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )

    # R11 — MWRD-RFQ-YYYYMMDD-XXXX. Filled by services.create_rfq.
    rfq_number = models.CharField(max_length=32, blank=True, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    delivery_location = models.CharField(max_length=255, blank=True)
    required_by = models.DateField(null=True, blank=True)

    source = models.CharField(
        max_length=16, choices=Source.choices, default=Source.CATALOG,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    awarded_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["client_org", "status", "-created_at"]),
            models.Index(fields=["status", "-published_at"]),
        ]

    def __str__(self) -> str:
        return f"RFQ#{self.id} [{self.status}] {self.title}"


class RfqItem(models.Model):
    rfq = models.ForeignKey(Rfq, on_delete=models.CASCADE, related_name="items")
    line_no = models.PositiveSmallIntegerField()
    # Catalog-mode: master_product + pack_type_code are required.
    # Custom-request mode: both null; client supplies free_text_* fields.
    master_product = models.ForeignKey(
        "catalog.MasterProduct", on_delete=models.PROTECT, related_name="+",
        null=True, blank=True,
    )
    pack_type_code = models.CharField(max_length=32, blank=True)
    quantity = models.PositiveIntegerField()
    notes = models.TextField(blank=True)

    # R6 — Custom Request fields. Populated when the parent RFQ has
    # source=CUSTOM_REQUEST. Spec § Custom Request: "client describes in
    # free text and suppliers manually quote".
    free_text_name = models.CharField(max_length=255, blank=True)
    free_text_description = models.TextField(blank=True)
    unit = models.CharField(max_length=32, blank=True)  # PCS, KG, BOX, ...
    specs_overrides = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["rfq", "line_no"], name="uniq_rfq_line_no"),
        ]
        indexes = [models.Index(fields=["rfq", "line_no"])]

    def __str__(self) -> str:
        return f"RFQItem<rfq={self.rfq_id} line={self.line_no}>"

    @property
    def display_name(self) -> str:
        """For UIs: show the master_product name in catalog mode, free-text
        name in custom-request mode. Avoids each consumer doing the if/else."""
        if self.master_product_id:
            return self.master_product.name_en
        return self.free_text_name or f"Line #{self.line_no}"


class RfqVisibility(models.Model):
    """Reserved for targeted RFQs — explicit list of suppliers who can see it.
    Empty list (the default for v1) means broadcast to all suppliers."""

    rfq = models.ForeignKey(Rfq, on_delete=models.CASCADE, related_name="visibility")
    supplier_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="+",
        limit_choices_to={"type": "SUPPLIER"},
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["rfq", "supplier_org"], name="uniq_rfq_supplier_visibility",
            ),
        ]

    def __str__(self) -> str:
        return f"RfqVisibility<rfq={self.rfq_id} sup={self.supplier_org_id}>"

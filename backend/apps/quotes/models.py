"""Quote — supplier's response to a published RFQ.

Lifecycle (R5 / spec):
    DRAFT_AUTO    — auto-generated from a matching Offer. Will auto-send
                    when `auto_send_at` expires (unless supplier edits).
    DRAFT_MANUAL  — supplier was matched by category but has no auto_quote
                    Offer; must build the quote by hand.
    SUBMITTED     — sent to client (from spec: 'submitted_to_client').
    PENDING_ADMIN — held for Quote Manager review (total > threshold OR
                    explicitly held).
    WITHDRAWN     — supplier pulled the quote.
    AWARDED       — client accepted (whole or partial).
    LOST          — client awarded another supplier.
    EXPIRED       — passed `valid_until` without action.

Backwards compatibility: legacy `DRAFT` is kept as an alias for
DRAFT_MANUAL so pre-R5 tests / data continues to work.

QuoteItem stores BOTH prices side-by-side:
- `unit_price` / `total_price`             = supplier's cost-side input.
- `final_unit_price` / `final_total_price` = margin-applied client view.
The serializer redacts these fields based on viewer scope per spec.
"""
from django.conf import settings
from django.db import models


class Quote(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft (manual, legacy alias)"
        DRAFT_AUTO = "DRAFT_AUTO", "Draft (auto-generated)"
        DRAFT_MANUAL = "DRAFT_MANUAL", "Draft (manual)"
        PENDING_ADMIN = "PENDING_ADMIN", "Pending admin review"
        SUBMITTED = "SUBMITTED", "Submitted to client"
        WITHDRAWN = "WITHDRAWN", "Withdrawn"
        AWARDED = "AWARDED", "Awarded"
        # R7: client picked some-but-not-all lines from this quote in a
        # split award. Spec name: "partially_accepted".
        PARTIALLY_AWARDED = "PARTIALLY_AWARDED", "Partially awarded"
        LOST = "LOST", "Lost"
        EXPIRED = "EXPIRED", "Expired"

    # R11 — MWRD-Q-YYYYMMDD-XXXX. Filled by services on quote creation.
    quote_number = models.CharField(max_length=32, blank=True, db_index=True)
    rfq = models.ForeignKey(
        "rfqs.Rfq", on_delete=models.PROTECT, related_name="quotes"
    )
    supplier_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        related_name="quotes", limit_choices_to={"type": "SUPPLIER"},
    )

    status = models.CharField(max_length=24, choices=Status.choices, default=Status.DRAFT)
    # supplier-side total (cost). Always populated.
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # client-side total (after margin). Populated when the quote moves into
    # SUBMITTED or PENDING_ADMIN; null while the supplier is still drafting.
    final_total = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
    )
    # The margin pct applied at send time. Snapshotted so backoffice can
    # audit what rate fired even if the rule changes later.
    applied_margin_pct = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
    )

    # R5 — auto-quote bookkeeping
    is_auto_generated = models.BooleanField(default=False)
    auto_send_at = models.DateTimeField(null=True, blank=True, db_index=True)
    admin_held_reason = models.CharField(max_length=255, blank=True)

    lead_time_days = models.PositiveSmallIntegerField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    submitted_at = models.DateTimeField(null=True, blank=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)
    awarded_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["rfq", "supplier_org"], name="uniq_quote_per_rfq_supplier",
            ),
        ]
        indexes = [
            models.Index(fields=["rfq", "status"]),
            models.Index(fields=["supplier_org", "-created_at"]),
            # For the auto-send beat task: pick up DRAFT_AUTO quotes whose
            # window has expired.
            models.Index(fields=["status", "auto_send_at"]),
        ]

    def __str__(self) -> str:
        return f"Quote#{self.id} rfq={self.rfq_id} sup={self.supplier_org_id} [{self.status}]"


class QuoteItem(models.Model):
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name="items")
    rfq_item = models.ForeignKey(
        "rfqs.RfqItem", on_delete=models.PROTECT, related_name="+"
    )
    # Supplier-side: the cost the supplier is willing to accept.
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Client-side: margin-applied price the client sees. Populated at
    # send time. Spec: "NEVER returned to supplier".
    final_unit_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
    )
    final_total_price = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
    )
    # Pointer to the Offer this line was auto-generated from (nullable —
    # null for manual lines or after the offer is deleted).
    offer = models.ForeignKey(
        "catalog.SupplierProduct", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
    )
    lead_time_days = models.PositiveSmallIntegerField(null=True, blank=True)
    availability_notes = models.CharField(max_length=255, blank=True)
    # Spec: supplier may decline individual lines (still useful info to client).
    declined = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["quote", "rfq_item"], name="uniq_quote_item_per_rfq_item",
            ),
        ]
        indexes = [models.Index(fields=["quote"])]

    def __str__(self) -> str:
        return f"QuoteItem<q={self.quote_id} rfq_item={self.rfq_item_id}>"


class QuoteLineSelection(models.Model):
    """R7 — line-item comparison & split awards.

    A row per (rfq_item, quote_item) the client picked. For a full-basket
    award there's one row per RFQ line all pointing at the same quote. For
    a split award the rows fan out across multiple suppliers' quotes.

    The unique constraint on `rfq_item` enforces "each line is awarded to
    exactly one supplier". The award service deletes prior selections for
    the same RFQ before re-creating, so the client can change their mind
    until the actual award is finalised.
    """
    rfq = models.ForeignKey(
        "rfqs.Rfq", on_delete=models.CASCADE, related_name="line_selections",
    )
    quote = models.ForeignKey(
        Quote, on_delete=models.CASCADE, related_name="selections",
    )
    quote_item = models.ForeignKey(
        QuoteItem, on_delete=models.CASCADE, related_name="selections",
    )
    rfq_item = models.ForeignKey(
        "rfqs.RfqItem", on_delete=models.CASCADE, related_name="+",
    )
    selected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+",
    )
    selected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["rfq", "rfq_item"],
                name="uniq_line_selection_per_rfq_item",
            ),
        ]
        indexes = [
            models.Index(fields=["rfq", "quote"]),
        ]

    def __str__(self) -> str:
        return f"QLS<rfq={self.rfq_id} line={self.rfq_item_id} q={self.quote_id}>"

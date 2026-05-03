"""Quote serializers.

Spec § quote pricing visibility (NEVER violate):

- The supplier sees their cost-side prices: `unit_price`, `total_price`,
  `total`. They MUST NOT see margin pct or final-side prices.
- The client sees the post-margin prices: `final_unit_price`,
  `final_total_price`, `final_total`. They MUST NOT see cost-side prices
  or margin pct.
- Staff (Quote Manager) sees both, plus `applied_margin_pct` and the
  hold reason. Used for the slider/release flow.

Redaction is enforced in `to_representation` based on contextvars set by
the auth class — no per-view plumbing needed. We also keep the field
name list defensive so a future schema change can't accidentally leak.
"""
from rest_framework import serializers

from apps.core.anonymity import AnonymizedOrgNameField
from apps.core.context import current_org_id, current_scope

from .models import Quote, QuoteItem

# Field names that MUST be stripped before returning to a client (buyer)
# viewer. The client only ever sees post-margin prices.
_CLIENT_HIDDEN_QUOTE_FIELDS = ("total", "applied_margin_pct", "admin_held_reason")
_CLIENT_HIDDEN_ITEM_FIELDS = ("unit_price", "total_price")

# Field names that MUST be stripped before returning to a supplier viewer.
# Suppliers never see margin or final/client prices.
_SUPPLIER_HIDDEN_QUOTE_FIELDS = ("final_total", "applied_margin_pct", "admin_held_reason")
_SUPPLIER_HIDDEN_ITEM_FIELDS = ("final_unit_price", "final_total_price")


def _viewer_role_for(quote_supplier_id: int, quote_client_id: int) -> str:
    """Classify the current viewer as 'staff' | 'supplier' | 'client' | 'other'.

    Reads contextvars set by JWTCookieAuthentication. 'other' is used when
    no quote-side claim applies (e.g. a peer org somehow saw the row — the
    view layer should already have 403'd, this is defense in depth).
    """
    scope = current_scope.get()
    if scope == "staff":
        return "staff"
    org_id = current_org_id.get()
    if org_id == quote_supplier_id:
        return "supplier"
    if org_id == quote_client_id:
        return "client"
    return "other"


class QuoteItemSerializer(serializers.ModelSerializer):
    rfq_item_line_no = serializers.IntegerField(source="rfq_item.line_no", read_only=True)
    # `master_product_name` is null for custom-request items (R6) — use
    # rfq_item.display_name which falls back to the free-text name.
    master_product_name = serializers.CharField(
        source="rfq_item.master_product.name_en", read_only=True, default=None,
    )
    display_name = serializers.CharField(source="rfq_item.display_name", read_only=True)
    quantity = serializers.IntegerField(source="rfq_item.quantity", read_only=True)
    pack_type_code = serializers.CharField(source="rfq_item.pack_type_code", read_only=True)

    class Meta:
        model = QuoteItem
        fields = (
            "id", "rfq_item", "rfq_item_line_no", "master_product_name", "display_name",
            "quantity", "pack_type_code",
            "unit_price", "total_price",
            "final_unit_price", "final_total_price",
            "lead_time_days", "availability_notes", "declined",
        )
        read_only_fields = (
            "id", "rfq_item", "rfq_item_line_no", "master_product_name", "display_name",
            "quantity", "pack_type_code", "total_price",
            "final_unit_price", "final_total_price",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Look up the parent quote to know who the parties are. The quote
        # is already prefetched via the parent serializer's queryset.
        quote = instance.quote
        role = _viewer_role_for(quote.supplier_org_id, quote.rfq.client_org_id)
        if role == "supplier":
            for f in _SUPPLIER_HIDDEN_ITEM_FIELDS:
                data.pop(f, None)
        elif role == "client":
            for f in _CLIENT_HIDDEN_ITEM_FIELDS:
                data.pop(f, None)
        elif role == "other":
            # Don't leak prices at all to a non-party.
            for f in _SUPPLIER_HIDDEN_ITEM_FIELDS + _CLIENT_HIDDEN_ITEM_FIELDS:
                data.pop(f, None)
        # staff: keep everything.
        return data


class QuoteSerializer(serializers.ModelSerializer):
    items = QuoteItemSerializer(many=True, read_only=True)
    rfq_title = serializers.CharField(source="rfq.title", read_only=True)
    # Anonymity layer: client viewer sees the supplier's platform_alias only;
    # staff and the supplier's own users see the real name.
    supplier_name = AnonymizedOrgNameField(source="supplier_org", read_only=True)

    class Meta:
        model = Quote
        fields = (
            "id", "rfq", "rfq_title", "supplier_org", "supplier_name", "status",
            "total", "final_total", "applied_margin_pct",
            "is_auto_generated", "auto_send_at", "admin_held_reason",
            "lead_time_days", "valid_until", "notes",
            "submitted_at", "withdrawn_at", "awarded_at",
            "items", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "rfq", "rfq_title", "supplier_org", "supplier_name", "status",
            "total", "final_total", "applied_margin_pct",
            "is_auto_generated", "auto_send_at", "admin_held_reason",
            "submitted_at", "withdrawn_at", "awarded_at",
            "items", "created_at", "updated_at",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        role = _viewer_role_for(instance.supplier_org_id, instance.rfq.client_org_id)
        if role == "supplier":
            for f in _SUPPLIER_HIDDEN_QUOTE_FIELDS:
                data.pop(f, None)
        elif role == "client":
            for f in _CLIENT_HIDDEN_QUOTE_FIELDS:
                data.pop(f, None)
        elif role == "other":
            for f in _SUPPLIER_HIDDEN_QUOTE_FIELDS + _CLIENT_HIDDEN_QUOTE_FIELDS:
                data.pop(f, None)
        return data


class SetItemPriceSerializer(serializers.Serializer):
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    lead_time_days = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    availability_notes = serializers.CharField(allow_blank=True, default="")


class QuoteErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "QuoteError"

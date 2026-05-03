from rest_framework import serializers

from .models import Rfq, RfqItem


class RfqItemSerializer(serializers.ModelSerializer):
    master_product_name = serializers.CharField(
        source="master_product.name_en", read_only=True
    )
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = RfqItem
        fields = (
            "id", "line_no", "master_product", "master_product_name", "display_name",
            "pack_type_code", "quantity", "notes",
            # Custom-request fields (R6) — populated only when parent RFQ is
            # a CUSTOM_REQUEST. For catalog items they're empty strings/{}.
            "free_text_name", "free_text_description", "unit", "specs_overrides",
        )
        read_only_fields = ("id", "line_no", "master_product_name", "display_name")


class RfqSerializer(serializers.ModelSerializer):
    items = RfqItemSerializer(many=True, read_only=True)

    class Meta:
        model = Rfq
        fields = (
            "id", "client_org", "title", "description", "notes",
            "delivery_location", "required_by", "source", "status",
            "published_at", "closed_at", "awarded_at",
            "items", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "client_org", "status", "published_at", "closed_at",
            "awarded_at", "items", "created_at", "updated_at",
        )


class RfqCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True, default="")
    notes = serializers.CharField(allow_blank=True, default="")
    delivery_location = serializers.CharField(allow_blank=True, default="")
    required_by = serializers.DateField(required=False, allow_null=True)
    # R6 — clients can opt into the custom-request flow at create time. The
    # field is admin-set after creation in v0; here we let the client choose.
    source = serializers.ChoiceField(
        choices=Rfq.Source.choices, default=Rfq.Source.CATALOG,
    )


class RfqAddItemSerializer(serializers.Serializer):
    """Catalog-mode item: master_product + pack_type_code required.
    Custom-request item: free_text_name + unit + quantity, master_product
    omitted/null. The service-layer validates which set is required based
    on `rfq.source`.
    """
    master_product = serializers.IntegerField(required=False, allow_null=True)
    pack_type_code = serializers.CharField(max_length=32, required=False, allow_blank=True)
    quantity = serializers.IntegerField(min_value=1)
    notes = serializers.CharField(allow_blank=True, default="")
    # R6 — custom-request fields
    free_text_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True,
    )
    free_text_description = serializers.CharField(
        required=False, allow_blank=True,
    )
    unit = serializers.CharField(max_length=32, required=False, allow_blank=True)
    specs_overrides = serializers.JSONField(required=False, default=dict)


class RfqErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "RfqError"

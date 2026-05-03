from rest_framework import serializers

from .models import (
    Bundle,
    BundleItem,
    Category,
    MasterProduct,
    ProductAdditionRequest,
    SupplierProduct,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = (
            "id", "parent", "level", "slug",
            "name_en", "name_ar", "description_en", "description_ar",
            "default_uom", "display_order", "is_active",
        )


class CategoryCreateSerializer(serializers.ModelSerializer):
    parent_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = Category
        fields = (
            "parent_id", "slug", "name_en", "name_ar",
            "description_en", "description_ar", "default_uom",
            "display_order", "is_active",
        )


class MasterProductSerializer(serializers.ModelSerializer):
    category_name_en = serializers.CharField(source="category.name_en", read_only=True)

    class Meta:
        model = MasterProduct
        fields = (
            "id", "name_en", "name_ar", "description_en", "description_ar",
            "category", "category_name_en", "sku", "brand",
            "image_keys", "specs", "pack_types",
            "status", "deprecated_at", "deprecation_reason",
            "display_order", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "category_name_en", "deprecated_at",
            "created_at", "updated_at",
        )


class SupplierProductSerializer(serializers.ModelSerializer):
    """Wire format for what the spec calls `Offer`. Each row is one
    (supplier × master_product × pack_type) — the wire surfaces the spec
    field names (auto_quote_enabled, default_lead_time_days, etc.) plus a
    `pack_type_pricing` block built from this row's per-pack pricing.

    A future consolidation can collapse multiple rows for the same
    (supplier × master) into one record with a longer pack_type_pricing
    array, transparent to the wire shape."""
    master_name_en = serializers.CharField(source="master_product.name_en", read_only=True)
    # R3 — spec-shaped aliases. These are the names the frontend / contracts
    # the spec describes. Underlying columns keep their existing names so
    # legacy code keeps working.
    auto_quote_enabled = serializers.BooleanField(source="auto_quote", required=False)
    default_lead_time_days = serializers.IntegerField(source="lead_time_days", required=False)
    supplier_internal_sku = serializers.CharField(source="sku", required=False, allow_blank=True)
    pack_type_pricing = serializers.SerializerMethodField()

    class Meta:
        model = SupplierProduct
        fields = (
            "id", "organization", "master_product", "master_name_en",
            "pack_type_code", "sku", "supplier_internal_sku",
            "cost_price", "moq",
            "lead_time_days", "default_lead_time_days",
            "auto_quote", "auto_quote_enabled",
            "fulfillment_mode", "available_quantity_estimate",
            "supplier_notes", "is_active",
            "pack_type_pricing",
            "availability_status", "stock_quantity", "low_stock_threshold",
            "approval_status", "rejection_reason",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "organization", "master_name_en", "approval_status",
            "rejection_reason", "pack_type_pricing", "created_at", "updated_at",
        )

    def get_pack_type_pricing(self, obj) -> list[dict]:
        # Spec shape: [{ pack_type, supplier_cost_sar, min_order_qty }, ...]
        return [{
            "pack_type": obj.pack_type_code,
            "supplier_cost_sar": str(obj.cost_price),
            "min_order_qty": obj.moq,
        }]


class BundleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BundleItem
        fields = (
            "id", "master_product", "pack_type_code", "quantity",
            "display_order", "notes",
        )


class BundleSerializer(serializers.ModelSerializer):
    items = BundleItemSerializer(many=True, read_only=True)

    class Meta:
        model = Bundle
        fields = (
            "id", "name_en", "name_ar", "description_en", "description_ar",
            "category", "image_key", "status", "display_order", "items",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "items", "created_at", "updated_at")


class BundleCreateSerializer(serializers.Serializer):
    name_en = serializers.CharField(max_length=255)
    name_ar = serializers.CharField(max_length=255)
    description_en = serializers.CharField(allow_blank=True, default="")
    description_ar = serializers.CharField(allow_blank=True, default="")
    category = serializers.IntegerField(required=False, allow_null=True)
    image_key = serializers.CharField(allow_blank=True, default="")
    items = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
    )


class ProductAdditionRequestSerializer(serializers.ModelSerializer):
    created_master_product_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProductAdditionRequest
        fields = (
            "id", "organization",
            "proposed_name_en", "proposed_name_ar",
            "proposed_description_en", "proposed_description_ar",
            "category", "proposed_sku", "proposed_brand",
            "image_keys", "specs", "proposed_pack_types", "justification",
            "status", "admin_notes", "rejection_reason",
            "decided_at", "created_master_product_id",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "organization", "status", "admin_notes",
            "rejection_reason", "decided_at", "created_master_product_id",
            "created_at", "updated_at",
        )


class SignedImageUploadRequest(serializers.Serializer):
    owner = serializers.ChoiceField(choices=["master", "supplier", "request"])
    owner_id = serializers.IntegerField()
    filename = serializers.CharField(max_length=255)
    content_type = serializers.CharField(max_length=128)


class SignedImageUploadResponse(serializers.Serializer):
    upload = serializers.DictField()
    storage_key = serializers.CharField()


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=2000)


class NotesSerializer(serializers.Serializer):
    notes = serializers.CharField(max_length=2000, allow_blank=True, default="")


class CatalogErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "CatalogError"

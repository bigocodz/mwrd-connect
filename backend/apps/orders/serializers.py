from rest_framework import serializers

from apps.core.anonymity import AnonymizedOrgNameField

from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    master_product_name = serializers.CharField(source="master_product.name_en", read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            "id", "line_no", "master_product", "master_product_name",
            "pack_type_code", "quantity", "unit_price", "total_price",
        )
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    # Anonymity: each side sees only the counterparty's platform_alias.
    client_org_name = AnonymizedOrgNameField(source="client_org", read_only=True)
    supplier_org_name = AnonymizedOrgNameField(source="supplier_org", read_only=True)

    class Meta:
        model = Order
        fields = (
            "id", "contract",
            "client_org", "client_org_name",
            "supplier_org", "supplier_org_name",
            # R8 — dual PO bookkeeping
            "type", "transaction_ref", "po_number",
            "status", "total", "delivery_location", "required_by",
            "confirmed_at", "completed_at", "cancelled_at",
            "items", "created_at", "updated_at",
        )
        read_only_fields = fields


class OrderErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "OrderError"

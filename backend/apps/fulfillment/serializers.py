from rest_framework import serializers

from .models import (
    DeliveryNote,
    DeliveryNoteItem,
    GoodsReceiptItem,
    GoodsReceiptNote,
)


class DeliveryNoteItemSerializer(serializers.ModelSerializer):
    line_no = serializers.IntegerField(source="order_item.line_no", read_only=True)
    master_product_name = serializers.CharField(
        source="order_item.master_product.name_en", read_only=True,
    )
    pack_type_code = serializers.CharField(
        source="order_item.pack_type_code", read_only=True,
    )

    class Meta:
        model = DeliveryNoteItem
        fields = (
            "id", "order_item", "line_no", "master_product_name",
            "pack_type_code", "quantity",
        )
        read_only_fields = ("id", "line_no", "master_product_name", "pack_type_code")


class DeliveryNoteSerializer(serializers.ModelSerializer):
    items = DeliveryNoteItemSerializer(many=True, read_only=True)

    class Meta:
        model = DeliveryNote
        fields = (
            "id", "order", "supplier_org", "client_org", "status",
            "dispatched_at", "delivered_at", "notes",
            "items", "created_at", "updated_at",
        )
        read_only_fields = fields


class CreateDnLineSerializer(serializers.Serializer):
    order_item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class CreateDnSerializer(serializers.Serializer):
    lines = serializers.ListField(child=CreateDnLineSerializer(), min_length=1)
    notes = serializers.CharField(allow_blank=True, default="")


class GrnItemSerializer(serializers.ModelSerializer):
    dn_quantity = serializers.IntegerField(source="dn_item.quantity", read_only=True)
    line_no = serializers.IntegerField(source="dn_item.order_item.line_no", read_only=True)
    master_product_name = serializers.CharField(
        source="dn_item.order_item.master_product.name_en", read_only=True,
    )

    class Meta:
        model = GoodsReceiptItem
        fields = (
            "id", "dn_item", "line_no", "master_product_name",
            "dn_quantity", "accepted_qty", "rejected_qty", "notes",
        )
        read_only_fields = ("id", "line_no", "master_product_name", "dn_quantity")


class GrnSerializer(serializers.ModelSerializer):
    items = GrnItemSerializer(many=True, read_only=True)

    class Meta:
        model = GoodsReceiptNote
        fields = (
            "id", "delivery_note", "client_org", "status",
            "received_at", "notes", "items",
            "created_at", "updated_at",
        )
        read_only_fields = fields


class GrnLineUpdateSerializer(serializers.Serializer):
    dn_item_id = serializers.IntegerField()
    accepted_qty = serializers.IntegerField(min_value=0)
    rejected_qty = serializers.IntegerField(min_value=0, default=0)
    notes = serializers.CharField(allow_blank=True, default="")


class FulfillmentErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "FulfillmentError"


class ThreeWayMatchLineSerializer(serializers.Serializer):
    order_item_id = serializers.IntegerField()
    ordered = serializers.IntegerField()
    shipped = serializers.IntegerField()
    accepted = serializers.IntegerField()
    rejected = serializers.IntegerField()
    delta = serializers.IntegerField()


class ThreeWayMatchSerializer(serializers.Serializer):
    matched = serializers.BooleanField()
    lines = ThreeWayMatchLineSerializer(many=True)

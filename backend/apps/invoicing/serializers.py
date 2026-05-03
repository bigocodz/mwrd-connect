from rest_framework import serializers

from .models import (
    ClientInvoice,
    ClientInvoiceItem,
    SupplierInvoice,
    SupplierInvoiceItem,
)


class SupplierInvoiceItemSerializer(serializers.ModelSerializer):
    line_no = serializers.IntegerField(source="order_item.line_no", read_only=True)
    master_product_name = serializers.CharField(
        source="order_item.master_product.name_en", read_only=True,
    )

    class Meta:
        model = SupplierInvoiceItem
        fields = (
            "id", "order_item", "line_no", "master_product_name",
            "quantity", "unit_price", "total_price",
        )
        read_only_fields = fields


class SupplierInvoiceSerializer(serializers.ModelSerializer):
    items = SupplierInvoiceItemSerializer(many=True, read_only=True)

    class Meta:
        model = SupplierInvoice
        fields = (
            "id", "order", "supplier_org", "number", "status",
            "subtotal", "total",
            "issued_at", "paid_at", "cancelled_at", "cancellation_reason",
            "items", "created_at", "updated_at",
        )
        read_only_fields = fields


class ClientInvoiceItemSerializer(serializers.ModelSerializer):
    line_no = serializers.IntegerField(source="order_item.line_no", read_only=True)
    master_product_name = serializers.CharField(
        source="order_item.master_product.name_en", read_only=True,
    )

    class Meta:
        model = ClientInvoiceItem
        fields = (
            "id", "order_item", "line_no", "master_product_name",
            "quantity", "unit_price", "total_price",
        )
        read_only_fields = fields


class ClientInvoiceSerializer(serializers.ModelSerializer):
    items = ClientInvoiceItemSerializer(many=True, read_only=True)

    class Meta:
        model = ClientInvoice
        fields = (
            "id", "order", "client_org", "source_supplier_invoice",
            "number", "status",
            "subtotal", "margin_rate", "margin_amount", "total",
            "issued_at", "paid_at", "cancelled_at", "cancellation_reason",
            "items", "created_at", "updated_at",
        )
        read_only_fields = fields


class InvoicingErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "InvoicingError"

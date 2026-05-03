from rest_framework import serializers

from apps.core.anonymity import AnonymizedOrgNameField

from .models import Contract, ContractItem


class ContractItemSerializer(serializers.ModelSerializer):
    master_product_name = serializers.CharField(source="master_product.name_en", read_only=True)

    class Meta:
        model = ContractItem
        fields = (
            "id", "line_no", "master_product", "master_product_name",
            "pack_type_code", "quantity", "unit_price", "total_price",
        )
        read_only_fields = fields


class ContractSerializer(serializers.ModelSerializer):
    items = ContractItemSerializer(many=True, read_only=True)
    # Anonymity: only staff or the same-org viewer sees real names.
    client_org_name = AnonymizedOrgNameField(source="client_org", read_only=True)
    supplier_org_name = AnonymizedOrgNameField(source="supplier_org", read_only=True)

    class Meta:
        model = Contract
        fields = (
            "id", "rfq", "quote",
            "client_org", "client_org_name",
            "supplier_org", "supplier_org_name",
            "status", "total", "delivery_location", "required_by", "notes",
            "client_signed_at", "supplier_signed_at",
            "items", "created_at", "updated_at",
        )
        read_only_fields = fields


class ContractErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "ContractError"

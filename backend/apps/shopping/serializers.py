from rest_framework import serializers

from .models import Cart, CartItem, CompanyCatalog, CompanyCatalogItem, Favourite


class FavouriteSerializer(serializers.ModelSerializer):
    master_product_name = serializers.CharField(
        source="master_product.name_en", read_only=True,
    )

    class Meta:
        model = Favourite
        fields = ("id", "master_product", "master_product_name", "created_at")
        read_only_fields = fields


class CompanyCatalogItemSerializer(serializers.ModelSerializer):
    master_product_name = serializers.CharField(
        source="master_product.name_en", read_only=True,
    )

    class Meta:
        model = CompanyCatalogItem
        fields = ("id", "master_product", "master_product_name", "added_at")
        read_only_fields = fields


class CompanyCatalogSerializer(serializers.ModelSerializer):
    items = CompanyCatalogItemSerializer(many=True, read_only=True)
    item_count = serializers.IntegerField(source="items.count", read_only=True)

    class Meta:
        model = CompanyCatalog
        fields = (
            "id", "organization", "name", "description",
            "items", "item_count", "created_by", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "organization", "items", "item_count", "created_by",
            "created_at", "updated_at",
        )


class CartItemSerializer(serializers.ModelSerializer):
    master_product_name = serializers.CharField(
        source="master_product.name_en", read_only=True,
    )

    class Meta:
        model = CartItem
        fields = (
            "id", "master_product", "master_product_name", "pack_type_code",
            "quantity", "notes",
        )
        read_only_fields = ("id", "master_product_name")


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    item_count = serializers.IntegerField(source="items.count", read_only=True)

    class Meta:
        model = Cart
        fields = (
            "id", "status", "name", "expires_at", "submitted_rfq",
            "items", "item_count", "created_at", "updated_at",
        )
        read_only_fields = fields


class AddCartItemSerializer(serializers.Serializer):
    master_product = serializers.IntegerField()
    pack_type_code = serializers.CharField(max_length=32)
    quantity = serializers.IntegerField(min_value=1)
    notes = serializers.CharField(allow_blank=True, default="")


class SaveCartSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=128)


class SubmitCartSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True, default="")
    delivery_location = serializers.CharField(allow_blank=True, default="")
    required_by = serializers.DateField(required=False, allow_null=True)


class ShoppingErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "ShoppingError"

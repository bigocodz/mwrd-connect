"""Catalog domain.

- Category: hierarchical taxonomy (level 0..3), admin-managed, bilingual.
- MasterProduct: the platform's canonical product spine. Admin-managed.
  pack_types are variants of the same master product (each / case / bulk).
- SupplierProduct: a supplier's listing for a master product, with their
  cost price, lead time, MOQ, and availability. Admin-approved before going
  live.
- Bundle / BundleItem: a curated combo of master products (admin-managed).
- ProductAdditionRequest: supplier proposes a new master product; on admin
  approval a MasterProduct is created and the supplier may then list it.

Tenancy:
- Category, MasterProduct, Bundle, BundleItem  → platform-global (no org)
- SupplierProduct, ProductAdditionRequest      → tied to a supplier organization
- (ClientCatalog deferred to a later phase)
"""
from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.db import models


class Category(models.Model):
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="children"
    )
    level = models.PositiveSmallIntegerField()  # 0..3
    slug = models.SlugField(max_length=128, unique=True)
    name_en = models.CharField(max_length=255)
    name_ar = models.CharField(max_length=255)
    description_en = models.TextField(blank=True)
    description_ar = models.TextField(blank=True)
    default_uom = models.CharField(max_length=32, blank=True)  # PCS, KG, BOX, ...
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["parent", "display_order"]),
            models.Index(fields=["is_active", "level"]),
        ]
        verbose_name_plural = "categories"

    def __str__(self) -> str:
        return f"{self.name_en} ({self.slug})"


class MasterProduct(models.Model):
    """Canonical, admin-curated product. Suppliers list against this."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        DEPRECATED = "DEPRECATED", "Deprecated"

    # R11 — MWRD-PROD-NNNNN, 5-digit zero-padded sequence. Filled by
    # services.create_master_product.
    master_product_code = models.CharField(max_length=32, blank=True, db_index=True)
    name_en = models.CharField(max_length=255)
    name_ar = models.CharField(max_length=255)
    description_en = models.TextField(blank=True)
    description_ar = models.TextField(blank=True)
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="master_products"
    )
    sku = models.CharField(max_length=64, blank=True, db_index=True)  # canonical
    brand = models.CharField(max_length=128, blank=True)
    image_keys = models.JSONField(default=list)  # list[str] of S3 keys
    specs = models.JSONField(default=dict, blank=True)  # free-form attributes
    # pack_types: list of {code, label_en, label_ar, base_qty, uom}
    pack_types = models.JSONField(default=list)

    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )
    deprecated_at = models.DateTimeField(null=True, blank=True)
    deprecation_reason = models.TextField(blank=True)
    display_order = models.IntegerField(default=0)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Postgres full-text search column. Maintained by a service helper or
    # a database trigger; we update it on save() for now.
    search_vector = SearchVectorField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["category", "status"]),
            models.Index(fields=["status", "-created_at"]),
            GinIndex(fields=["search_vector"]),
        ]

    def __str__(self) -> str:
        return f"{self.name_en} [{self.sku or self.id}]"


class SupplierProduct(models.Model):
    """A supplier-org's listing for a master product."""

    class Availability(models.TextChoices):
        IN_STOCK = "IN_STOCK", "In stock"
        LOW_STOCK = "LOW_STOCK", "Low stock"
        OUT_OF_STOCK = "OUT_OF_STOCK", "Out of stock"
        DISCONTINUED = "DISCONTINUED", "Discontinued"

    class Approval(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING = "PENDING", "Pending review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    class FulfillmentMode(models.TextChoices):
        # Express = stocked + 24h delivery; Market = standard 48–72h
        EXPRESS = "EXPRESS", "Express"
        MARKET = "MARKET", "Market"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="supplier_products",
        limit_choices_to={"type": "SUPPLIER"},
    )
    master_product = models.ForeignKey(
        MasterProduct, on_delete=models.PROTECT, related_name="supplier_listings"
    )
    pack_type_code = models.CharField(max_length=32)  # references master.pack_types[].code

    sku = models.CharField(max_length=64, blank=True, db_index=True)  # supplier's SKU
    cost_price = models.DecimalField(max_digits=12, decimal_places=2)
    moq = models.PositiveIntegerField(default=1)
    lead_time_days = models.PositiveSmallIntegerField(default=0)
    auto_quote = models.BooleanField(default=False)

    # R3 — spec-aligned fields
    fulfillment_mode = models.CharField(
        max_length=12, choices=FulfillmentMode.choices,
        default=FulfillmentMode.MARKET,
    )
    available_quantity_estimate = models.PositiveIntegerField(null=True, blank=True)
    supplier_notes = models.TextField(blank=True)
    # `is_active` is separate from approval_status — a supplier can pause
    # an approved listing without losing its approval state.
    is_active = models.BooleanField(default=True, db_index=True)

    availability_status = models.CharField(
        max_length=20, choices=Availability.choices, default=Availability.IN_STOCK
    )
    stock_quantity = models.IntegerField(null=True, blank=True)
    low_stock_threshold = models.IntegerField(null=True, blank=True)

    approval_status = models.CharField(
        max_length=12, choices=Approval.choices, default=Approval.DRAFT
    )
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "master_product", "pack_type_code"],
                name="uniq_supplier_product_per_pack",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "approval_status"]),
            models.Index(fields=["master_product", "approval_status"]),
            models.Index(fields=["approval_status", "-created_at"]),
        ]

    def __str__(self) -> str:
        return (
            f"SP<org={self.organization_id} "
            f"master={self.master_product_id} pack={self.pack_type_code}>"
        )


class Bundle(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        DEPRECATED = "DEPRECATED", "Deprecated"

    name_en = models.CharField(max_length=255)
    name_ar = models.CharField(max_length=255)
    description_en = models.TextField(blank=True)
    description_ar = models.TextField(blank=True)
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, null=True, blank=True, related_name="bundles"
    )
    image_key = models.CharField(max_length=512, blank=True)

    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    display_order = models.IntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status", "display_order"])]

    def __str__(self) -> str:
        return self.name_en


class BundleItem(models.Model):
    bundle = models.ForeignKey(Bundle, on_delete=models.CASCADE, related_name="items")
    master_product = models.ForeignKey(
        MasterProduct, on_delete=models.PROTECT, related_name="+"
    )
    pack_type_code = models.CharField(max_length=32)
    quantity = models.PositiveIntegerField()
    display_order = models.IntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=["bundle", "display_order"])]
        constraints = [
            models.UniqueConstraint(
                fields=["bundle", "master_product", "pack_type_code"],
                name="uniq_bundle_item",
            ),
        ]

    def __str__(self) -> str:
        return f"BundleItem<bundle={self.bundle_id} master={self.master_product_id}>"


class ProductAdditionRequest(models.Model):
    """A supplier proposes a new master product to the platform admins.
    On approval a MasterProduct is created and `created_master_product` is
    populated."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="product_addition_requests",
        limit_choices_to={"type": "SUPPLIER"},
    )
    proposed_name_en = models.CharField(max_length=255)
    proposed_name_ar = models.CharField(max_length=255)
    proposed_description_en = models.TextField(blank=True)
    proposed_description_ar = models.TextField(blank=True)
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="proposed_products"
    )
    proposed_sku = models.CharField(max_length=64, blank=True)
    proposed_brand = models.CharField(max_length=128, blank=True)
    image_keys = models.JSONField(default=list)
    specs = models.JSONField(default=dict, blank=True)
    proposed_pack_types = models.JSONField(default=list)
    justification = models.TextField(blank=True)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    admin_notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)

    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True, blank=True, related_name="+",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    created_master_product = models.ForeignKey(
        MasterProduct,
        on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"PAR<{self.proposed_name_en} [{self.status}]>"

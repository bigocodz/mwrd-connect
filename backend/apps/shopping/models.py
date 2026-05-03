"""R10 — client-side shopping state.

Three light-weight features that live alongside the master catalog:

1. **Favourite** — per-user bookmark list of master products. The /favourites
   page renders these with `[Remove]` and `[Add to RFQ]` per card.

2. **CompanyCatalog** — per-organization curated list of master products. A
   procurement team's repeat-order shortlist (e.g. "monthly cleaning kit").
   Multiple per org. Each catalog has a name + description + items.

3. **Cart** — an in-progress RFQ draft. The user's "active" cart is the
   one currently being built; `[Save for Later]` flips it to status=SAVED
   with a name and a 7-working-day expires_at, and a fresh active cart
   replaces it. Submitting a cart converts it to an RFQ.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models


class Favourite(models.Model):
    """One row per (user, master_product) pair."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="favourites",
    )
    master_product = models.ForeignKey(
        "catalog.MasterProduct", on_delete=models.CASCADE, related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "master_product"], name="uniq_favourite_per_user_product",
            ),
        ]
        indexes = [models.Index(fields=["user", "-created_at"])]

    def __str__(self) -> str:
        return f"Favourite<u={self.user_id} mp={self.master_product_id}>"


class CompanyCatalog(models.Model):
    """A named curated list of master products owned by an organization."""

    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE,
        related_name="company_catalogs",
        limit_choices_to={"type": "CLIENT"},
    )
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"], name="uniq_company_catalog_name",
            ),
        ]
        indexes = [models.Index(fields=["organization", "name"])]

    def __str__(self) -> str:
        return f"CompanyCatalog<{self.name} org={self.organization_id}>"


class CompanyCatalogItem(models.Model):
    catalog = models.ForeignKey(
        CompanyCatalog, on_delete=models.CASCADE, related_name="items",
    )
    master_product = models.ForeignKey(
        "catalog.MasterProduct", on_delete=models.CASCADE, related_name="+",
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["catalog", "master_product"], name="uniq_catalog_item",
            ),
        ]
        indexes = [models.Index(fields=["catalog", "-added_at"])]

    def __str__(self) -> str:
        return f"CCI<c={self.catalog_id} mp={self.master_product_id}>"


class Cart(models.Model):
    """RFQ draft. Each user has at most one ACTIVE cart at a time; SAVED
    carts can pile up until they expire (7 working days)."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        SAVED = "SAVED", "Saved"
        SUBMITTED = "SUBMITTED", "Submitted (converted to RFQ)"
        EXPIRED = "EXPIRED", "Expired"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="carts",
    )
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE,
        related_name="carts", limit_choices_to={"type": "CLIENT"},
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.ACTIVE, db_index=True,
    )
    name = models.CharField(max_length=128, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)

    submitted_rfq = models.ForeignKey(
        "rfqs.Rfq", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # At most one ACTIVE cart per (user, org). Postgres partial unique
            # index expressed via UniqueConstraint(condition=...).
            models.UniqueConstraint(
                fields=["user", "organization"],
                condition=models.Q(status="ACTIVE"),
                name="uniq_active_cart_per_user_org",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status", "expires_at"]),
        ]

    def __str__(self) -> str:
        return f"Cart<u={self.user_id} {self.status} {self.name or '(unnamed)'}>"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    master_product = models.ForeignKey(
        "catalog.MasterProduct", on_delete=models.CASCADE, related_name="+",
    )
    pack_type_code = models.CharField(max_length=32)
    quantity = models.PositiveIntegerField()
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "master_product", "pack_type_code"],
                name="uniq_cart_item",
            ),
        ]
        indexes = [models.Index(fields=["cart"])]

    def __str__(self) -> str:
        return f"CartItem<c={self.cart_id} mp={self.master_product_id}>"

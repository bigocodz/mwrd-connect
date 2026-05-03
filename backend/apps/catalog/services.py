"""Catalog domain services. View-thin / service-fat pattern."""
from __future__ import annotations

import secrets
from typing import Any

from django.contrib.postgres.search import (
    SearchQuery,
    SearchRank,
    SearchVector,
)
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from .models import (
    Bundle,
    BundleItem,
    Category,
    MasterProduct,
    ProductAdditionRequest,
    SupplierProduct,
)


class CatalogError(Exception):  # noqa: N818
    pass


# ---------- Image upload key helpers ----------


def make_image_key(*, owner: str, owner_id: int, filename: str) -> str:
    """Predictable, unguessable key for catalog images.
    `owner` is "master" or "supplier" or "request"."""
    suffix = secrets.token_hex(8)
    safe = filename.replace("/", "_")[:120]
    return f"catalog/{owner}/{owner_id}/{suffix}-{safe}"


# ---------- Master products ----------


def _build_search_vector() -> SearchVector:
    return (
        SearchVector("name_en", weight="A", config="english")
        + SearchVector("name_ar", weight="A", config="simple")
        + SearchVector("brand", weight="B", config="english")
        + SearchVector("sku", weight="B", config="simple")
        + SearchVector("description_en", weight="C", config="english")
    )


@transaction.atomic
def create_master_product(*, by, **fields) -> MasterProduct:
    from apps.core.numbering import DocumentKind, next_number

    fields.setdefault("master_product_code", next_number(DocumentKind.PROD))
    mp = MasterProduct.objects.create(created_by=by, **fields)
    refresh_search_vector(mp)
    return mp


@transaction.atomic
def update_master_product(mp: MasterProduct, **fields) -> MasterProduct:
    for k, v in fields.items():
        setattr(mp, k, v)
    mp.save()
    refresh_search_vector(mp)
    return mp


def refresh_search_vector(mp: MasterProduct) -> None:
    MasterProduct.objects.filter(pk=mp.pk).update(search_vector=_build_search_vector())


def deprecate_master_product(mp: MasterProduct, *, reason: str) -> MasterProduct:
    mp.status = MasterProduct.Status.DEPRECATED
    mp.deprecated_at = timezone.now()
    mp.deprecation_reason = reason
    mp.save(update_fields=["status", "deprecated_at", "deprecation_reason", "updated_at"])
    return mp


def search_master_products(
    *,
    q: str | None = None,
    category_id: int | None = None,
    only_active: bool = True,
    limit: int = 50,
) -> QuerySet[MasterProduct]:
    qs = MasterProduct.objects.select_related("category")
    if only_active:
        qs = qs.filter(status=MasterProduct.Status.ACTIVE)
    if category_id is not None:
        # Include descendants of the chosen category.
        descendant_ids = _descendant_ids(category_id)
        qs = qs.filter(category_id__in=descendant_ids)
    if q:
        # Search across en + simple (handles Arabic / SKU). Rank by similarity.
        query = SearchQuery(q, config="simple") | SearchQuery(q, config="english")
        qs = (
            qs.filter(search_vector=query)
            .annotate(rank=SearchRank("search_vector", query))
            .order_by("-rank", "-created_at")
        )
    else:
        qs = qs.order_by("display_order", "-created_at")
    return qs[:limit]


# ---------- Categories ----------


def _descendant_ids(root_id: int) -> list[int]:
    """Recursive walk — small trees (4 levels) so this is fine without CTE."""
    out: list[int] = [root_id]
    frontier = [root_id]
    while frontier:
        children = list(
            Category.objects.filter(parent_id__in=frontier).values_list("id", flat=True)
        )
        if not children:
            break
        out.extend(children)
        frontier = children
    return out


@transaction.atomic
def create_category(*, parent_id: int | None = None, **fields) -> Category:
    parent = Category.objects.get(id=parent_id) if parent_id else None
    level = 0 if parent is None else parent.level + 1
    if level > 3:
        raise CatalogError("Category nesting limit (level 3) exceeded")
    return Category.objects.create(parent=parent, level=level, **fields)


# ---------- Supplier products ----------


@transaction.atomic
def create_supplier_product(
    *, organization, master_product: MasterProduct, **fields
) -> SupplierProduct:
    return SupplierProduct.objects.create(
        organization=organization,
        master_product=master_product,
        approval_status=SupplierProduct.Approval.DRAFT,
        **fields,
    )


def submit_supplier_product(sp: SupplierProduct) -> SupplierProduct:
    if sp.approval_status not in (
        SupplierProduct.Approval.DRAFT,
        SupplierProduct.Approval.REJECTED,
    ):
        raise CatalogError(f"Cannot submit a {sp.approval_status} supplier product")
    sp.approval_status = SupplierProduct.Approval.PENDING
    sp.rejection_reason = ""
    sp.save(update_fields=["approval_status", "rejection_reason", "updated_at"])
    return sp


def approve_supplier_product(sp: SupplierProduct) -> SupplierProduct:
    if sp.approval_status != SupplierProduct.Approval.PENDING:
        raise CatalogError(f"Cannot approve a {sp.approval_status} listing")
    sp.approval_status = SupplierProduct.Approval.APPROVED
    sp.save(update_fields=["approval_status", "updated_at"])
    return sp


def reject_supplier_product(sp: SupplierProduct, *, reason: str) -> SupplierProduct:
    if sp.approval_status != SupplierProduct.Approval.PENDING:
        raise CatalogError(f"Cannot reject a {sp.approval_status} listing")
    if not reason:
        raise CatalogError("Rejection reason is required")
    sp.approval_status = SupplierProduct.Approval.REJECTED
    sp.rejection_reason = reason
    sp.save(update_fields=["approval_status", "rejection_reason", "updated_at"])
    return sp


# ---------- Product addition requests ----------


@transaction.atomic
def create_product_addition_request(*, organization, **fields) -> ProductAdditionRequest:
    return ProductAdditionRequest.objects.create(organization=organization, **fields)


@transaction.atomic
def approve_product_addition_request(
    req: ProductAdditionRequest, *, by, admin_notes: str = ""
) -> ProductAdditionRequest:
    if req.status != ProductAdditionRequest.Status.PENDING:
        raise CatalogError(f"Cannot approve a {req.status} request")
    mp = create_master_product(
        by=by,
        name_en=req.proposed_name_en,
        name_ar=req.proposed_name_ar,
        description_en=req.proposed_description_en,
        description_ar=req.proposed_description_ar,
        category=req.category,
        sku=req.proposed_sku,
        brand=req.proposed_brand,
        image_keys=req.image_keys,
        specs=req.specs,
        pack_types=req.proposed_pack_types,
    )
    req.status = ProductAdditionRequest.Status.APPROVED
    req.admin_notes = admin_notes
    req.decided_by = by
    req.decided_at = timezone.now()
    req.created_master_product = mp
    req.save(update_fields=[
        "status", "admin_notes", "decided_by", "decided_at",
        "created_master_product", "updated_at",
    ])
    return req


def reject_product_addition_request(
    req: ProductAdditionRequest, *, by, reason: str
) -> ProductAdditionRequest:
    if req.status != ProductAdditionRequest.Status.PENDING:
        raise CatalogError(f"Cannot reject a {req.status} request")
    if not reason:
        raise CatalogError("Rejection reason is required")
    req.status = ProductAdditionRequest.Status.REJECTED
    req.rejection_reason = reason
    req.decided_by = by
    req.decided_at = timezone.now()
    req.save(update_fields=[
        "status", "rejection_reason", "decided_by", "decided_at", "updated_at",
    ])
    return req


# ---------- Bundles ----------


@transaction.atomic
def create_bundle_with_items(
    *, by, items: list[dict[str, Any]], **bundle_fields
) -> Bundle:
    bundle = Bundle.objects.create(created_by=by, **bundle_fields)
    for idx, it in enumerate(items):
        BundleItem.objects.create(
            bundle=bundle,
            master_product_id=it["master_product_id"],
            pack_type_code=it["pack_type_code"],
            quantity=it["quantity"],
            display_order=it.get("display_order", idx),
            notes=it.get("notes", ""),
        )
    return bundle

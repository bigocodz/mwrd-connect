"""Phase 3 service-layer tests: search, lifecycle, moderation, bundles."""
import pytest

from apps.catalog import services
from apps.catalog.models import (
    ProductAdditionRequest,
    SupplierProduct,
)


@pytest.mark.django_db
def test_create_category_enforces_max_depth(db, category):
    a = services.create_category(parent_id=category.id, slug="a", name_en="A", name_ar="A")
    b = services.create_category(parent_id=a.id, slug="b", name_en="B", name_ar="B")
    c = services.create_category(parent_id=b.id, slug="c", name_en="C", name_ar="C")
    assert c.level == 3
    with pytest.raises(services.CatalogError):
        services.create_category(parent_id=c.id, slug="d", name_en="D", name_ar="D")


@pytest.mark.django_db
def test_search_finds_by_name(master_product):
    out = list(services.search_master_products(q="industrial"))
    assert master_product in out


@pytest.mark.django_db
def test_search_finds_by_brand(master_product):
    out = list(services.search_master_products(q="Acme"))
    assert master_product in out


@pytest.mark.django_db
def test_search_excludes_deprecated(master_product):
    services.deprecate_master_product(master_product, reason="EOL")
    out = list(services.search_master_products(q="industrial"))
    assert master_product not in out


@pytest.mark.django_db
def test_search_filters_by_category_descendants(master_product, category, staff_user):
    sub = services.create_category(parent_id=category.id, slug="floor", name_en="Floor", name_ar="A")
    other = services.create_master_product(
        by=staff_user, name_en="Mop", name_ar="ممسحة", description_en="",
        description_ar="", category=sub, image_keys=[], pack_types=[],
    )
    # Searching at root category should include both
    found = set(services.search_master_products(category_id=category.id))
    assert {master_product, other} <= found
    # Searching at sub category should be just the sub one
    found_sub = set(services.search_master_products(category_id=sub.id))
    assert found_sub == {other}


@pytest.mark.django_db
def test_supplier_product_lifecycle(master_product, supplier_org_a):
    sp = services.create_supplier_product(
        organization=supplier_org_a, master_product=master_product,
        pack_type_code="EACH", cost_price="12.50",
    )
    assert sp.approval_status == SupplierProduct.Approval.DRAFT
    services.submit_supplier_product(sp)
    assert sp.approval_status == SupplierProduct.Approval.PENDING
    services.approve_supplier_product(sp)
    assert sp.approval_status == SupplierProduct.Approval.APPROVED


@pytest.mark.django_db
def test_supplier_product_reject_requires_reason(master_product, supplier_org_a):
    sp = services.create_supplier_product(
        organization=supplier_org_a, master_product=master_product,
        pack_type_code="EACH", cost_price="12.50",
    )
    services.submit_supplier_product(sp)
    with pytest.raises(services.CatalogError):
        services.reject_supplier_product(sp, reason="")
    services.reject_supplier_product(sp, reason="Cost too low")
    assert sp.approval_status == SupplierProduct.Approval.REJECTED
    assert sp.rejection_reason == "Cost too low"


@pytest.mark.django_db
def test_addition_request_approve_creates_master_product(supplier_org_a, category, staff_user):
    req = services.create_product_addition_request(
        organization=supplier_org_a,
        proposed_name_en="Hand soap 500ml",
        proposed_name_ar="صابون يد",
        category=category,
        proposed_pack_types=[{"code": "EACH", "label_en": "Each", "label_ar": "وحدة", "base_qty": 1, "uom": "PCS"}],
    )
    services.approve_product_addition_request(req, by=staff_user, admin_notes="ok")
    assert req.status == ProductAdditionRequest.Status.APPROVED
    assert req.created_master_product is not None
    mp = req.created_master_product
    assert mp.name_en == "Hand soap 500ml"
    # Searching for the new product works (search_vector populated by service)
    assert mp in list(services.search_master_products(q="soap"))


@pytest.mark.django_db
def test_addition_request_reject_requires_reason(supplier_org_a, category, staff_user):
    req = services.create_product_addition_request(
        organization=supplier_org_a, proposed_name_en="x", proposed_name_ar="x",
        category=category,
    )
    with pytest.raises(services.CatalogError):
        services.reject_product_addition_request(req, by=staff_user, reason="")
    services.reject_product_addition_request(req, by=staff_user, reason="duplicate")
    assert req.status == ProductAdditionRequest.Status.REJECTED


@pytest.mark.django_db
def test_bundle_with_items(master_product, staff_user):
    bundle = services.create_bundle_with_items(
        by=staff_user,
        items=[
            {"master_product_id": master_product.id, "pack_type_code": "EACH", "quantity": 2},
        ],
        name_en="Starter pack", name_ar="حزمة",
    )
    assert bundle.items.count() == 1
    item = bundle.items.first()
    assert item.master_product_id == master_product.id
    assert item.quantity == 2

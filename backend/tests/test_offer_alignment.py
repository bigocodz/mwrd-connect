"""R3 — supplier offer wire shape matches the spec ('Offer' entity).

Spec field set on the wire:
- pack_type_pricing[]:    [{pack_type, supplier_cost_sar, min_order_qty}]
- default_lead_time_days
- available_quantity_estimate (nullable)
- auto_quote_enabled
- fulfillment_mode ('EXPRESS' | 'MARKET')
- supplier_internal_sku (nullable)
- supplier_notes (nullable)
- approval_status / status (active|inactive)
"""
import pytest

from apps.organizations.models import Membership

from .conftest import login_as


@pytest.fixture
def supplier_user_a(db, supplier_org_a):
    from apps.accounts.models import User
    user = User.objects.create_user(email="r3-a@sup.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=user, organization=supplier_org_a, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.mark.django_db
def test_create_offer_returns_spec_wire_shape(
    api_client, master_product, supplier_user_a, supplier_org_a,
):
    login_as(api_client, supplier_user_a, supplier_org_a)
    resp = api_client.post(
        "/api/catalog/supplier/products",
        {
            "master_product": master_product.id,
            "pack_type_code": "EACH",
            "cost_price": "12.50",
            "moq": 5,
            "default_lead_time_days": 3,
            "auto_quote_enabled": True,
            "fulfillment_mode": "EXPRESS",
            "supplier_internal_sku": "SKU-EACH-1",
            "supplier_notes": "In Riyadh warehouse.",
            "available_quantity_estimate": 250,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.content
    body = resp.json()
    # Spec field aliases populated correctly
    assert body["auto_quote_enabled"] is True
    assert body["default_lead_time_days"] == 3
    assert body["supplier_internal_sku"] == "SKU-EACH-1"
    assert body["fulfillment_mode"] == "EXPRESS"
    assert body["available_quantity_estimate"] == 250
    assert body["supplier_notes"] == "In Riyadh warehouse."
    assert body["is_active"] is True
    # Pack-type pricing wire shape
    pricing = body["pack_type_pricing"]
    assert isinstance(pricing, list) and len(pricing) == 1
    assert pricing[0]["pack_type"] == "EACH"
    assert pricing[0]["supplier_cost_sar"] == "12.50"
    assert pricing[0]["min_order_qty"] == 5


@pytest.mark.django_db
def test_offer_defaults_when_optional_fields_omitted(
    api_client, master_product, supplier_user_a, supplier_org_a,
):
    """The spec-shape aliases are optional — model defaults take over."""
    login_as(api_client, supplier_user_a, supplier_org_a)
    resp = api_client.post(
        "/api/catalog/supplier/products",
        {
            "master_product": master_product.id,
            "pack_type_code": "CASE",
            "cost_price": "40.00",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["auto_quote_enabled"] is False
    assert body["default_lead_time_days"] == 0
    assert body["fulfillment_mode"] == "MARKET"
    assert body["is_active"] is True


@pytest.mark.django_db
def test_supplier_can_pause_listing_without_losing_approval(
    api_client, master_product, supplier_user_a, supplier_org_a,
):
    """is_active is independent of approval_status — pausing keeps approval."""
    login_as(api_client, supplier_user_a, supplier_org_a)
    sp = api_client.post(
        "/api/catalog/supplier/products",
        {"master_product": master_product.id, "pack_type_code": "EACH", "cost_price": "10.00"},
        format="json",
    ).json()

    # Patch is_active=False
    patch = api_client.patch(
        f"/api/catalog/supplier/products/{sp['id']}",
        {"is_active": False},
        format="json",
    )
    assert patch.status_code == 200, patch.content
    assert patch.json()["is_active"] is False
    # Approval status untouched (still DRAFT — never submitted)
    assert patch.json()["approval_status"] == "DRAFT"

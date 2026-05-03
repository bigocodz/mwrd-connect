"""R4 — margin engine.

Locks the spec rules:
- Resolution order: client > category > global.
- Falls back to settings.DEFAULT_MARGIN_PCT (15%) when no rule matches.
- Final price = cost * (1 + pct/100), rounded to 2dp.
- Override `margin_pct` arg wins over the resolver (used by Quote Manager
  slider in R5).
- Customer/supplier portals never see margin pct in any API response.
"""
from decimal import Decimal

import pytest

from apps.pricing import services as pricing
from apps.pricing.models import Margin

from .conftest import login_as


@pytest.mark.django_db
def test_default_global_margin_is_15_pct():
    assert pricing.get_global_margin_pct() == Decimal("15.00")


@pytest.mark.django_db
def test_apply_margin_uses_global_when_no_overrides():
    final, applied = pricing.apply_margin(supplier_unit_price_sar="100.00")
    assert applied == Decimal("15.00")
    assert final == Decimal("115.00")


@pytest.mark.django_db
def test_category_override_beats_global(category, staff_user):
    pricing.set_category_margin(category_id=category.id, pct="20.00", by=staff_user)
    pct = pricing.resolve_margin_pct(client_org_id=None, category_id=category.id)
    assert pct == Decimal("20.00")


@pytest.mark.django_db
def test_client_override_beats_category_and_global(category, org_a, staff_user):
    pricing.set_category_margin(category_id=category.id, pct="20.00", by=staff_user)
    pricing.set_client_margin(client_org_id=org_a.id, pct="8.00", by=staff_user)
    pct = pricing.resolve_margin_pct(client_org_id=org_a.id, category_id=category.id)
    assert pct == Decimal("8.00")


@pytest.mark.django_db
def test_apply_margin_explicit_override_wins(category, staff_user):
    """Backoffice Quote Manager slider passes an explicit pct."""
    pricing.set_category_margin(category_id=category.id, pct="20.00", by=staff_user)
    final, applied = pricing.apply_margin(
        supplier_unit_price_sar="50.00", margin_pct="12.00", category_id=category.id,
    )
    assert applied == Decimal("12.00")
    assert final == Decimal("56.00")


@pytest.mark.django_db
def test_rounds_to_two_decimals_half_up():
    final, _ = pricing.apply_margin(supplier_unit_price_sar="33.33", margin_pct="15.00")
    # 33.33 * 1.15 = 38.3295 → 38.33
    assert final == Decimal("38.33")


@pytest.mark.django_db
def test_global_margin_unique_per_scope_id_null(staff_user):
    """Updating global twice should upsert, not create a duplicate row."""
    a = pricing.set_global_margin(pct="10.00", by=staff_user)
    b = pricing.set_global_margin(pct="11.50", by=staff_user)
    assert a.id == b.id
    assert b.pct == Decimal("11.50")
    assert Margin.objects.filter(scope=Margin.Scope.GLOBAL).count() == 1


# ---------- Staff endpoints ----------


@pytest.mark.django_db
def test_staff_can_list_margins(api_client, staff_user, category):
    pricing.set_category_margin(category_id=category.id, pct="22.00", by=staff_user)
    login_as(api_client, staff_user, scope="staff")
    resp = api_client.get("/api/staff/margins")
    assert resp.status_code == 200
    body = resp.json()
    assert any(r["scope"] == "CATEGORY" and r["scope_id"] == category.id for r in body)


@pytest.mark.django_db
def test_customer_cannot_read_margins(api_client, user_in_org_a, org_a):
    """Anonymity rule: margins are server-side-only — customers get 403."""
    login_as(api_client, user_in_org_a, org_a)
    resp = api_client.get("/api/staff/margins")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_staff_set_global_margin(api_client, staff_user):
    login_as(api_client, staff_user, scope="staff")
    resp = api_client.post(
        "/api/staff/margins/global", {"pct": "12.50"}, format="json",
    )
    assert resp.status_code == 200, resp.content
    assert resp.json()["pct"] == "12.50"
    assert pricing.get_global_margin_pct() == Decimal("12.50")


@pytest.mark.django_db
def test_staff_set_client_override(api_client, staff_user, org_a):
    login_as(api_client, staff_user, scope="staff")
    resp = api_client.post(
        "/api/staff/margins/client",
        {"client_org_id": org_a.id, "pct": "8.00"}, format="json",
    )
    assert resp.status_code == 200
    assert pricing.resolve_margin_pct(
        client_org_id=org_a.id, category_id=None,
    ) == Decimal("8.00")


@pytest.mark.django_db
def test_global_margin_cannot_be_deleted(api_client, staff_user):
    login_as(api_client, staff_user, scope="staff")
    api_client.post("/api/staff/margins/global", {"pct": "15.00"}, format="json")
    g = Margin.objects.get(scope=Margin.Scope.GLOBAL)
    resp = api_client.delete(f"/api/staff/margins/{g.id}")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_category_margin_can_be_deleted(api_client, staff_user, category):
    login_as(api_client, staff_user, scope="staff")
    api_client.post(
        "/api/staff/margins/category",
        {"category_id": category.id, "pct": "18.00"}, format="json",
    )
    m = Margin.objects.get(scope=Margin.Scope.CATEGORY, scope_id=category.id)
    resp = api_client.delete(f"/api/staff/margins/{m.id}")
    assert resp.status_code == 204
    assert not Margin.objects.filter(id=m.id).exists()

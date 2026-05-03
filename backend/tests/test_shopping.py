"""R10 — Carts + Favourites + CompanyCatalog.

Spec § client app:
- /favourites: per-user list of master products.
- /catalogs: per-org curated lists, multiple per company.
- /cart: active draft. /cart/saved: parked baskets. Saved carts expire 7
  working days after save.
- Saved cart can be Resumed (active swap) or Submitted (becomes an RFQ).
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.organizations.models import Membership, Organization
from apps.rfqs.models import Rfq
from apps.shopping.models import Cart, CompanyCatalog, Favourite
from apps.shopping.services import (
    ShoppingError,
    add_working_days,
    expire_due_saved_carts,
    save_cart,
    submit_cart_as_rfq,
)

from .conftest import login_as


@pytest.fixture
def client_user(db, org_a):
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    u = User.objects.create_user(email="alice@a.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=u, organization=org_a, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return u


# ---------- Working-day helper ----------


def test_add_working_days_skips_friday_and_saturday():
    """Sunday + 7 working days = Tuesday week-after-next."""
    # 2025-01-05 is a Sunday (weekday=6).
    sunday = datetime(2025, 1, 5, 12, 0)
    out = add_working_days(sunday, 7)
    # 7 working days from Sunday Jan 5: Mon 6, Tue 7, Wed 8, Thu 9, Sun 12,
    # Mon 13, Tue 14 → ends on Tue Jan 14.
    assert out.date() == datetime(2025, 1, 14).date()


def test_add_working_days_returns_weekday():
    """Result should never land on Friday or Saturday."""
    base = datetime(2025, 1, 5, 12, 0)
    for n in range(1, 30):
        out = add_working_days(base, n)
        assert out.weekday() not in (4, 5), f"add_working_days({n}) = {out}"


# ---------- Favourites ----------


@pytest.mark.django_db
def test_favourites_add_list_remove(api_client, client_user, org_a, master_product):
    login_as(api_client, client_user, org_a)
    add = api_client.post("/api/favourites", {"master_product_id": master_product.id}, format="json")
    assert add.status_code == 201
    lst = api_client.get("/api/favourites").json()
    assert any(f["master_product"] == master_product.id for f in lst)

    rm = api_client.delete(f"/api/favourites/{master_product.id}")
    assert rm.status_code == 204
    assert Favourite.objects.filter(user=client_user).count() == 0


@pytest.mark.django_db
def test_favourites_add_is_idempotent(api_client, client_user, org_a, master_product):
    login_as(api_client, client_user, org_a)
    api_client.post("/api/favourites", {"master_product_id": master_product.id}, format="json")
    api_client.post("/api/favourites", {"master_product_id": master_product.id}, format="json")
    assert Favourite.objects.filter(user=client_user).count() == 1


# ---------- Company catalog ----------


@pytest.mark.django_db
def test_company_catalog_crud(api_client, client_user, org_a, master_product):
    login_as(api_client, client_user, org_a)
    create = api_client.post("/api/catalogs", {
        "name": "Monthly cleaning kit",
        "description": "Repeat order set",
    }, format="json")
    assert create.status_code == 201
    cat_id = create.json()["id"]

    add = api_client.post(
        f"/api/catalogs/{cat_id}/items",
        {"master_product_id": master_product.id}, format="json",
    )
    assert add.status_code == 201
    body = add.json()
    assert body["item_count"] == 1

    rm = api_client.delete(f"/api/catalogs/{cat_id}/items/{master_product.id}")
    assert rm.status_code == 204
    detail = api_client.get(f"/api/catalogs/{cat_id}").json()
    assert detail["item_count"] == 0


@pytest.mark.django_db
def test_company_catalog_name_required(api_client, client_user, org_a):
    login_as(api_client, client_user, org_a)
    resp = api_client.post("/api/catalogs", {"name": "  "}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_company_catalog_scoped_to_org(
    api_client, client_user, user_in_org_b, org_a, org_b, master_product,
):
    """Org B's user cannot see org A's catalogs."""
    login_as(api_client, client_user, org_a)
    api_client.post("/api/catalogs", {"name": "A list"}, format="json")
    org_b.type = "CLIENT"
    org_b.save(update_fields=["type"])
    login_as(api_client, user_in_org_b, org_b)
    body = api_client.get("/api/catalogs").json()
    assert all(c["name"] != "A list" for c in body)


# ---------- Cart ----------


@pytest.mark.django_db
def test_cart_add_and_get_creates_active_cart(
    api_client, client_user, org_a, master_product,
):
    login_as(api_client, client_user, org_a)
    add = api_client.post("/api/cart", {
        "master_product": master_product.id, "pack_type_code": "EACH", "quantity": 3,
    }, format="json")
    assert add.status_code == 201, add.content
    body = add.json()
    assert body["status"] == "ACTIVE"
    assert body["item_count"] == 1
    # Adding the same line increments qty rather than creating a duplicate row.
    api_client.post("/api/cart", {
        "master_product": master_product.id, "pack_type_code": "EACH", "quantity": 2,
    }, format="json")
    cart = api_client.get("/api/cart").json()
    assert cart["item_count"] == 1
    assert cart["items"][0]["quantity"] == 5


@pytest.mark.django_db
def test_save_cart_sets_expiry(api_client, client_user, org_a, master_product):
    login_as(api_client, client_user, org_a)
    api_client.post("/api/cart", {
        "master_product": master_product.id, "pack_type_code": "EACH", "quantity": 1,
    }, format="json")
    saved = api_client.post(
        "/api/cart/save", {"name": "Q1 supplies"}, format="json",
    )
    assert saved.status_code == 200
    body = saved.json()
    assert body["status"] == "SAVED"
    assert body["expires_at"] is not None


@pytest.mark.django_db
def test_save_cart_requires_name(api_client, client_user, org_a, master_product):
    login_as(api_client, client_user, org_a)
    api_client.post("/api/cart", {
        "master_product": master_product.id, "pack_type_code": "EACH", "quantity": 1,
    }, format="json")
    resp = api_client.post("/api/cart/save", {"name": ""}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_resume_swaps_active_cart(api_client, client_user, org_a, master_product):
    """Resuming a saved cart keeps any current active cart by re-saving it."""
    login_as(api_client, client_user, org_a)
    # Build cart A and save it.
    api_client.post("/api/cart", {
        "master_product": master_product.id, "pack_type_code": "EACH", "quantity": 1,
    }, format="json")
    saved_a = api_client.post("/api/cart/save", {"name": "A"}, format="json").json()

    # Build cart B.
    api_client.post("/api/cart", {
        "master_product": master_product.id, "pack_type_code": "CASE", "quantity": 2,
    }, format="json")

    # Resume A — B should be auto-saved.
    resume = api_client.post(f"/api/cart/{saved_a['id']}/resume")
    assert resume.status_code == 200
    assert resume.json()["status"] == "ACTIVE"
    assert resume.json()["id"] == saved_a["id"]
    saved = Cart.objects.filter(
        user=client_user, organization=org_a, status=Cart.Status.SAVED,
    )
    assert saved.count() == 1
    assert saved.first().name.startswith("Auto-saved")


@pytest.mark.django_db
def test_submit_cart_creates_published_rfq(
    api_client, client_user, org_a, master_product,
):
    login_as(api_client, client_user, org_a)
    api_client.post("/api/cart", {
        "master_product": master_product.id, "pack_type_code": "EACH", "quantity": 4,
    }, format="json")
    cart = api_client.get("/api/cart").json()
    submit = api_client.post(
        f"/api/cart/{cart['id']}/submit",
        {"title": "Q1 restock", "description": "first batch", "delivery_location": "Riyadh"},
        format="json",
    )
    assert submit.status_code == 201, submit.content
    rfq_body = submit.json()
    assert rfq_body["status"] == "PUBLISHED"
    assert len(rfq_body["items"]) == 1
    # The cart is now SUBMITTED, with submitted_rfq pointing at the RFQ.
    cart_obj = Cart.objects.get(id=cart["id"])
    assert cart_obj.status == Cart.Status.SUBMITTED
    assert cart_obj.submitted_rfq_id == rfq_body["id"]


@pytest.mark.django_db
def test_submit_empty_cart_rejected(client_user, org_a):
    cart = Cart.objects.create(
        user=client_user, organization=org_a, status=Cart.Status.ACTIVE,
    )
    with pytest.raises(ShoppingError, match="empty"):
        submit_cart_as_rfq(cart=cart, user=client_user, title="x")


@pytest.mark.django_db
def test_expired_carts_are_swept(client_user, org_a, master_product):
    """expire_due_saved_carts flips SAVED rows past their expires_at."""
    cart = Cart.objects.create(
        user=client_user, organization=org_a, status=Cart.Status.SAVED,
        name="old", expires_at=timezone.now() - timedelta(hours=1),
    )
    n = expire_due_saved_carts()
    assert n == 1
    cart.refresh_from_db()
    assert cart.status == Cart.Status.EXPIRED


@pytest.mark.django_db
def test_only_one_active_cart_per_user_org(client_user, org_a, master_product):
    """The unique constraint blocks two ACTIVE rows for the same user+org."""
    Cart.objects.create(user=client_user, organization=org_a, status=Cart.Status.ACTIVE)
    from django.db import IntegrityError
    with pytest.raises(IntegrityError):
        Cart.objects.create(
            user=client_user, organization=org_a, status=Cart.Status.ACTIVE,
        )

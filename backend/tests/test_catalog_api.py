"""Phase 3 HTTP-level tests: cross-org isolation + role gating + search."""
import pytest

from apps.organizations.models import Membership

from .conftest import login_as


@pytest.fixture
def supplier_user_a(db, supplier_org_a):
    from apps.accounts.models import User

    user = User.objects.create_user(email="a@sup.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=user, organization=supplier_org_a, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def supplier_user_b(db, supplier_org_b):
    from apps.accounts.models import User

    user = User.objects.create_user(email="b@sup.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=user, organization=supplier_org_b, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.mark.django_db
def test_supplier_only_sees_own_products(
    api_client, master_product, supplier_user_a, supplier_user_b,
    supplier_org_a, supplier_org_b,
):
    """Supplier A creates a listing — supplier B must not see it."""
    login_as(api_client, supplier_user_a, supplier_org_a)
    create = api_client.post(
        "/api/catalog/supplier/products",
        {
            "master_product": master_product.id,
            "pack_type_code": "EACH",
            "cost_price": "10.00",
        },
        format="json",
    )
    assert create.status_code == 201, create.content
    sp_id = create.json()["id"]

    # Supplier B sees their own list (empty)
    login_as(api_client, supplier_user_b, supplier_org_b)
    listing = api_client.get("/api/catalog/supplier/products")
    assert listing.status_code == 200
    assert listing.json() == []

    # Supplier B cannot fetch supplier A's listing detail
    detail = api_client.get(f"/api/catalog/supplier/products/{sp_id}")
    assert detail.status_code == 404


@pytest.mark.django_db
def test_supplier_search_works(api_client, master_product, supplier_user_a, supplier_org_a):
    login_as(api_client, supplier_user_a, supplier_org_a)
    resp = api_client.get("/api/catalog/products?q=industrial")
    assert resp.status_code == 200
    body = resp.json()
    assert any(item["id"] == master_product.id for item in body)


@pytest.mark.django_db
def test_client_can_browse_categories(api_client, category, user_in_org_a, org_a):
    login_as(api_client, user_in_org_a, org_a)
    resp = api_client.get("/api/catalog/categories")
    assert resp.status_code == 200
    body = resp.json()
    assert any(c["slug"] == "cleaning" for c in body)


@pytest.mark.django_db
def test_staff_can_approve_supplier_product(
    api_client, master_product, supplier_user_a, supplier_org_a, staff_user,
):
    # Supplier creates + submits
    login_as(api_client, supplier_user_a, supplier_org_a)
    create = api_client.post(
        "/api/catalog/supplier/products",
        {"master_product": master_product.id, "pack_type_code": "EACH", "cost_price": "10.00"},
        format="json",
    )
    sp_id = create.json()["id"]
    submit = api_client.post(f"/api/catalog/supplier/products/{sp_id}/submit")
    assert submit.status_code == 200

    # Staff sees it in the review queue
    login_as(api_client, staff_user, scope="staff")
    queue = api_client.get("/api/staff/catalog/supplier-products")
    assert queue.status_code == 200
    assert any(s["id"] == sp_id for s in queue.json())

    approve = api_client.post(f"/api/staff/catalog/supplier-products/{sp_id}/approve")
    assert approve.status_code == 200
    assert approve.json()["approval_status"] == "APPROVED"


@pytest.mark.django_db
def test_addition_request_flow_via_http(
    api_client, supplier_user_a, supplier_org_a, category, staff_user,
):
    # Supplier proposes a new master product
    login_as(api_client, supplier_user_a, supplier_org_a)
    create = api_client.post(
        "/api/catalog/supplier/addition-requests",
        {
            "proposed_name_en": "Window cleaner",
            "proposed_name_ar": "منظف زجاج",
            "category": category.id,
            "proposed_pack_types": [
                {"code": "EACH", "label_en": "Each", "label_ar": "و", "base_qty": 1, "uom": "PCS"},
            ],
            "justification": "Common B2B SKU",
        },
        format="json",
    )
    assert create.status_code == 201, create.content
    req_id = create.json()["id"]

    # Staff approves → master product is created
    login_as(api_client, staff_user, scope="staff")
    approve = api_client.post(
        f"/api/staff/catalog/addition-requests/{req_id}/approve",
        {"notes": "good"},
        format="json",
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "APPROVED"
    assert approve.json()["created_master_product_id"] is not None


@pytest.mark.django_db
def test_client_cannot_call_supplier_endpoints(
    api_client, master_product, user_in_org_a, org_a,
):
    """Supplier endpoints reject CLIENT orgs."""
    login_as(api_client, user_in_org_a, org_a)
    resp = api_client.get("/api/catalog/supplier/products")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_unauth_cannot_browse(api_client):
    resp = api_client.get("/api/catalog/products")
    assert resp.status_code == 401

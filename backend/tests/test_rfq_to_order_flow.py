"""Phase 4: end-to-end RFQ → Quote → Contract → Order via the HTTP API.

Confirms: client can create+publish an RFQ; supplier sees it in inbox; quote
draft is auto-created with a row per RFQ line; supplier sets prices, submits;
client awards → Contract is created; both parties sign → Order issued; supplier
confirms.
"""
import pytest

from apps.organizations.models import Membership

from .conftest import login_as


@pytest.fixture
def client_user(db, org_a):
    """Reuse org_a (CLIENT) — set its name explicitly for clarity."""
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    from apps.accounts.models import User

    u = User.objects.create_user(email="alice@client.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=u, organization=org_a, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return u


@pytest.fixture
def supplier_user(db, supplier_org_a):
    from apps.accounts.models import User

    u = User.objects.create_user(email="bob@sup.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=u, organization=supplier_org_a, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return u


@pytest.mark.django_db
def test_full_rfq_to_order_happy_path(
    api_client, master_product, org_a, supplier_org_a,
    client_user, supplier_user,
):
    # 1. Client creates an RFQ
    login_as(api_client, client_user, org_a)
    create = api_client.post("/api/rfqs/", {
        "title": "Cleaning supplies for Jeddah office",
        "description": "Monthly restock",
        "delivery_location": "Jeddah HQ",
    }, format="json")
    assert create.status_code == 201, create.content
    rfq_id = create.json()["id"]

    # 2. Add an item
    add = api_client.post(f"/api/rfqs/{rfq_id}/items", {
        "master_product": master_product.id,
        "pack_type_code": "CASE",
        "quantity": 10,
    }, format="json")
    assert add.status_code == 201, add.content

    # 3. Publish
    pub = api_client.post(f"/api/rfqs/{rfq_id}/publish")
    assert pub.status_code == 200
    assert pub.json()["status"] == "PUBLISHED"

    # 4. Supplier opens inbox
    login_as(api_client, supplier_user, supplier_org_a)
    inbox = api_client.get("/api/rfqs/inbox")
    assert inbox.status_code == 200
    assert any(r["id"] == rfq_id for r in inbox.json())

    # 5. Supplier starts a quote (draft + items pre-populated)
    qstart = api_client.post(f"/api/rfqs/{rfq_id}/quotes")
    assert qstart.status_code == 200, qstart.content
    quote = qstart.json()
    assert quote["status"] == "DRAFT"
    assert len(quote["items"]) == 1
    quote_id = quote["id"]
    qitem_id = quote["items"][0]["id"]

    # 6. Supplier sets price
    setp = api_client.patch(
        f"/api/quotes/{quote_id}/items/{qitem_id}",
        {"unit_price": "12.50", "lead_time_days": 5},
        format="json",
    )
    assert setp.status_code == 200
    assert setp.json()["total_price"] == "125.00"  # 10 × 12.50

    # 7. Supplier submits
    sub = api_client.post(f"/api/quotes/{quote_id}/submit")
    assert sub.status_code == 200
    assert sub.json()["status"] == "SUBMITTED"
    assert sub.json()["total"] == "125.00"

    # 8. Client awards
    login_as(api_client, client_user, org_a)
    award = api_client.post(f"/api/rfqs/{rfq_id}/quotes/{quote_id}/award")
    assert award.status_code == 200
    assert award.json()["status"] == "AWARDED"

    # 9. Contract was created
    contracts = api_client.get("/api/contracts/")
    assert contracts.status_code == 200
    body = contracts.json()
    assert len(body) == 1
    contract_id = body[0]["id"]
    assert body[0]["status"] == "PENDING_SIGNATURES"
    assert body[0]["total"] == "125.00"

    # 10. Client signs
    s1 = api_client.post(f"/api/contracts/{contract_id}/sign-client")
    assert s1.status_code == 200
    assert s1.json()["status"] == "PENDING_SIGNATURES"
    assert s1.json()["client_signed_at"] is not None

    # 11. Supplier signs → contract becomes SIGNED → order issued
    login_as(api_client, supplier_user, supplier_org_a)
    s2 = api_client.post(f"/api/contracts/{contract_id}/sign-supplier")
    assert s2.status_code == 200
    assert s2.json()["status"] == "ORDER_ISSUED"

    # 12. Both sides see the order
    orders = api_client.get("/api/orders/")
    assert orders.status_code == 200
    assert len(orders.json()) == 1
    order = orders.json()[0]
    order_id = order["id"]
    assert order["status"] == "DRAFT"
    assert order["total"] == "125.00"

    # 13. Supplier confirms
    conf = api_client.post(f"/api/orders/{order_id}/confirm")
    assert conf.status_code == 200
    assert conf.json()["status"] == "CONFIRMED"

    # 14. Client also sees the order
    login_as(api_client, client_user, org_a)
    co = api_client.get("/api/orders/")
    assert co.status_code == 200
    assert co.json()[0]["status"] == "CONFIRMED"


@pytest.mark.django_db
def test_supplier_cannot_publish_someone_elses_rfq(
    api_client, master_product, org_a, supplier_org_a,
    client_user, supplier_user,
):
    login_as(api_client, client_user, org_a)
    rfq_id = api_client.post(
        "/api/rfqs/", {"title": "x", "description": "x"}, format="json",
    ).json()["id"]

    # Supplier tries to publish — should be 403/404 because they're not a client.
    login_as(api_client, supplier_user, supplier_org_a)
    resp = api_client.post(f"/api/rfqs/{rfq_id}/publish")
    assert resp.status_code in (403, 404)


@pytest.mark.django_db
def test_supplier_cannot_see_draft_rfq(
    api_client, master_product, org_a, supplier_org_a,
    client_user, supplier_user,
):
    login_as(api_client, client_user, org_a)
    rfq_id = api_client.post(
        "/api/rfqs/", {"title": "draft", "description": ""}, format="json",
    ).json()["id"]
    api_client.post(f"/api/rfqs/{rfq_id}/items", {
        "master_product": master_product.id, "pack_type_code": "EACH", "quantity": 1,
    }, format="json")

    # Inbox empty for supplier (RFQ not published yet)
    login_as(api_client, supplier_user, supplier_org_a)
    inbox = api_client.get("/api/rfqs/inbox")
    assert inbox.status_code == 200
    assert all(r["id"] != rfq_id for r in inbox.json())

    # Direct fetch is also forbidden
    detail = api_client.get(f"/api/rfqs/{rfq_id}")
    assert detail.status_code in (403, 404)


@pytest.mark.django_db
def test_cannot_publish_rfq_without_items(api_client, org_a, client_user):
    login_as(api_client, client_user, org_a)
    rfq_id = api_client.post(
        "/api/rfqs/", {"title": "empty", "description": ""}, format="json",
    ).json()["id"]
    resp = api_client.post(f"/api/rfqs/{rfq_id}/publish")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_quote_submit_blocks_zero_priced_lines(
    api_client, master_product, org_a, supplier_org_a,
    client_user, supplier_user,
):
    login_as(api_client, client_user, org_a)
    rfq_id = api_client.post(
        "/api/rfqs/", {"title": "x", "description": ""}, format="json",
    ).json()["id"]
    api_client.post(f"/api/rfqs/{rfq_id}/items", {
        "master_product": master_product.id, "pack_type_code": "EACH", "quantity": 1,
    }, format="json")
    api_client.post(f"/api/rfqs/{rfq_id}/publish")

    login_as(api_client, supplier_user, supplier_org_a)
    quote = api_client.post(f"/api/rfqs/{rfq_id}/quotes").json()
    submit = api_client.post(f"/api/quotes/{quote['id']}/submit")
    assert submit.status_code == 400


@pytest.mark.django_db
def test_award_marks_other_quotes_lost(
    api_client, master_product, org_a, supplier_org_a, supplier_org_b,
    client_user, supplier_user,
):
    # Create + publish RFQ
    login_as(api_client, client_user, org_a)
    rfq_id = api_client.post(
        "/api/rfqs/", {"title": "x", "description": ""}, format="json",
    ).json()["id"]
    api_client.post(f"/api/rfqs/{rfq_id}/items", {
        "master_product": master_product.id, "pack_type_code": "EACH", "quantity": 5,
    }, format="json")
    api_client.post(f"/api/rfqs/{rfq_id}/publish")

    # Two suppliers each submit quotes
    from apps.accounts.models import User
    sup_b_user = User.objects.create_user(
        email="b-sup@example.com", password="long-enough-pw-1!",
    )
    Membership.objects.create(
        user=sup_b_user, organization=supplier_org_b, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )

    def make_quote(user, org, price):
        login_as(api_client, user, org)
        q = api_client.post(f"/api/rfqs/{rfq_id}/quotes").json()
        api_client.patch(
            f"/api/quotes/{q['id']}/items/{q['items'][0]['id']}",
            {"unit_price": price}, format="json",
        )
        api_client.post(f"/api/quotes/{q['id']}/submit")
        return q["id"]

    qa = make_quote(supplier_user, supplier_org_a, "10.00")
    qb = make_quote(sup_b_user, supplier_org_b, "8.00")

    # Client awards quote A
    login_as(api_client, client_user, org_a)
    api_client.post(f"/api/rfqs/{rfq_id}/quotes/{qa}/award")

    # Supplier B sees their quote as LOST
    login_as(api_client, sup_b_user, supplier_org_b)
    detail = api_client.get(f"/api/quotes/{qb}")
    assert detail.status_code == 200
    assert detail.json()["status"] == "LOST"

"""Phase 6: audit log + comments + notifications inbox + dashboard summary."""
import pytest

from apps.organizations.models import Membership

from .conftest import login_as


@pytest.fixture
def setup_two_orgs(
    db, master_product, org_a, supplier_org_a,
):
    """A CLIENT org_a and SUPPLIER supplier_org_a, each with an OWNER user.
    Returns the user fixtures so tests can log in as either side."""
    from apps.accounts.models import User

    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])

    cli = User.objects.create_user(email="cli6@a.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=cli, organization=org_a, role=Membership.Role.OWNER, status="ACTIVE",
    )
    sup = User.objects.create_user(email="sup6@a.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=sup, organization=supplier_org_a, role=Membership.Role.OWNER, status="ACTIVE",
    )
    return {
        "client_user": cli, "supplier_user": sup,
        "client_org": org_a, "supplier_org": supplier_org_a,
        "master_product": master_product,
    }


# ---------- Audit log ----------


@pytest.mark.django_db
def test_audit_log_records_rfq_publish_and_quote_award(api_client, setup_two_orgs):
    s = setup_two_orgs
    from apps.audit.models import AuditLog

    login_as(api_client, s["client_user"], s["client_org"])
    rfq_id = api_client.post("/api/rfqs/", {"title": "x", "description": ""}, format="json").json()["id"]
    api_client.post(f"/api/rfqs/{rfq_id}/items", {
        "master_product": s["master_product"].id,
        "pack_type_code": "EACH", "quantity": 1,
    }, format="json")
    api_client.post(f"/api/rfqs/{rfq_id}/publish")

    actions = list(AuditLog.objects.values_list("action", flat=True))
    assert "rfq.create" in actions
    assert "rfq.publish" in actions

    login_as(api_client, s["supplier_user"], s["supplier_org"])
    q = api_client.post(f"/api/rfqs/{rfq_id}/quotes").json()
    api_client.patch(
        f"/api/quotes/{q['id']}/items/{q['items'][0]['id']}",
        {"unit_price": "10.00"}, format="json",
    )
    api_client.post(f"/api/quotes/{q['id']}/submit")
    login_as(api_client, s["client_user"], s["client_org"])
    api_client.post(f"/api/rfqs/{rfq_id}/quotes/{q['id']}/award")

    actions = list(AuditLog.objects.values_list("action", flat=True))
    assert {"quote.submit", "quote.award", "contract.create"} <= set(actions)


@pytest.mark.django_db
def test_org_sees_only_its_own_audit(api_client, setup_two_orgs):
    s = setup_two_orgs
    from apps.audit.services import record_event

    record_event(action="t.client_only", organization=s["client_org"])
    record_event(action="t.supplier_only", organization=s["supplier_org"])

    login_as(api_client, s["client_user"], s["client_org"])
    body = api_client.get("/api/audit").json()
    actions = [r["action"] for r in body]
    assert "t.client_only" in actions
    assert "t.supplier_only" not in actions


@pytest.mark.django_db
def test_staff_audit_search_filters(api_client, setup_two_orgs, staff_user):
    from apps.audit.services import record_event

    record_event(action="x.alpha", organization=setup_two_orgs["client_org"])
    record_event(action="x.beta", organization=setup_two_orgs["supplier_org"])

    login_as(api_client, staff_user, scope="staff")
    body = api_client.get("/api/staff/audit?action=x.alpha").json()
    assert len(body) == 1
    assert body[0]["action"] == "x.alpha"


# ---------- Comments ----------


@pytest.mark.django_db
def test_comments_thread_visible_to_both_parties(api_client, setup_two_orgs):
    s = setup_two_orgs
    # Set up an Order so both sides can comment on it
    from apps.contracts.services import sign_as_client, sign_as_supplier
    from apps.orders.models import Order
    from apps.quotes.services import (
        award,
        create_or_get_draft_for_rfq,
        set_item_price,
        submit,
    )
    from apps.rfqs.services import add_item, create_rfq, publish

    rfq = create_rfq(client_org=s["client_org"], by=s["client_user"], title="C", description="")
    add_item(rfq, master_product=s["master_product"], pack_type_code="EACH", quantity=1)
    publish(rfq)
    quote = create_or_get_draft_for_rfq(rfq=rfq, supplier_org=s["supplier_org"])
    set_item_price(quote=quote, item_id=quote.items.first().id, unit_price="10.00")
    submit(quote)
    contract = award(quote, by=s["client_user"])
    sign_as_client(contract, by=s["client_user"])
    sign_as_supplier(contract, by=s["supplier_user"])
    # R8 — pick the CPO; both sides post comments via the canonical CPO.
    order = Order.objects.get(contract=contract, type=Order.Type.CPO)

    # Client posts
    login_as(api_client, s["client_user"], s["client_org"])
    post_resp = api_client.post(
        f"/api/comments?on=order:{order.id}",
        {"body": "When can you ship?"}, format="json",
    )
    assert post_resp.status_code == 201, post_resp.content

    # Supplier sees it and replies
    login_as(api_client, s["supplier_user"], s["supplier_org"])
    list_resp = api_client.get(f"/api/comments?on=order:{order.id}")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["body"] == "When can you ship?"

    api_client.post(
        f"/api/comments?on=order:{order.id}",
        {"body": "Tomorrow."}, format="json",
    )

    # Client sees both
    login_as(api_client, s["client_user"], s["client_org"])
    body = api_client.get(f"/api/comments?on=order:{order.id}").json()
    assert len(body) == 2


@pytest.mark.django_db
def test_comments_block_non_party(api_client, setup_two_orgs, supplier_org_b):
    """Some other supplier org cannot read/write comments on someone else's order."""
    s = setup_two_orgs
    from apps.accounts.models import User
    from apps.contracts.services import sign_as_client, sign_as_supplier
    from apps.orders.models import Order
    from apps.quotes.services import (
        award,
        create_or_get_draft_for_rfq,
        set_item_price,
        submit,
    )
    from apps.rfqs.services import add_item, create_rfq, publish

    rfq = create_rfq(client_org=s["client_org"], by=s["client_user"], title="C", description="")
    add_item(rfq, master_product=s["master_product"], pack_type_code="EACH", quantity=1)
    publish(rfq)
    quote = create_or_get_draft_for_rfq(rfq=rfq, supplier_org=s["supplier_org"])
    set_item_price(quote=quote, item_id=quote.items.first().id, unit_price="10.00")
    submit(quote)
    contract = award(quote, by=s["client_user"])
    sign_as_client(contract, by=s["client_user"])
    sign_as_supplier(contract, by=s["supplier_user"])
    # R8 — pick the CPO; both sides post comments via the canonical CPO.
    order = Order.objects.get(contract=contract, type=Order.Type.CPO)

    other = User.objects.create_user(email="other@b.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=other, organization=supplier_org_b, role="OWNER", status="ACTIVE",
    )
    login_as(api_client, other, supplier_org_b)
    resp = api_client.get(f"/api/comments?on=order:{order.id}")
    assert resp.status_code == 403


# ---------- Notifications inbox ----------


@pytest.mark.django_db
def test_quote_submit_sends_notification_to_client(api_client, setup_two_orgs):
    s = setup_two_orgs
    from apps.notifications.models import Notification
    from apps.quotes.services import (
        create_or_get_draft_for_rfq,
        set_item_price,
        submit,
    )
    from apps.rfqs.services import add_item, create_rfq, publish

    rfq = create_rfq(client_org=s["client_org"], by=s["client_user"], title="N", description="")
    add_item(rfq, master_product=s["master_product"], pack_type_code="EACH", quantity=1)
    publish(rfq)
    q = create_or_get_draft_for_rfq(rfq=rfq, supplier_org=s["supplier_org"])
    set_item_price(quote=q, item_id=q.items.first().id, unit_price="10.00")
    submit(q)

    notes = Notification.objects.filter(user=s["client_user"]).values_list("kind", flat=True)
    assert "quote.received" in list(notes)


@pytest.mark.django_db
def test_inbox_endpoint_marks_read(api_client, setup_two_orgs):
    s = setup_two_orgs
    from apps.notifications.services import notify

    notify(users=[s["client_user"]], kind="t", title="hi", organization=s["client_org"])

    login_as(api_client, s["client_user"], s["client_org"])
    inbox = api_client.get("/api/notifications").json()
    assert inbox["unread"] == 1
    assert len(inbox["items"]) == 1
    nid = inbox["items"][0]["id"]

    api_client.post(f"/api/notifications/{nid}/read")
    inbox2 = api_client.get("/api/notifications").json()
    assert inbox2["unread"] == 0


# ---------- Dashboard summary ----------


@pytest.mark.django_db
def test_dashboard_summary_client(api_client, setup_two_orgs):
    s = setup_two_orgs
    from apps.rfqs.services import add_item, create_rfq, publish

    # Create + publish two RFQs to bump open_rfqs counter
    for _ in range(2):
        rfq = create_rfq(client_org=s["client_org"], by=s["client_user"], title="X", description="")
        add_item(rfq, master_product=s["master_product"], pack_type_code="EACH", quantity=1)
        publish(rfq)

    login_as(api_client, s["client_user"], s["client_org"])
    body = api_client.get("/api/dashboard/summary").json()
    assert body["role"] == "CLIENT"
    assert body["counts"]["open_rfqs"] >= 2


@pytest.mark.django_db
def test_dashboard_summary_supplier(api_client, setup_two_orgs):
    s = setup_two_orgs
    from apps.rfqs.services import add_item, create_rfq, publish

    rfq = create_rfq(client_org=s["client_org"], by=s["client_user"], title="X", description="")
    add_item(rfq, master_product=s["master_product"], pack_type_code="EACH", quantity=1)
    publish(rfq)

    login_as(api_client, s["supplier_user"], s["supplier_org"])
    body = api_client.get("/api/dashboard/summary").json()
    assert body["role"] == "SUPPLIER"
    assert body["counts"]["rfqs_in_inbox"] >= 1


@pytest.mark.django_db
def test_dashboard_summary_staff(api_client, staff_user):
    login_as(api_client, staff_user, scope="staff")
    body = api_client.get("/api/staff/dashboard/summary").json()
    assert body["role"] == "STAFF"
    assert "kyc_pending_review" in body["counts"]
    assert "active_orgs" in body["counts"]

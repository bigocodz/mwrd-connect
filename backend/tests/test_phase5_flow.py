"""Phase 5: end-to-end DN → GRN → 3-way → SupplierInvoice → ClientInvoice → Payment → Payout."""
import pytest

from apps.organizations.models import Membership

from .conftest import login_as


@pytest.fixture
def setup_active_order(
    db, master_product, org_a, supplier_org_a,
):
    """Drives Phase 4 end-to-end and returns the created order id and the
    two user fixtures so Phase 5 tests can pick up where 4 left off."""
    from apps.accounts.models import User
    from apps.contracts.services import sign_as_client, sign_as_supplier
    from apps.orders.models import Order
    from apps.orders.services import confirm
    from apps.quotes.services import (
        award,
        create_or_get_draft_for_rfq,
        set_item_price,
        submit,
    )
    from apps.rfqs.services import add_item, create_rfq, publish

    # Make org_a a CLIENT explicitly
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])

    cli = User.objects.create_user(email="cli@a.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=cli, organization=org_a, role=Membership.Role.OWNER, status="ACTIVE",
    )
    sup = User.objects.create_user(email="sup@a.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=sup, organization=supplier_org_a, role=Membership.Role.OWNER, status="ACTIVE",
    )

    rfq = create_rfq(client_org=org_a, by=cli, title="Phase 5 RFQ", description="")
    add_item(rfq, master_product=master_product, pack_type_code="EACH", quantity=4)
    publish(rfq)
    quote = create_or_get_draft_for_rfq(rfq=rfq, supplier_org=supplier_org_a)
    set_item_price(quote=quote, item_id=quote.items.first().id, unit_price="20.00")
    submit(quote)
    contract = award(quote, by=cli)
    sign_as_client(contract, by=cli)
    sign_as_supplier(contract, by=sup)
    # R8 — supplier acts on the SPO half of the dual PO pair.
    order = Order.objects.get(contract=contract, type=Order.Type.SPO)
    confirm(order, by=sup)
    return {"order_id": order.id, "client_user": cli, "supplier_user": sup,
            "client_org": org_a, "supplier_org": supplier_org_a}


@pytest.mark.django_db
def test_dn_grn_invoice_payment_full_chain(api_client, setup_active_order, staff_user):
    s = setup_active_order
    order_id = s["order_id"]

    # 1. Supplier creates a DN for the full quantity (4)
    login_as(api_client, s["supplier_user"], s["supplier_org"])
    order_lines = api_client.get(f"/api/orders/{order_id}").json()["items"]
    create_dn = api_client.post(f"/api/orders/{order_id}/deliveries", {
        "lines": [{"order_item_id": order_lines[0]["id"], "quantity": 4}],
    }, format="json")
    assert create_dn.status_code == 201, create_dn.content
    dn_id = create_dn.json()["id"]

    # 2. Supplier dispatches
    disp = api_client.post(f"/api/deliveries/{dn_id}/dispatch")
    assert disp.status_code == 200
    assert disp.json()["status"] == "DISPATCHED"

    # 3. Client receives → GRN draft auto-populated to accept full quantity
    login_as(api_client, s["client_user"], s["client_org"])
    grn_resp = api_client.post(f"/api/deliveries/{dn_id}/grn")
    assert grn_resp.status_code == 200
    grn = grn_resp.json()
    assert grn["status"] == "DRAFT"
    assert grn["items"][0]["accepted_qty"] == 4

    # 4. Client completes the GRN (no edits — accept all)
    complete = api_client.post(f"/api/grns/{grn['id']}/complete")
    assert complete.status_code == 200
    assert complete.json()["status"] == "COMPLETED"

    # 5. 3-way match passes
    match = api_client.get(f"/api/orders/{order_id}/three-way-match")
    assert match.status_code == 200
    assert match.json()["matched"] is True

    # 6. Supplier raises invoice on the order
    login_as(api_client, s["supplier_user"], s["supplier_org"])
    inv = api_client.post(f"/api/orders/{order_id}/supplier-invoice")
    assert inv.status_code == 201, inv.content
    si_id = inv.json()["id"]
    assert inv.json()["total"] == "80.00"  # 4 × 20.00

    # 7. Supplier issues it
    issue = api_client.post(f"/api/supplier-invoices/{si_id}/issue")
    assert issue.status_code == 200
    assert issue.json()["status"] == "ISSUED"

    # 8. Staff generates the client-facing invoice (default 10% margin)
    login_as(api_client, staff_user, scope="staff")
    gen = api_client.post(
        f"/api/staff/supplier-invoices/{si_id}/generate-client-invoice",
    )
    assert gen.status_code == 201, gen.content
    ci = gen.json()
    ci_id = ci["id"]
    assert ci["subtotal"] == "80.00"
    assert ci["margin_amount"] == "8.00"
    assert ci["total"] == "88.00"

    # 9. Staff issues the client invoice
    iss_ci = api_client.post(f"/api/staff/client-invoices/{ci_id}/issue")
    assert iss_ci.status_code == 200
    assert iss_ci.json()["status"] == "ISSUED"

    # 10. Client records payment
    login_as(api_client, s["client_user"], s["client_org"])
    pay = api_client.post("/api/payments/record", {
        "invoice_id": ci_id, "amount": "88.00",
        "method": "BANK_TRANSFER", "reference": "TXN-001",
    }, format="json")
    assert pay.status_code == 201, pay.content

    # 11. Client invoice is now PAID
    inv_after = api_client.get("/api/client-invoices").json()
    assert inv_after[0]["status"] == "PAID"

    # 12. Staff records payout to supplier
    login_as(api_client, staff_user, scope="staff")
    payout = api_client.post("/api/staff/payouts/record", {
        "invoice_id": si_id, "amount": "80.00",
        "method": "BANK_TRANSFER", "reference": "PAYOUT-001",
    }, format="json")
    assert payout.status_code == 201, payout.content

    # 13. Supplier sees their invoice as PAID and the payout listed
    login_as(api_client, s["supplier_user"], s["supplier_org"])
    sis = api_client.get("/api/supplier-invoices").json()
    assert sis[0]["status"] == "PAID"
    payouts = api_client.get("/api/payouts").json()
    assert len(payouts) == 1
    assert payouts[0]["amount"] == "80.00"


@pytest.mark.django_db
def test_supplier_invoice_blocked_until_grn_matches(
    api_client, setup_active_order,
):
    s = setup_active_order
    login_as(api_client, s["supplier_user"], s["supplier_org"])
    resp = api_client.post(f"/api/orders/{s['order_id']}/supplier-invoice")
    assert resp.status_code == 400
    assert "GRN" in resp.json()["detail"]


@pytest.mark.django_db
def test_three_way_match_partial_delta(api_client, setup_active_order):
    s = setup_active_order
    order_id = s["order_id"]

    login_as(api_client, s["supplier_user"], s["supplier_org"])
    order_lines = api_client.get(f"/api/orders/{order_id}").json()["items"]
    dn_id = api_client.post(f"/api/orders/{order_id}/deliveries", {
        "lines": [{"order_item_id": order_lines[0]["id"], "quantity": 4}],
    }, format="json").json()["id"]
    api_client.post(f"/api/deliveries/{dn_id}/dispatch")

    # Client only accepts 3 of 4
    login_as(api_client, s["client_user"], s["client_org"])
    grn = api_client.post(f"/api/deliveries/{dn_id}/grn").json()
    api_client.patch(f"/api/grns/{grn['id']}/lines", {
        "dn_item_id": grn["items"][0]["dn_item"],
        "accepted_qty": 3, "rejected_qty": 1, "notes": "1 damaged",
    }, format="json")
    api_client.post(f"/api/grns/{grn['id']}/complete")

    match = api_client.get(f"/api/orders/{order_id}/three-way-match").json()
    assert match["matched"] is False
    line = match["lines"][0]
    assert line["ordered"] == 4
    assert line["shipped"] == 4
    assert line["accepted"] == 3
    assert line["rejected"] == 1
    assert line["delta"] == 1


@pytest.mark.django_db
def test_payment_must_match_total(
    api_client, setup_active_order, staff_user,
):
    """Phase 5 guardrail: only full-amount payments are supported."""
    s = setup_active_order
    order_id = s["order_id"]

    # Drive the chain to ISSUED ClientInvoice via the services
    from apps.fulfillment.services import (
        complete_grn,
        create_dn,
        create_grn,
        dispatch_dn,
    )
    from apps.invoicing.services import (
        create_client_invoice_from_supplier_invoice,
        create_supplier_invoice_from_order,
        issue_client_invoice,
        issue_supplier_invoice,
    )
    from apps.orders.models import Order

    order = Order.objects.get(id=order_id)
    dn = create_dn(
        order=order, by=s["supplier_user"],
        lines=[{"order_item_id": order.items.first().id, "quantity": 4}],
    )
    dispatch_dn(dn)
    grn = create_grn(dn=dn, by=s["client_user"])
    complete_grn(grn)
    si = create_supplier_invoice_from_order(order=order)
    issue_supplier_invoice(si)
    ci = create_client_invoice_from_supplier_invoice(si=si)
    issue_client_invoice(ci)

    login_as(api_client, s["client_user"], s["client_org"])
    bad = api_client.post("/api/payments/record", {
        "invoice_id": ci.id, "amount": "10.00", "method": "BANK_TRANSFER",
    }, format="json")
    assert bad.status_code == 400


@pytest.mark.django_db
def test_supplier_cannot_create_dn_for_other_org_order(
    api_client, setup_active_order, supplier_org_b,
):
    """Cross-org isolation: a different supplier shouldn't be able to ship
    against someone else's order."""
    s = setup_active_order
    from apps.accounts.models import User

    other_sup = User.objects.create_user(email="other@b.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=other_sup, organization=supplier_org_b, role="OWNER", status="ACTIVE",
    )

    login_as(api_client, other_sup, supplier_org_b)
    resp = api_client.post(f"/api/orders/{s['order_id']}/deliveries", {
        "lines": [{"order_item_id": 1, "quantity": 1}],
    }, format="json")
    assert resp.status_code == 404

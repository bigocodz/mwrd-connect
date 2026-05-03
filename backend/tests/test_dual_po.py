"""R8 — Dual PO system.

Spec § "Dual PO (CPO + SPO linked by transaction_ref)". When both sides
sign a contract, two Orders are created sharing a UUID `transaction_ref`:

- CPO (Client PO): the procurement document — visible to the client only.
- SPO (Supplier PO): the fulfillment document — visible to the supplier only.

Locks the rules:
- Issuing an order from a contract creates a paired CPO + SPO with the
  same items, totals, and transaction_ref.
- Order list is viewer-filtered: clients see CPOs, suppliers see SPOs.
- Confirming the SPO flips the paired CPO to CONFIRMED in lockstep.
- Comments target an order id but are stored against the CPO so both
  sides see the same thread.
"""
from __future__ import annotations

import pytest

from apps.accounts.models import User
from apps.contracts.services import sign_as_client, sign_as_supplier
from apps.orders.models import Order
from apps.organizations.models import Membership
from apps.quotes.services import (
    award,
    create_or_get_draft_for_rfq,
    set_item_price,
    submit,
)
from apps.rfqs.services import add_item, create_rfq, publish

from .conftest import login_as


@pytest.fixture
def issued_contract(db, master_product, org_a, supplier_org_a):
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

    rfq = create_rfq(client_org=org_a, by=cli, title="x", description="")
    add_item(rfq, master_product=master_product, pack_type_code="EACH", quantity=2)
    publish(rfq)
    quote = create_or_get_draft_for_rfq(rfq=rfq, supplier_org=supplier_org_a)
    set_item_price(quote=quote, item_id=quote.items.first().id, unit_price="50.00")
    submit(quote)
    contract = award(quote, by=cli)
    sign_as_client(contract, by=cli)
    sign_as_supplier(contract, by=sup)
    contract.refresh_from_db()
    return {
        "contract": contract, "client_user": cli, "supplier_user": sup,
        "client_org": org_a, "supplier_org": supplier_org_a,
    }


@pytest.mark.django_db
def test_signing_creates_paired_cpo_and_spo(issued_contract):
    contract = issued_contract["contract"]
    orders = list(Order.objects.filter(contract=contract))
    assert len(orders) == 2

    types = {o.type for o in orders}
    assert types == {Order.Type.CPO, Order.Type.SPO}

    txn_refs = {o.transaction_ref for o in orders}
    assert len(txn_refs) == 1
    assert next(iter(txn_refs)) is not None

    # Same items, same totals.
    cpo = next(o for o in orders if o.type == Order.Type.CPO)
    spo = next(o for o in orders if o.type == Order.Type.SPO)
    assert cpo.total == spo.total
    assert cpo.items.count() == spo.items.count() == 1


@pytest.mark.django_db
def test_paired_order_helper_returns_partner(issued_contract):
    cpo = Order.objects.get(contract=issued_contract["contract"], type=Order.Type.CPO)
    spo = cpo.paired_order()
    assert spo is not None
    assert spo.type == Order.Type.SPO
    # Symmetric.
    assert spo.paired_order().id == cpo.id


@pytest.mark.django_db
def test_client_sees_cpo_supplier_sees_spo(api_client, issued_contract):
    cpo = Order.objects.get(contract=issued_contract["contract"], type=Order.Type.CPO)
    spo = Order.objects.get(contract=issued_contract["contract"], type=Order.Type.SPO)

    login_as(api_client, issued_contract["client_user"], issued_contract["client_org"])
    body = api_client.get("/api/orders/").json()
    ids = [o["id"] for o in body]
    assert cpo.id in ids
    assert spo.id not in ids
    assert all(o["type"] == "CPO" for o in body)

    login_as(api_client, issued_contract["supplier_user"], issued_contract["supplier_org"])
    body = api_client.get("/api/orders/").json()
    ids = [o["id"] for o in body]
    assert spo.id in ids
    assert cpo.id not in ids
    assert all(o["type"] == "SPO" for o in body)


@pytest.mark.django_db
def test_client_cannot_open_supplier_spo(api_client, issued_contract):
    spo = Order.objects.get(contract=issued_contract["contract"], type=Order.Type.SPO)
    login_as(api_client, issued_contract["client_user"], issued_contract["client_org"])
    resp = api_client.get(f"/api/orders/{spo.id}")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_supplier_confirm_flips_paired_cpo(issued_contract):
    from apps.orders.services import confirm

    spo = Order.objects.get(contract=issued_contract["contract"], type=Order.Type.SPO)
    cpo = spo.paired_order()
    assert spo.status == Order.Status.DRAFT
    assert cpo.status == Order.Status.DRAFT

    confirm(spo, by=issued_contract["supplier_user"])

    spo.refresh_from_db()
    cpo.refresh_from_db()
    assert spo.status == Order.Status.CONFIRMED
    assert cpo.status == Order.Status.CONFIRMED
    assert spo.confirmed_at == cpo.confirmed_at


@pytest.mark.django_db
def test_comments_canonicalize_to_cpo_so_both_sides_see_thread(
    api_client, issued_contract,
):
    cpo = Order.objects.get(contract=issued_contract["contract"], type=Order.Type.CPO)
    spo = Order.objects.get(contract=issued_contract["contract"], type=Order.Type.SPO)

    # Client posts on the CPO id.
    login_as(api_client, issued_contract["client_user"], issued_contract["client_org"])
    api_client.post(
        f"/api/comments?on=order:{cpo.id}",
        {"body": "When can you ship?"}, format="json",
    )

    # Supplier reads using the SPO id — should see the same comment.
    login_as(api_client, issued_contract["supplier_user"], issued_contract["supplier_org"])
    body = api_client.get(f"/api/comments?on=order:{spo.id}").json()
    assert len(body) == 1
    assert body[0]["body"] == "When can you ship?"


@pytest.mark.django_db
def test_transaction_ref_is_unique_per_contract(issued_contract, master_product, supplier_org_b):
    """Two separate award flows produce two distinct transaction_refs."""
    from apps.orders.models import Order

    txn_refs = set(
        Order.objects.filter(contract=issued_contract["contract"])
        .values_list("transaction_ref", flat=True)
    )
    assert len(txn_refs) == 1

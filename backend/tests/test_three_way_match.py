"""R12 — Three-way match with 2% variance tolerance.

Spec § three-way matching: "PO × GRN × Invoice must match within 2%
variance before invoice issues. Discrepancy auto-holds the invoice and
flags it to backoffice."

Locks the rules:
- A line shipped+accepted at 100% of ordered is matched.
- A line short by ≤ 2% (e.g. 98 received of 100 ordered) is matched.
- A line short by > 2% is NOT matched.
- The result exposes per-line `delta_pct` and `within_tolerance` so
  backoffice can render the discrepancy.
- Issuing a SupplierInvoice raises if the line is outside tolerance.
"""
from __future__ import annotations

import pytest

from apps.accounts.models import User
from apps.contracts.services import sign_as_client, sign_as_supplier
from apps.fulfillment.services import (
    complete_grn,
    create_dn,
    create_grn,
    dispatch_dn,
    set_grn_line,
    three_way_match,
)
from apps.invoicing.services import (
    InvoicingError,
    create_supplier_invoice_from_order,
)
from apps.orders.models import Order
from apps.orders.services import confirm
from apps.organizations.models import Membership
from apps.quotes.services import (
    award,
    create_or_get_draft_for_rfq,
    set_item_price,
    submit,
)
from apps.rfqs.services import add_item, create_rfq, publish


@pytest.fixture
def confirmed_order(db, master_product, org_a, supplier_org_a):
    """Build a confirmed SPO with one line of qty 100."""
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
    rfq = create_rfq(client_org=org_a, by=cli, title="t", description="")
    add_item(rfq, master_product=master_product, pack_type_code="EACH", quantity=100)
    publish(rfq)
    quote = create_or_get_draft_for_rfq(rfq=rfq, supplier_org=supplier_org_a)
    set_item_price(quote=quote, item_id=quote.items.first().id, unit_price="10.00")
    submit(quote)
    contract = award(quote, by=cli)
    sign_as_client(contract, by=cli)
    sign_as_supplier(contract, by=sup)
    spo = Order.objects.get(contract=contract, type=Order.Type.SPO)
    confirm(spo, by=sup)
    return {"spo": spo, "client_user": cli, "supplier_user": sup}


def _ship_and_receive(*, spo, client_user, supplier_user, accept_qty: int):
    """Ship the full ordered qty, then receive `accept_qty` (rejecting the rest)."""
    oi = spo.items.first()
    dn = create_dn(
        order=spo, by=supplier_user,
        lines=[{"order_item_id": oi.id, "quantity": oi.quantity}],
    )
    dispatch_dn(dn)
    grn = create_grn(dn=dn, by=client_user)
    dni = dn.items.first()
    set_grn_line(
        grn=grn, dn_item_id=dni.id,
        accepted_qty=accept_qty,
        rejected_qty=oi.quantity - accept_qty,
    )
    complete_grn(grn)


@pytest.mark.django_db
def test_perfect_match(confirmed_order):
    _ship_and_receive(
        spo=confirmed_order["spo"],
        client_user=confirmed_order["client_user"],
        supplier_user=confirmed_order["supplier_user"],
        accept_qty=100,
    )
    result = three_way_match(confirmed_order["spo"])
    assert result["matched"] is True
    assert result["tolerance_pct"] == "2.0"
    line = result["lines"][0]
    assert line["delta"] == 0
    assert line["within_tolerance"] is True


@pytest.mark.django_db
def test_within_two_percent_is_matched(confirmed_order):
    """Accepting 98 of 100 = 2% short → still matched."""
    _ship_and_receive(
        spo=confirmed_order["spo"],
        client_user=confirmed_order["client_user"],
        supplier_user=confirmed_order["supplier_user"],
        accept_qty=98,
    )
    result = three_way_match(confirmed_order["spo"])
    assert result["matched"] is True
    line = result["lines"][0]
    assert line["delta"] == 2
    assert line["delta_pct"] == "2.00"
    assert line["within_tolerance"] is True


@pytest.mark.django_db
def test_just_over_two_percent_fails(confirmed_order):
    """Accepting 97 of 100 = 3% short → NOT matched."""
    _ship_and_receive(
        spo=confirmed_order["spo"],
        client_user=confirmed_order["client_user"],
        supplier_user=confirmed_order["supplier_user"],
        accept_qty=97,
    )
    result = three_way_match(confirmed_order["spo"])
    assert result["matched"] is False
    line = result["lines"][0]
    assert line["delta"] == 3
    assert line["within_tolerance"] is False


@pytest.mark.django_db
def test_supplier_invoice_blocked_when_match_fails(confirmed_order):
    _ship_and_receive(
        spo=confirmed_order["spo"],
        client_user=confirmed_order["client_user"],
        supplier_user=confirmed_order["supplier_user"],
        accept_qty=80,  # 20% short
    )
    with pytest.raises(InvoicingError, match="GRN-matched"):
        create_supplier_invoice_from_order(order=confirmed_order["spo"])


@pytest.mark.django_db
def test_supplier_invoice_allowed_within_tolerance(confirmed_order):
    _ship_and_receive(
        spo=confirmed_order["spo"],
        client_user=confirmed_order["client_user"],
        supplier_user=confirmed_order["supplier_user"],
        accept_qty=99,  # 1% short — within tolerance
    )
    si = create_supplier_invoice_from_order(order=confirmed_order["spo"])
    assert si.id is not None


@pytest.mark.django_db
def test_tolerance_is_settable(confirmed_order, settings):
    """Setting THREE_WAY_MATCH_VARIANCE_PCT relaxes/tightens the gate."""
    _ship_and_receive(
        spo=confirmed_order["spo"],
        client_user=confirmed_order["client_user"],
        supplier_user=confirmed_order["supplier_user"],
        accept_qty=95,  # 5% short
    )
    settings.THREE_WAY_MATCH_VARIANCE_PCT = "2.0"
    assert three_way_match(confirmed_order["spo"])["matched"] is False

    settings.THREE_WAY_MATCH_VARIANCE_PCT = "10.0"
    assert three_way_match(confirmed_order["spo"])["matched"] is True

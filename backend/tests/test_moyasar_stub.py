"""R13 — Moyasar Payment stub.

Spec § "Moyasar Payment stub in MVP (mock payment intent), real
implementation in Phase 3". Locks the public surface:
- create_payment_intent(invoice) returns an id + redirect_url.
- capture_payment(invoice, intent_id) writes a Payment row, marks the
  invoice paid, and is idempotent on re-call.
- refund_payment(payment, amount) updates the row and the provider.
- Settings switch (MOYASAR_PROVIDER) routes to fake|http.
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from apps.invoicing.models import ClientInvoice
from apps.payments.moyasar import FakeMoyasarProvider, get_provider
from apps.payments.services import (
    PaymentsError,
    capture_payment,
    create_payment_intent,
    refund_payment,
)


@pytest.fixture(autouse=True)
def reset_moyasar_log():
    FakeMoyasarProvider.shared().reset()
    yield
    FakeMoyasarProvider.shared().reset()


@pytest.fixture
def issued_client_invoice(db, master_product, org_a, supplier_org_a):
    """Walk the full RFQ → invoice flow and return an ISSUED ClientInvoice."""
    from apps.accounts.models import User
    from apps.contracts.services import sign_as_client, sign_as_supplier
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
    from apps.orders.services import confirm
    from apps.organizations.models import Membership
    from apps.quotes.services import (
        award,
        create_or_get_draft_for_rfq,
        set_item_price,
        submit,
    )
    from apps.rfqs.services import add_item, create_rfq, publish

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
    rfq = create_rfq(client_org=org_a, by=cli, title="r", description="")
    add_item(rfq, master_product=master_product, pack_type_code="EACH", quantity=2)
    publish(rfq)
    quote = create_or_get_draft_for_rfq(rfq=rfq, supplier_org=supplier_org_a)
    set_item_price(quote=quote, item_id=quote.items.first().id, unit_price="50.00")
    submit(quote)
    contract = award(quote, by=cli)
    sign_as_client(contract, by=cli)
    sign_as_supplier(contract, by=sup)
    spo = Order.objects.get(contract=contract, type=Order.Type.SPO)
    confirm(spo, by=sup)
    dn = create_dn(
        order=spo, by=sup,
        lines=[{"order_item_id": spo.items.first().id, "quantity": 2}],
    )
    dispatch_dn(dn)
    grn = create_grn(dn=dn, by=cli)
    complete_grn(grn)
    si = create_supplier_invoice_from_order(order=spo)
    issue_supplier_invoice(si)
    ci = create_client_invoice_from_supplier_invoice(si=si)
    issue_client_invoice(ci)
    return {"invoice": ci, "client_user": cli, "client_org": org_a}


# ---------- Provider surface ----------


def test_provider_singleton():
    a = FakeMoyasarProvider.shared()
    b = FakeMoyasarProvider.shared()
    assert a is b


def test_get_provider_returns_fake_by_default():
    provider = get_provider()
    assert isinstance(provider, FakeMoyasarProvider)


# ---------- Service flow ----------


@pytest.mark.django_db
def test_create_payment_intent_returns_id_and_redirect(issued_client_invoice):
    invoice = issued_client_invoice["invoice"]
    out = create_payment_intent(invoice=invoice)
    assert out["id"].startswith("pi_mock_")
    assert out["amount_sar"] == str(invoice.total)
    assert out["status"] == "pending"
    assert out["redirect_url"]

    log = FakeMoyasarProvider.shared().call_log
    assert log[-1][0] == "create_payment_intent"


@pytest.mark.django_db
def test_create_payment_intent_rejects_non_issued_invoice(issued_client_invoice):
    invoice = issued_client_invoice["invoice"]
    invoice.status = ClientInvoice.Status.DRAFT
    invoice.save(update_fields=["status"])
    with pytest.raises(PaymentsError):
        create_payment_intent(invoice=invoice)


@pytest.mark.django_db
def test_capture_payment_records_payment_and_marks_invoice_paid(
    issued_client_invoice,
):
    invoice = issued_client_invoice["invoice"]
    intent = create_payment_intent(invoice=invoice)
    payment = capture_payment(
        invoice=invoice, intent_id=intent["id"],
        by=issued_client_invoice["client_user"],
    )
    invoice.refresh_from_db()
    assert invoice.status == ClientInvoice.Status.PAID
    assert payment.payment_intent_id == intent["id"]
    assert payment.provider == "moyasar"
    assert payment.provider_status == "paid"
    assert payment.amount == invoice.total


@pytest.mark.django_db
def test_capture_payment_is_idempotent(issued_client_invoice):
    invoice = issued_client_invoice["invoice"]
    intent = create_payment_intent(invoice=invoice)
    p1 = capture_payment(
        invoice=invoice, intent_id=intent["id"],
        by=issued_client_invoice["client_user"],
    )
    invoice.refresh_from_db()
    # Re-capturing the same intent must NOT create a second Payment row,
    # but we have to handle the fact that the invoice is now PAID and
    # capture_payment refuses non-ISSUED invoices. Test the idempotent
    # branch by bypassing that check via direct service call when invoice
    # is still ISSUED. Reset the invoice to ISSUED and re-call.
    invoice.status = ClientInvoice.Status.ISSUED
    invoice.save(update_fields=["status"])
    p2 = capture_payment(
        invoice=invoice, intent_id=intent["id"],
        by=issued_client_invoice["client_user"],
    )
    assert p1.id == p2.id


@pytest.mark.django_db
def test_refund_payment_full(issued_client_invoice):
    invoice = issued_client_invoice["invoice"]
    intent = create_payment_intent(invoice=invoice)
    payment = capture_payment(
        invoice=invoice, intent_id=intent["id"],
        by=issued_client_invoice["client_user"],
    )
    refunded = refund_payment(payment=payment, amount=payment.amount)
    assert refunded.refunded_amount == payment.amount
    assert refunded.provider_status == "refunded"


@pytest.mark.django_db
def test_refund_partial(issued_client_invoice):
    invoice = issued_client_invoice["invoice"]
    intent = create_payment_intent(invoice=invoice)
    payment = capture_payment(
        invoice=invoice, intent_id=intent["id"],
        by=issued_client_invoice["client_user"],
    )
    half = (Decimal(payment.amount) / Decimal("2")).quantize(Decimal("0.01"))
    refund_payment(payment=payment, amount=half)
    payment.refresh_from_db()
    assert payment.refunded_amount == half
    assert payment.provider_status == "partially_refunded"


@pytest.mark.django_db
def test_refund_exceeding_captured_rejected(issued_client_invoice):
    invoice = issued_client_invoice["invoice"]
    intent = create_payment_intent(invoice=invoice)
    payment = capture_payment(
        invoice=invoice, intent_id=intent["id"],
        by=issued_client_invoice["client_user"],
    )
    with pytest.raises(PaymentsError, match="exceed"):
        refund_payment(payment=payment, amount=Decimal(payment.amount) + Decimal("1"))


# ---------- API ----------


@pytest.mark.django_db
def test_payment_intent_endpoint(api_client, issued_client_invoice):
    from .conftest import login_as

    login_as(
        api_client,
        issued_client_invoice["client_user"],
        issued_client_invoice["client_org"],
    )
    invoice = issued_client_invoice["invoice"]
    resp = api_client.post(f"/api/invoices/{invoice.id}/payment-intent")
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["id"].startswith("pi_mock_")

    cap = api_client.post(
        f"/api/invoices/{invoice.id}/payment-capture",
        {"intent_id": body["id"]}, format="json",
    )
    assert cap.status_code == 201, cap.content
    invoice.refresh_from_db()
    assert invoice.status == ClientInvoice.Status.PAID

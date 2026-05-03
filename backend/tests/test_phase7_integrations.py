"""Phase 7: Wafeq / Wathq / SPL via the fake providers.

Real HTTP providers are stubbed and raise — these tests confirm the wiring
works end-to-end with fakes (which is what dev/CI use)."""
import pytest

from apps.organizations.models import Membership

from .conftest import login_as

# ---------- Wathq CR lookup ----------


@pytest.mark.django_db
def test_wathq_cr_lookup_returns_record(api_client, user_in_org_a, org_a):
    login_as(api_client, user_in_org_a, org_a)
    resp = api_client.get("/api/wathq/cr-lookup?cr_number=1010123456")
    assert resp.status_code == 200
    body = resp.json()
    assert body["cr_number"] == "1010123456"
    assert body["status"] == "ACTIVE"
    assert body["legal_name_en"]


@pytest.mark.django_db
def test_wathq_cr_lookup_404_for_bad_format(api_client, user_in_org_a, org_a):
    login_as(api_client, user_in_org_a, org_a)
    resp = api_client.get("/api/wathq/cr-lookup?cr_number=abc")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_wathq_lookup_requires_auth(api_client):
    resp = api_client.get("/api/wathq/cr-lookup?cr_number=1010123456")
    assert resp.status_code == 401


# ---------- SPL short code ----------


@pytest.mark.django_db
def test_spl_short_code_resolves(api_client, user_in_org_a, org_a):
    login_as(api_client, user_in_org_a, org_a)
    resp = api_client.get("/api/spl/lookup?code=RHRA8242")
    assert resp.status_code == 200
    body = resp.json()
    assert body["short_code"] == "RHRA8242"
    assert body["city"]
    assert body["postal_code"]


@pytest.mark.django_db
def test_spl_short_code_invalid_format_404(api_client, user_in_org_a, org_a):
    login_as(api_client, user_in_org_a, org_a)
    resp = api_client.get("/api/spl/lookup?code=12345")
    assert resp.status_code == 404


# ---------- Wafeq sync ----------


@pytest.fixture
def setup_with_issued_client_invoice(
    db, master_product, org_a, supplier_org_a,
):
    """Drives RFQ→Order→GRN→SI→CI ISSUED so we can assert Wafeq sync ran."""
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
    from apps.quotes.services import (
        award,
        create_or_get_draft_for_rfq,
        set_item_price,
        submit,
    )
    from apps.rfqs.services import add_item, create_rfq, publish

    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])

    cli = User.objects.create_user(email="cli7@a.local", password="long-enough-pw-1!")
    Membership.objects.create(user=cli, organization=org_a, role="OWNER", status="ACTIVE")
    sup = User.objects.create_user(email="sup7@a.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=sup, organization=supplier_org_a, role="OWNER", status="ACTIVE",
    )

    rfq = create_rfq(client_org=org_a, by=cli, title="phase7", description="")
    add_item(rfq, master_product=master_product, pack_type_code="EACH", quantity=2)
    publish(rfq)
    q = create_or_get_draft_for_rfq(rfq=rfq, supplier_org=supplier_org_a)
    set_item_price(quote=q, item_id=q.items.first().id, unit_price="50.00")
    submit(q)
    contract = award(q, by=cli)
    sign_as_client(contract, by=cli)
    sign_as_supplier(contract, by=sup)
    # R8 — supplier acts on the SPO half of the dual PO pair.
    order = Order.objects.get(contract=contract, type=Order.Type.SPO)
    confirm(order, by=sup)
    dn = create_dn(order=order, by=sup, lines=[
        {"order_item_id": order.items.first().id, "quantity": 2},
    ])
    dispatch_dn(dn)
    grn = create_grn(dn=dn, by=cli)
    complete_grn(grn)
    si = create_supplier_invoice_from_order(order=order)
    issue_supplier_invoice(si)
    ci = create_client_invoice_from_supplier_invoice(si=si)
    issue_client_invoice(ci)  # ← triggers Wafeq sync via Celery (eager in tests)
    return {"client_invoice": ci, "client_org": org_a, "client_user": cli}


@pytest.mark.django_db
def test_wafeq_sync_runs_when_client_invoice_issued(setup_with_issued_client_invoice):
    from apps.integrations.wafeq.models import WafeqContactSync, WafeqInvoiceSync

    ci = setup_with_issued_client_invoice["client_invoice"]
    sync = WafeqInvoiceSync.objects.get(client_invoice=ci)
    assert sync.status == WafeqInvoiceSync.Status.PUSHED
    assert sync.wafeq_invoice_id.startswith("wfq_i_")
    contact = WafeqContactSync.objects.get(organization=ci.client_org)
    assert contact.wafeq_contact_id.startswith("wfq_c_")


@pytest.mark.django_db
def test_wafeq_push_is_idempotent(setup_with_issued_client_invoice):
    from apps.integrations.wafeq.models import WafeqInvoiceSync
    from apps.integrations.wafeq.services import push_client_invoice

    ci = setup_with_issued_client_invoice["client_invoice"]
    before = WafeqInvoiceSync.objects.get(client_invoice=ci)
    again = push_client_invoice(ci)
    assert again.id == before.id
    assert again.status == WafeqInvoiceSync.Status.PUSHED


@pytest.mark.django_db
def test_wafeq_real_provider_raises_until_credentials_added(settings):
    settings.WAFEQ_PROVIDER = "http"
    from apps.integrations.base import IntegrationError
    from apps.integrations.wafeq.providers import get_provider

    p = get_provider()
    assert p.name == "http"

    class _FakeOrg:
        id = 1
        name = "x"

    with pytest.raises(IntegrationError):
        p.upsert_contact(organization=_FakeOrg())

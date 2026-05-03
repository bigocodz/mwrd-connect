"""R6 — Custom Request RFQs.

Spec § Custom Request mode: clients can submit RFQs whose items are NOT
backed by a master product. Suppliers manually quote each line. The
auto-quote engine cannot price-fill these (no offer to match), so every
candidate supplier gets a DRAFT_MANUAL.

Locks the rules:
- An RFQ is created with `source=CUSTOM_REQUEST`.
- Items have `master_product=null`, `free_text_name`, `unit`, etc.
- Catalog-mode RFQs reject items missing master_product/pack_type_code.
- Custom-request RFQs reject items missing free_text_name.
- Publishing a custom-request fans out DRAFT_MANUAL to every active
  supplier (no category filtering — they all get a chance).
"""
from __future__ import annotations

import pytest

from apps.accounts.models import User
from apps.organizations.models import Membership, Organization
from apps.quotes.models import Quote
from apps.rfqs.models import Rfq, RfqItem
from apps.rfqs.services import RfqError, add_item, create_rfq, publish

from .conftest import login_as


@pytest.fixture
def client_user(db, org_a):
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    u = User.objects.create_user(email="alice@client.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=u, organization=org_a, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return u


@pytest.mark.django_db
def test_create_custom_request_rfq_with_freetext_item(client_user, org_a):
    rfq = create_rfq(
        client_org=org_a, by=client_user,
        title="Need bespoke cleaning chemical",
        description="Off-catalog request",
        source=Rfq.Source.CUSTOM_REQUEST,
    )
    item = add_item(
        rfq, free_text_name="Custom alkaline degreaser",
        free_text_description="pH 12+, biodegradable, 5L drums",
        unit="L", quantity=200,
        specs_overrides={"ph": "12+", "biodegradable": True},
    )
    assert item.master_product_id is None
    assert item.free_text_name == "Custom alkaline degreaser"
    assert item.unit == "L"
    assert item.specs_overrides["ph"] == "12+"
    assert item.display_name == "Custom alkaline degreaser"


@pytest.mark.django_db
def test_catalog_rfq_rejects_freetext_only_item(client_user, org_a):
    rfq = create_rfq(
        client_org=org_a, by=client_user, title="x", source=Rfq.Source.CATALOG,
    )
    with pytest.raises(RfqError, match="master_product is required"):
        add_item(rfq, quantity=1, free_text_name="oops")


@pytest.mark.django_db
def test_custom_request_rfq_rejects_item_without_freetext_name(client_user, org_a):
    rfq = create_rfq(
        client_org=org_a, by=client_user, title="x",
        source=Rfq.Source.CUSTOM_REQUEST,
    )
    with pytest.raises(RfqError, match="free_text_name is required"):
        add_item(rfq, quantity=1)


@pytest.mark.django_db
def test_publish_custom_request_fans_out_draft_manual_to_all_suppliers(
    client_user, org_a, supplier_org_a, supplier_org_b,
):
    """Every active supplier gets DRAFT_MANUAL — no category filter applies
    because custom requests don't have a category."""
    # An ARCHIVED supplier shouldn't be drafted.
    Organization.objects.create(
        type=Organization.Type.SUPPLIER,
        status=Organization.Status.ARCHIVED,
        name="Dormant supplier",
        public_id="SUP-ARCH",
        contact_email="dormant@sup.local",
    )
    rfq = create_rfq(
        client_org=org_a, by=client_user, title="off catalog",
        source=Rfq.Source.CUSTOM_REQUEST,
    )
    add_item(rfq, free_text_name="Bespoke widget", unit="PCS", quantity=5)
    publish(rfq)

    quotes = Quote.objects.filter(rfq=rfq)
    supplier_ids = sorted(quotes.values_list("supplier_org_id", flat=True))
    assert supplier_ids == sorted([supplier_org_a.id, supplier_org_b.id])
    # All DRAFT_MANUAL — auto-quote engine can't match offers without a
    # master product, so no DRAFT_AUTO is possible.
    statuses = set(quotes.values_list("status", flat=True))
    assert statuses == {Quote.Status.DRAFT_MANUAL}
    # auto_send_at is null for manual quotes — no auto-send.
    assert all(q.auto_send_at is None for q in quotes)


@pytest.mark.django_db
def test_create_custom_rfq_via_api_and_add_freetext_item(
    api_client, client_user, org_a,
):
    login_as(api_client, client_user, org_a)
    create = api_client.post("/api/rfqs/", {
        "title": "Off-catalog need",
        "description": "Need a special chemical",
        "source": "CUSTOM_REQUEST",
    }, format="json")
    assert create.status_code == 201, create.content
    body = create.json()
    assert body["source"] == "CUSTOM_REQUEST"
    rfq_id = body["id"]

    add = api_client.post(f"/api/rfqs/{rfq_id}/items", {
        "free_text_name": "Alkaline degreaser",
        "free_text_description": "biodegradable",
        "unit": "L",
        "quantity": 100,
        "specs_overrides": {"ph": "12+"},
    }, format="json")
    assert add.status_code == 201, add.content
    item = add.json()
    assert item["free_text_name"] == "Alkaline degreaser"
    assert item["display_name"] == "Alkaline degreaser"
    assert item["master_product"] is None


@pytest.mark.django_db
def test_default_rfq_source_is_catalog(client_user, org_a):
    """Backwards-compat: existing tests don't pass source, so the default
    must remain CATALOG (and they must still work)."""
    rfq = create_rfq(client_org=org_a, by=client_user, title="x")
    assert rfq.source == Rfq.Source.CATALOG


@pytest.mark.django_db
def test_freetext_item_quote_renders_display_name(
    api_client, client_user, org_a, supplier_org_a,
):
    """Supplier quoting on a custom-request line sees `display_name` set
    to the free-text name. master_product_name is null."""
    from apps.accounts.models import User as U
    sup_user = U.objects.create_user(
        email="seller@sup.local", password="long-enough-pw-1!",
    )
    Membership.objects.create(
        user=sup_user, organization=supplier_org_a,
        role=Membership.Role.OWNER, status=Membership.Status.ACTIVE,
    )

    rfq = create_rfq(
        client_org=org_a, by=client_user, title="custom",
        source=Rfq.Source.CUSTOM_REQUEST,
    )
    add_item(rfq, free_text_name="Bespoke A", unit="PCS", quantity=3)
    publish(rfq)
    q = Quote.objects.get(rfq=rfq, supplier_org=supplier_org_a)

    login_as(api_client, sup_user, supplier_org_a)
    resp = api_client.get(f"/api/quotes/{q.id}")
    assert resp.status_code == 200, resp.content
    body = resp.json()
    line = body["items"][0]
    assert line["master_product_name"] is None
    assert line["display_name"] == "Bespoke A"

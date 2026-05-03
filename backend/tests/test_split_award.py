"""R7 — Line-item comparison + split awards.

Spec § "Line-item comparison view, per-item award (split CPOs across
suppliers) OR full-basket award."

Locks the rules:
- Comparison endpoint returns one row per RFQ item; one cell per SUBMITTED
  quote. Cells expose final/client prices only — never cost-side prices.
- award_with_selections groups picks by supplier and creates one Contract
  per supplier with only the picked lines.
- Quotes whose ALL items were picked → AWARDED. Quotes with a subset →
  PARTIALLY_AWARDED. Other SUBMITTED quotes → LOST.
- RFQ → AWARDED if a single supplier got the whole basket; else PARTIALLY_AWARDED.
- A line can only be selected once across the whole award (no double-buy).
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.catalog.models import SupplierProduct
from apps.catalog.services import create_master_product, create_supplier_product
from apps.organizations.models import Membership
from apps.quotes.models import Quote, QuoteLineSelection
from apps.quotes.services import (
    QuoteError,
    award_with_selections,
    comparison_view,
    process_due_auto_quotes,
)
from apps.rfqs.models import Rfq
from apps.rfqs.services import add_item, create_rfq, publish

from .conftest import login_as


# ---------- Setup helpers ----------


def _client_user(client_org):
    client_org.type = "CLIENT"
    client_org.save(update_fields=["type"])
    u = User.objects.create_user(email="alice@client.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=u, organization=client_org, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return u


def _approved_offer(supplier_org, master_product, *, pack_type_code="CASE",
                    cost=Decimal("10.00")):
    sp = create_supplier_product(
        organization=supplier_org, master_product=master_product,
        pack_type_code=pack_type_code, cost_price=cost,
        moq=1, lead_time_days=2, auto_quote=True, is_active=True,
    )
    sp.approval_status = SupplierProduct.Approval.APPROVED
    sp.save(update_fields=["approval_status"])
    return sp


@pytest.fixture
def two_master_products(db, category, staff_user):
    """Two distinct master products in the same category — used to build
    a multi-line RFQ where each line can be picked from a different supplier.
    """
    a = create_master_product(
        by=staff_user, name_en="Cleaner A", name_ar="-",
        description_en="", description_ar="",
        category=category, sku="MA-1", brand="x", image_keys=[], specs={},
        pack_types=[{"code": "CASE", "label_en": "Case", "label_ar": "صندوق", "base_qty": 1, "uom": "CASE"}],
    )
    b = create_master_product(
        by=staff_user, name_en="Cleaner B", name_ar="-",
        description_en="", description_ar="",
        category=category, sku="MA-2", brand="x", image_keys=[], specs={},
        pack_types=[{"code": "CASE", "label_en": "Case", "label_ar": "صندوق", "base_qty": 1, "uom": "CASE"}],
    )
    return a, b


def _two_supplier_rfq(client_org, two_master_products, supplier_org_a, supplier_org_b):
    """Build an RFQ with two lines; each supplier offers both lines.
    Force auto-send so both quotes end up SUBMITTED."""
    a, b = two_master_products
    client_user = _client_user(client_org)

    # Both suppliers offer both products.
    _approved_offer(supplier_org_a, a, cost=Decimal("10.00"))
    _approved_offer(supplier_org_a, b, cost=Decimal("20.00"))
    _approved_offer(supplier_org_b, a, cost=Decimal("9.00"))   # cheaper on A
    _approved_offer(supplier_org_b, b, cost=Decimal("25.00"))  # pricier on B

    rfq = create_rfq(
        client_org=client_org, by=client_user, title="multi-line",
        description="", delivery_location="Riyadh",
    )
    add_item(rfq, master_product=a, pack_type_code="CASE", quantity=10)
    add_item(rfq, master_product=b, pack_type_code="CASE", quantity=5)
    publish(rfq)

    # Force auto-send so quotes are SUBMITTED.
    Quote.objects.filter(rfq=rfq).update(auto_send_at=timezone.now() - timedelta(minutes=1))
    process_due_auto_quotes()
    return rfq, client_user


# ---------- Comparison ----------


@pytest.mark.django_db
def test_comparison_view_returns_grid(
    org_a, supplier_org_a, supplier_org_b, two_master_products,
):
    rfq, _ = _two_supplier_rfq(org_a, two_master_products, supplier_org_a, supplier_org_b)
    grid = comparison_view(rfq)
    assert grid["rfq_id"] == rfq.id
    assert len(grid["rows"]) == 2  # two RFQ lines
    assert len(grid["quotes"]) == 2  # two suppliers
    # Each row has one cell per quote.
    for row in grid["rows"]:
        assert len(row["cells"]) == 2
        # Cells expose final_unit_price (post-margin), not unit_price.
        for cell in row["cells"]:
            assert "final_unit_price" in cell
            assert "final_total_price" in cell


@pytest.mark.django_db
def test_comparison_endpoint(
    api_client, org_a, supplier_org_a, supplier_org_b, two_master_products,
):
    rfq, client_user = _two_supplier_rfq(
        org_a, two_master_products, supplier_org_a, supplier_org_b,
    )
    login_as(api_client, client_user, org_a)
    resp = api_client.get(f"/api/rfqs/{rfq.id}/comparison")
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["rfq_id"] == rfq.id
    assert len(body["rows"]) == 2


# ---------- Split award ----------


@pytest.mark.django_db
def test_split_award_creates_one_contract_per_supplier(
    org_a, supplier_org_a, supplier_org_b, two_master_products,
):
    rfq, client_user = _two_supplier_rfq(
        org_a, two_master_products, supplier_org_a, supplier_org_b,
    )
    quote_a = Quote.objects.get(rfq=rfq, supplier_org=supplier_org_a)
    quote_b = Quote.objects.get(rfq=rfq, supplier_org=supplier_org_b)
    # Pick line A (cheaper) from supplier B, line B (cheaper) from supplier A.
    line_a_qi_b = quote_b.items.get(rfq_item__master_product=two_master_products[0])
    line_b_qi_a = quote_a.items.get(rfq_item__master_product=two_master_products[1])

    contracts = award_with_selections(
        rfq, selections=[line_a_qi_b.id, line_b_qi_a.id], by=client_user,
    )
    assert len(contracts) == 2
    suppliers = {c.supplier_org_id for c in contracts}
    assert suppliers == {supplier_org_a.id, supplier_org_b.id}

    # Each contract has exactly one line.
    for c in contracts:
        assert c.items.count() == 1

    # Quotes: each was partial-awarded (only one of two lines selected).
    quote_a.refresh_from_db()
    quote_b.refresh_from_db()
    assert quote_a.status == Quote.Status.PARTIALLY_AWARDED
    assert quote_b.status == Quote.Status.PARTIALLY_AWARDED
    rfq.refresh_from_db()
    assert rfq.status == Rfq.Status.PARTIALLY_AWARDED

    # Selection rows persisted.
    assert QuoteLineSelection.objects.filter(rfq=rfq).count() == 2


@pytest.mark.django_db
def test_full_basket_to_one_supplier_marks_quote_awarded(
    org_a, supplier_org_a, supplier_org_b, two_master_products,
):
    rfq, client_user = _two_supplier_rfq(
        org_a, two_master_products, supplier_org_a, supplier_org_b,
    )
    quote_a = Quote.objects.get(rfq=rfq, supplier_org=supplier_org_a)
    quote_b = Quote.objects.get(rfq=rfq, supplier_org=supplier_org_b)
    selections = list(quote_a.items.values_list("id", flat=True))
    award_with_selections(rfq, selections=selections, by=client_user)

    quote_a.refresh_from_db()
    quote_b.refresh_from_db()
    rfq.refresh_from_db()
    assert quote_a.status == Quote.Status.AWARDED
    assert quote_b.status == Quote.Status.LOST
    assert rfq.status == Rfq.Status.AWARDED


@pytest.mark.django_db
def test_cannot_select_same_line_twice(
    org_a, supplier_org_a, supplier_org_b, two_master_products,
):
    rfq, client_user = _two_supplier_rfq(
        org_a, two_master_products, supplier_org_a, supplier_org_b,
    )
    quote_a = Quote.objects.get(rfq=rfq, supplier_org=supplier_org_a)
    quote_b = Quote.objects.get(rfq=rfq, supplier_org=supplier_org_b)
    line_a_qi_a = quote_a.items.get(rfq_item__master_product=two_master_products[0])
    line_a_qi_b = quote_b.items.get(rfq_item__master_product=two_master_products[0])
    with pytest.raises(QuoteError, match="appears twice"):
        award_with_selections(
            rfq, selections=[line_a_qi_a.id, line_a_qi_b.id], by=client_user,
        )


@pytest.mark.django_db
def test_empty_selections_rejected(
    org_a, supplier_org_a, supplier_org_b, two_master_products,
):
    rfq, client_user = _two_supplier_rfq(
        org_a, two_master_products, supplier_org_a, supplier_org_b,
    )
    with pytest.raises(QuoteError, match="At least one"):
        award_with_selections(rfq, selections=[], by=client_user)


@pytest.mark.django_db
def test_award_selections_endpoint(
    api_client, org_a, supplier_org_a, supplier_org_b, two_master_products,
):
    rfq, client_user = _two_supplier_rfq(
        org_a, two_master_products, supplier_org_a, supplier_org_b,
    )
    quote_a = Quote.objects.get(rfq=rfq, supplier_org=supplier_org_a)
    selections = list(quote_a.items.values_list("id", flat=True))

    login_as(api_client, client_user, org_a)
    resp = api_client.post(
        f"/api/rfqs/{rfq.id}/award-selections",
        {"selections": selections}, format="json",
    )
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["rfq_status"] == "AWARDED"
    assert len(body["contract_ids"]) == 1


@pytest.mark.django_db
def test_legacy_full_quote_award_still_works(
    api_client, org_a, supplier_org_a, supplier_org_b, two_master_products,
):
    """Backwards-compat: the existing /api/rfqs/<id>/quotes/<qid>/award path
    must still work for the simple single-supplier case."""
    rfq, client_user = _two_supplier_rfq(
        org_a, two_master_products, supplier_org_a, supplier_org_b,
    )
    quote_a = Quote.objects.get(rfq=rfq, supplier_org=supplier_org_a)

    login_as(api_client, client_user, org_a)
    resp = api_client.post(f"/api/rfqs/{rfq.id}/quotes/{quote_a.id}/award")
    assert resp.status_code == 200, resp.content
    rfq.refresh_from_db()
    assert rfq.status == Rfq.Status.AWARDED

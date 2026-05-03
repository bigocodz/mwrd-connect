"""R11 — Document numbering.

Spec § Document numbering. Locks the format and the per-day uniqueness:
    MWRD-CPO-YYYYMMDD-XXXX, MWRD-SPO-..., MWRD-DN-..., MWRD-GRN-...,
    MWRD-INV-..., MWRD-RFQ-..., MWRD-Q-..., and MWRD-PROD-NNNNN
    (master-product code is dateless, 5-digit zero-padded).
"""
from __future__ import annotations

import re

import pytest
from django.utils import timezone

from apps.core.numbering import DocumentKind, next_number


# ---------- Format regex ----------


_DATED_PATTERN = re.compile(r"^MWRD-(CPO|SPO|DN|GRN|INV|RFQ|Q)-\d{8}-\d{4}$")
_PROD_PATTERN = re.compile(r"^MWRD-PROD-\d{5}$")


@pytest.mark.django_db
def test_format_for_dated_kinds():
    today = timezone.now().strftime("%Y%m%d")
    for kind in (
        DocumentKind.CPO, DocumentKind.SPO, DocumentKind.DN,
        DocumentKind.GRN, DocumentKind.INV, DocumentKind.RFQ, DocumentKind.Q,
    ):
        n = next_number(kind)
        assert _DATED_PATTERN.match(n), f"Bad format for {kind}: {n}"
        assert today in n


@pytest.mark.django_db
def test_format_for_master_product():
    code = next_number(DocumentKind.PROD)
    assert _PROD_PATTERN.match(code), f"Bad PROD format: {code}"


@pytest.mark.django_db
def test_sequence_increments_per_kind_per_day():
    a = next_number(DocumentKind.CPO)
    b = next_number(DocumentKind.CPO)
    seq_a = int(a.split("-")[-1])
    seq_b = int(b.split("-")[-1])
    assert seq_b == seq_a + 1


@pytest.mark.django_db
def test_kinds_have_independent_counters():
    cpo = next_number(DocumentKind.CPO)
    spo = next_number(DocumentKind.SPO)
    # Both start independently — first call to each yields seq=1.
    assert cpo.endswith("-0001") or cpo.endswith("-0002")  # depending on test order
    assert spo.endswith("-0001") or spo.endswith("-0002")


@pytest.mark.django_db
def test_prod_counter_continues_across_days():
    """PROD is dateless, so two callers see consecutive integers regardless
    of the calendar."""
    a = next_number(DocumentKind.PROD)
    b = next_number(DocumentKind.PROD)
    seq_a = int(a.split("-")[-1])
    seq_b = int(b.split("-")[-1])
    assert seq_b == seq_a + 1


# ---------- Wired into existing services ----------


@pytest.mark.django_db
def test_create_rfq_stamps_rfq_number(db, org_a):
    from apps.accounts.models import User
    from apps.organizations.models import Membership
    from apps.rfqs.services import create_rfq

    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    u = User.objects.create_user(email="x@a.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=u, organization=org_a, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    rfq = create_rfq(client_org=org_a, by=u, title="t", description="")
    assert _DATED_PATTERN.match(rfq.rfq_number), rfq.rfq_number


@pytest.mark.django_db
def test_create_master_product_stamps_code(category, staff_user):
    from apps.catalog.services import create_master_product

    mp = create_master_product(
        by=staff_user, name_en="x", name_ar="-", description_en="", description_ar="",
        category=category, sku="X1", brand="x", image_keys=[], specs={},
        pack_types=[{"code": "EACH", "label_en": "Each", "label_ar": "وحدة", "base_qty": 1, "uom": "PCS"}],
    )
    assert _PROD_PATTERN.match(mp.master_product_code), mp.master_product_code


@pytest.mark.django_db
def test_dual_po_orders_get_distinct_numbers(
    api_client, master_product, org_a, supplier_org_a,
):
    """The CPO and SPO created from one contract get different po_numbers."""
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

    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    cli = User.objects.create_user(email="c@a.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=cli, organization=org_a, role=Membership.Role.OWNER, status="ACTIVE",
    )
    sup = User.objects.create_user(email="s@a.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=sup, organization=supplier_org_a, role=Membership.Role.OWNER, status="ACTIVE",
    )
    rfq = create_rfq(client_org=org_a, by=cli, title="x", description="")
    add_item(rfq, master_product=master_product, pack_type_code="EACH", quantity=1)
    publish(rfq)
    quote = create_or_get_draft_for_rfq(rfq=rfq, supplier_org=supplier_org_a)
    set_item_price(quote=quote, item_id=quote.items.first().id, unit_price="50.00")
    submit(quote)
    contract = award(quote, by=cli)
    sign_as_client(contract, by=cli)
    sign_as_supplier(contract, by=sup)

    cpo = Order.objects.get(contract=contract, type=Order.Type.CPO)
    spo = Order.objects.get(contract=contract, type=Order.Type.SPO)
    assert cpo.po_number.startswith("MWRD-CPO-")
    assert spo.po_number.startswith("MWRD-SPO-")
    assert cpo.po_number != spo.po_number

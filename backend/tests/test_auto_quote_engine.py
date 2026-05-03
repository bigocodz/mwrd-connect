"""R5 — auto-quote engine.

Locks the spec rules:
- Publishing an RFQ fans out drafts to every matching supplier.
- A supplier with an APPROVED, ACTIVE, auto-quote Offer for every line gets
  DRAFT_AUTO with `auto_send_at` set per their review window.
- A supplier with no auto-offer but a category match gets DRAFT_MANUAL.
- The beat-task body sends due DRAFT_AUTO quotes (status → SUBMITTED) and
  applies margin server-side.
- Quotes whose post-margin total > AUTO_QUOTE_ADMIN_HOLD_THRESHOLD_SAR are
  held as PENDING_ADMIN.
- Admin Quote Manager can release (with optional margin override) or reject.
- Serializer-level redaction: supplier never sees `final_*` prices, client
  never sees `unit_price`/`total_price` or margin pct.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.catalog.models import SupplierProduct
from apps.catalog.services import create_supplier_product
from apps.organizations.models import Membership, Organization
from apps.quotes.models import Quote
from apps.quotes.services import (
    admin_release,
    generate_quotes_for_rfq,
    process_due_auto_quotes,
)
from apps.rfqs.services import add_item, create_rfq, publish

from .conftest import login_as


# ---------- Factories ----------

def _make_supplier_user(supplier_org, email="seller@sup.local"):
    user = User.objects.create_user(email=email, password="long-enough-pw-1!")
    Membership.objects.create(
        user=user, organization=supplier_org, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


def _make_client_user(client_org, email="buyer@client.local"):
    user = User.objects.create_user(email=email, password="long-enough-pw-1!")
    Membership.objects.create(
        user=user, organization=client_org, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


def _approved_offer(supplier_org, master_product, *, pack_type_code="CASE",
                    cost=Decimal("10.00"), auto_quote=True):
    sp = create_supplier_product(
        organization=supplier_org,
        master_product=master_product,
        pack_type_code=pack_type_code,
        cost_price=cost,
        moq=1,
        lead_time_days=3,
        auto_quote=auto_quote,
        is_active=True,
    )
    sp.approval_status = SupplierProduct.Approval.APPROVED
    sp.save(update_fields=["approval_status"])
    return sp


def _build_published_rfq(client_org, client_user, master_product, *,
                         pack_type_code="CASE", quantity=10):
    rfq = create_rfq(
        client_org=client_org, by=client_user,
        title="R5 RFQ", description="", delivery_location="Riyadh",
    )
    add_item(
        rfq, master_product=master_product, pack_type_code=pack_type_code,
        quantity=quantity,
    )
    return publish(rfq)


# ---------- R5c: fan-out ----------


@pytest.mark.django_db
def test_publish_creates_draft_auto_for_supplier_with_offer(
    org_a, supplier_org_a, master_product, staff_user,
):
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)
    _approved_offer(supplier_org_a, master_product, cost=Decimal("12.00"))

    rfq = _build_published_rfq(org_a, client_user, master_product)
    quotes = list(Quote.objects.filter(rfq=rfq))

    assert len(quotes) == 1
    q = quotes[0]
    assert q.supplier_org_id == supplier_org_a.id
    assert q.status == Quote.Status.DRAFT_AUTO
    assert q.is_auto_generated is True
    assert q.auto_send_at is not None
    # Line was pre-priced from the offer.
    assert q.items.count() == 1
    line = q.items.first()
    assert line.unit_price == Decimal("12.00")
    assert line.total_price == Decimal("120.00")  # 10 * 12.00
    assert line.offer_id is not None


@pytest.mark.django_db
def test_publish_creates_draft_manual_when_only_category_match(
    org_a, supplier_org_a, supplier_org_b, master_product, category,
):
    """Supplier B has a different (approved) listing in the same category but
    no offer for the RFQ's master product — should still be drafted manual."""
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)

    # Supplier A: direct auto-quote offer on the master product.
    _approved_offer(supplier_org_a, master_product)

    # Supplier B: a different master product in the same category (so B is
    # category-matched but has no offer for the RFQ line).
    from apps.catalog.services import create_master_product
    other_master = create_master_product(
        by=User.objects.create_user(email="staff2@example.com", password="ChangeMe-Test!", is_staff=True),
        name_en="Other cleaner", name_ar="-", description_en="", description_ar="",
        category=category, sku="CLN-OTHER", brand="x", image_keys=[], specs={},
        pack_types=[{"code": "EACH", "label_en": "Each", "label_ar": "وحدة", "base_qty": 1, "uom": "PCS"}],
    )
    _approved_offer(supplier_org_b, other_master, pack_type_code="EACH",
                    auto_quote=False)

    rfq = _build_published_rfq(org_a, client_user, master_product)
    quotes = {q.supplier_org_id: q for q in Quote.objects.filter(rfq=rfq)}

    assert quotes[supplier_org_a.id].status == Quote.Status.DRAFT_AUTO
    assert quotes[supplier_org_b.id].status == Quote.Status.DRAFT_MANUAL
    assert quotes[supplier_org_b.id].items.count() == 1
    # Manual quote: no offer matched → unit_price defaults to 0.
    assert quotes[supplier_org_b.id].items.first().unit_price == Decimal("0")


@pytest.mark.django_db
def test_publish_does_nothing_when_no_supplier_matches(
    org_a, supplier_org_a, master_product,
):
    """No supplier offers in the RFQ's category → no quotes generated."""
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)

    rfq = _build_published_rfq(org_a, client_user, master_product)
    assert Quote.objects.filter(rfq=rfq).count() == 0


# ---------- R5b: review window honoured ----------


@pytest.mark.django_db
def test_review_window_drives_auto_send_at(
    org_a, supplier_org_a, master_product,
):
    """Supplier set to INSTANT → auto_send_at == now (~0 delay)."""
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)
    supplier_org_a.auto_quote_review_window = "INSTANT"
    supplier_org_a.save(update_fields=["auto_quote_review_window"])
    _approved_offer(supplier_org_a, master_product)

    before = timezone.now()
    rfq = _build_published_rfq(org_a, client_user, master_product)
    after = timezone.now()
    q = Quote.objects.get(rfq=rfq, supplier_org=supplier_org_a)
    assert before - timedelta(seconds=1) <= q.auto_send_at <= after + timedelta(seconds=1)


# ---------- R5d: beat task auto-sends due quotes with margin ----------


@pytest.mark.django_db
def test_beat_task_sends_due_quotes_and_applies_margin(
    org_a, supplier_org_a, master_product,
):
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)
    _approved_offer(supplier_org_a, master_product, cost=Decimal("100.00"))

    rfq = _build_published_rfq(org_a, client_user, master_product)
    q = Quote.objects.get(rfq=rfq)
    # Force auto_send_at into the past.
    Quote.objects.filter(id=q.id).update(auto_send_at=timezone.now() - timedelta(minutes=1))

    n = process_due_auto_quotes()
    assert n == 1
    q.refresh_from_db()
    assert q.status == Quote.Status.SUBMITTED
    assert q.submitted_at is not None
    # Default 15% margin → final_unit_price = 100 * 1.15 = 115.
    assert q.applied_margin_pct == Decimal("15.00")
    assert q.final_total == Decimal("1150.00")  # 10 units


@pytest.mark.django_db
def test_beat_task_skips_undue_quotes(
    org_a, supplier_org_a, master_product,
):
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)
    _approved_offer(supplier_org_a, master_product)

    _build_published_rfq(org_a, client_user, master_product)
    # auto_send_at is in the future (default 30m window).
    n = process_due_auto_quotes()
    assert n == 0


# ---------- R5: hold-for-admin threshold ----------


@pytest.mark.django_db
def test_quote_above_threshold_goes_pending_admin(
    settings, org_a, supplier_org_a, master_product,
):
    settings.AUTO_QUOTE_ADMIN_HOLD_THRESHOLD_SAR = "1000.00"
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)
    # Cost 200 * qty 10 = 2000 → with 15% margin = 2300, well over 1000.
    _approved_offer(supplier_org_a, master_product, cost=Decimal("200.00"))

    rfq = _build_published_rfq(org_a, client_user, master_product)
    q = Quote.objects.get(rfq=rfq)
    Quote.objects.filter(id=q.id).update(auto_send_at=timezone.now() - timedelta(minutes=1))

    process_due_auto_quotes()
    q.refresh_from_db()
    assert q.status == Quote.Status.PENDING_ADMIN
    assert q.admin_held_reason


# ---------- R5e: admin Quote Manager ----------


@pytest.mark.django_db
def test_admin_release_with_margin_override(
    settings, org_a, supplier_org_a, master_product, staff_user,
):
    settings.AUTO_QUOTE_ADMIN_HOLD_THRESHOLD_SAR = "1000.00"
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)
    _approved_offer(supplier_org_a, master_product, cost=Decimal("200.00"))

    rfq = _build_published_rfq(org_a, client_user, master_product)
    q = Quote.objects.get(rfq=rfq)
    Quote.objects.filter(id=q.id).update(auto_send_at=timezone.now() - timedelta(minutes=1))
    process_due_auto_quotes()
    q.refresh_from_db()
    assert q.status == Quote.Status.PENDING_ADMIN

    admin_release(q, by=staff_user, margin_override_pct=Decimal("8.00"))
    q.refresh_from_db()
    assert q.status == Quote.Status.SUBMITTED
    assert q.applied_margin_pct == Decimal("8.00")
    # 200 * qty 10 * 1.08 = 2160
    assert q.final_total == Decimal("2160.00")


@pytest.mark.django_db
def test_staff_pending_endpoint_lists_held_quotes(
    api_client, settings, org_a, supplier_org_a, master_product, staff_user,
):
    settings.AUTO_QUOTE_ADMIN_HOLD_THRESHOLD_SAR = "1000.00"
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)
    _approved_offer(supplier_org_a, master_product, cost=Decimal("200.00"))

    rfq = _build_published_rfq(org_a, client_user, master_product)
    Quote.objects.filter(rfq=rfq).update(auto_send_at=timezone.now() - timedelta(minutes=1))
    process_due_auto_quotes()

    login_as(api_client, staff_user, scope="staff")
    resp = api_client.get("/api/staff/quotes/pending")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["status"] == "PENDING_ADMIN"
    # Staff sees both supplier_total and client_final_total.
    assert "total" in body[0]
    assert "final_total" in body[0]
    assert "applied_margin_pct" in body[0]


@pytest.mark.django_db
def test_staff_release_endpoint(
    api_client, settings, org_a, supplier_org_a, master_product, staff_user,
):
    settings.AUTO_QUOTE_ADMIN_HOLD_THRESHOLD_SAR = "1000.00"
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)
    _approved_offer(supplier_org_a, master_product, cost=Decimal("200.00"))

    rfq = _build_published_rfq(org_a, client_user, master_product)
    Quote.objects.filter(rfq=rfq).update(auto_send_at=timezone.now() - timedelta(minutes=1))
    process_due_auto_quotes()
    q = Quote.objects.get(rfq=rfq)

    login_as(api_client, staff_user, scope="staff")
    resp = api_client.post(
        f"/api/staff/quotes/{q.id}/release",
        {"margin_pct": "10.00"}, format="json",
    )
    assert resp.status_code == 200, resp.content
    q.refresh_from_db()
    assert q.status == Quote.Status.SUBMITTED
    assert q.applied_margin_pct == Decimal("10.00")


@pytest.mark.django_db
def test_staff_reject_endpoint(
    api_client, settings, org_a, supplier_org_a, master_product, staff_user,
):
    settings.AUTO_QUOTE_ADMIN_HOLD_THRESHOLD_SAR = "1000.00"
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)
    _approved_offer(supplier_org_a, master_product, cost=Decimal("200.00"))

    rfq = _build_published_rfq(org_a, client_user, master_product)
    Quote.objects.filter(rfq=rfq).update(auto_send_at=timezone.now() - timedelta(minutes=1))
    process_due_auto_quotes()
    q = Quote.objects.get(rfq=rfq)

    login_as(api_client, staff_user, scope="staff")
    resp = api_client.post(
        f"/api/staff/quotes/{q.id}/reject",
        {"reason": "supplier price out of band"}, format="json",
    )
    assert resp.status_code == 200, resp.content
    q.refresh_from_db()
    assert q.status == Quote.Status.WITHDRAWN
    assert "out of band" in q.admin_held_reason


@pytest.mark.django_db
def test_customer_cannot_call_staff_quote_endpoints(
    api_client, org_a, user_in_org_a,
):
    login_as(api_client, user_in_org_a, org_a)
    for path in (
        "/api/staff/quotes/pending",
    ):
        resp = api_client.get(path)
        assert resp.status_code in (401, 403)


# ---------- R5f: serializer-level redaction ----------


@pytest.mark.django_db
def test_supplier_view_hides_final_prices(
    api_client, org_a, supplier_org_a, master_product,
):
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)
    supplier_user = _make_supplier_user(supplier_org_a)
    _approved_offer(supplier_org_a, master_product, cost=Decimal("12.00"))

    rfq = _build_published_rfq(org_a, client_user, master_product)
    # Auto-send so final_* fields get populated.
    Quote.objects.filter(rfq=rfq).update(auto_send_at=timezone.now() - timedelta(minutes=1))
    process_due_auto_quotes()
    q = Quote.objects.get(rfq=rfq)

    login_as(api_client, supplier_user, supplier_org_a)
    resp = api_client.get(f"/api/quotes/{q.id}")
    assert resp.status_code == 200, resp.content
    body = resp.json()
    # Supplier sees their cost-side total.
    assert "total" in body
    # Supplier MUST NOT see margin pct or final_total.
    assert "final_total" not in body
    assert "applied_margin_pct" not in body
    # Items: supplier sees unit_price/total_price only.
    item = body["items"][0]
    assert "unit_price" in item
    assert "final_unit_price" not in item
    assert "final_total_price" not in item


@pytest.mark.django_db
def test_client_view_hides_supplier_cost(
    api_client, org_a, supplier_org_a, master_product,
):
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)
    _make_supplier_user(supplier_org_a)
    _approved_offer(supplier_org_a, master_product, cost=Decimal("12.00"))

    rfq = _build_published_rfq(org_a, client_user, master_product)
    Quote.objects.filter(rfq=rfq).update(auto_send_at=timezone.now() - timedelta(minutes=1))
    process_due_auto_quotes()
    q = Quote.objects.get(rfq=rfq)

    login_as(api_client, client_user, org_a)
    resp = api_client.get(f"/api/quotes/{q.id}")
    assert resp.status_code == 200, resp.content
    body = resp.json()
    # Client sees post-margin total.
    assert "final_total" in body
    # Client MUST NOT see cost-side total or margin pct.
    assert "total" not in body
    assert "applied_margin_pct" not in body
    item = body["items"][0]
    assert "final_unit_price" in item
    assert "unit_price" not in item
    assert "total_price" not in item


@pytest.mark.django_db
def test_fanout_does_not_overwrite_existing_quote(
    org_a, supplier_org_a, master_product,
):
    """Re-running publish (or re-running fan-out) is idempotent — the
    supplier's existing quote is kept, never replaced."""
    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])
    client_user = _make_client_user(org_a)
    _approved_offer(supplier_org_a, master_product)

    rfq = _build_published_rfq(org_a, client_user, master_product)
    first_qid = Quote.objects.get(rfq=rfq).id
    # Manual second fan-out call: must return the same row.
    out = generate_quotes_for_rfq(rfq)
    assert len(out) == 1
    assert out[0].id == first_qid
    assert Quote.objects.filter(rfq=rfq).count() == 1

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_event
from apps.rfqs.models import Rfq

from .models import Quote, QuoteItem, QuoteLineSelection


class QuoteError(Exception):  # noqa: N818
    pass


@transaction.atomic
def create_or_get_draft_for_rfq(*, rfq: Rfq, supplier_org) -> Quote:
    """Returns the supplier's open quote for this RFQ. Creates one (with
    QuoteItems mirroring the RfqItems) if it doesn't exist yet."""
    from apps.core.numbering import DocumentKind, next_number

    if rfq.status != Rfq.Status.PUBLISHED:
        raise QuoteError(f"Cannot quote on a {rfq.status} RFQ")
    quote, created = Quote.objects.get_or_create(
        rfq=rfq, supplier_org=supplier_org,
        defaults={
            "status": Quote.Status.DRAFT,
            "quote_number": next_number(DocumentKind.Q),
        },
    )
    if quote.status == Quote.Status.WITHDRAWN:
        # Re-open: clear the withdrawn timestamp and reset to DRAFT.
        quote.status = Quote.Status.DRAFT
        quote.withdrawn_at = None
        quote.save(update_fields=["status", "withdrawn_at", "updated_at"])
    if created or quote.items.count() == 0:
        for ri in rfq.items.all():
            QuoteItem.objects.get_or_create(
                quote=quote, rfq_item=ri,
                defaults={"unit_price": Decimal("0"), "total_price": Decimal("0")},
            )
    return quote


def _recompute_total(quote: Quote) -> None:
    total = sum((qi.total_price for qi in quote.items.all()), start=Decimal("0"))
    quote.total = total
    quote.save(update_fields=["total", "updated_at"])


@transaction.atomic
def set_item_price(
    *, quote: Quote, item_id: int, unit_price: Decimal,
    lead_time_days: int | None = None, availability_notes: str = "",
) -> QuoteItem:
    # R5: editable across DRAFT, DRAFT_AUTO, DRAFT_MANUAL
    if quote.status not in (
        Quote.Status.DRAFT, Quote.Status.DRAFT_AUTO, Quote.Status.DRAFT_MANUAL,
    ):
        raise QuoteError("Only DRAFT quotes can be edited")
    item = quote.items.select_related("rfq_item").get(id=item_id)
    item.unit_price = unit_price
    item.total_price = (Decimal(unit_price) * item.rfq_item.quantity).quantize(Decimal("0.01"))
    if lead_time_days is not None:
        item.lead_time_days = lead_time_days
    item.availability_notes = availability_notes
    item.save(update_fields=[
        "unit_price", "total_price", "lead_time_days", "availability_notes",
    ])
    _recompute_total(quote)
    return item


@transaction.atomic
def submit(quote: Quote) -> Quote:
    """Supplier-initiated submit. Routes through send_quote_to_client so that
    margin is applied and the admin-hold threshold is respected — same code
    path as the auto-send beat task."""
    # R5: editable across DRAFT, DRAFT_AUTO, DRAFT_MANUAL.
    if quote.status not in _EDITABLE_STATUSES:
        raise QuoteError(f"Cannot submit a {quote.status} quote")
    if quote.items.filter(unit_price=0, declined=False).exists():
        raise QuoteError("Set a price on every line before submitting")
    return send_quote_to_client(quote)


@transaction.atomic
def withdraw(quote: Quote) -> Quote:
    if quote.status != Quote.Status.SUBMITTED:
        raise QuoteError(f"Cannot withdraw a {quote.status} quote")
    quote.status = Quote.Status.WITHDRAWN
    quote.withdrawn_at = timezone.now()
    quote.save(update_fields=["status", "withdrawn_at", "updated_at"])
    return quote


@transaction.atomic
def award(quote: Quote, *, by):
    """Mark this quote AWARDED, mark all other open quotes on the RFQ LOST,
    set the RFQ to AWARDED, and create a Contract.
    Returns the Contract."""
    if quote.status != Quote.Status.SUBMITTED:
        raise QuoteError(f"Cannot award a {quote.status} quote")
    rfq = quote.rfq
    if rfq.status != Rfq.Status.PUBLISHED:
        raise QuoteError(f"Cannot award on a {rfq.status} RFQ")

    quote.status = Quote.Status.AWARDED
    quote.awarded_at = timezone.now()
    quote.save(update_fields=["status", "awarded_at", "updated_at"])

    Quote.objects.filter(rfq=rfq, status=Quote.Status.SUBMITTED).update(
        status=Quote.Status.LOST,
    )

    rfq.status = Rfq.Status.AWARDED
    rfq.awarded_at = timezone.now()
    rfq.save(update_fields=["status", "awarded_at", "updated_at"])

    record_event(action="quote.award", target=quote, actor=by,
                 organization=rfq.client_org,
                 payload={"rfq_id": rfq.id, "supplier_org_id": quote.supplier_org_id,
                          "total": str(quote.total)})

    from apps.notifications.services import notify_org
    notify_org(
        organization=quote.supplier_org,
        kind="quote.awarded",
        title=f"Your quote on RFQ #{rfq.id} was awarded",
        body=f"Total {quote.total} SAR. A contract has been created — please review and sign.",
        payload={"target": f"rfq:{rfq.id}", "quote_id": quote.id},
    )

    # Late import to avoid circular dependency.
    from apps.contracts.services import create_contract_from_quote

    return create_contract_from_quote(quote=quote, by=by)


# ---------- R5: Auto-quote engine ----------

# Backwards-compat: existing tests submit DRAFT quotes (the legacy "manual"
# code path). New code path uses DRAFT_AUTO and DRAFT_MANUAL. We treat all
# three as "editable" everywhere it matters.
_EDITABLE_STATUSES = (
    Quote.Status.DRAFT,
    Quote.Status.DRAFT_AUTO,
    Quote.Status.DRAFT_MANUAL,
)


def _is_editable(quote: Quote) -> bool:
    return quote.status in _EDITABLE_STATUSES


_WINDOW_TO_DELTA = {
    "INSTANT": 0,
    "WINDOW_30M": 30 * 60,
    "WINDOW_2H": 2 * 60 * 60,
}


def _auto_send_at_for(supplier_org) -> timezone.datetime:
    seconds = _WINDOW_TO_DELTA.get(
        supplier_org.auto_quote_review_window, _WINDOW_TO_DELTA["WINDOW_30M"],
    )
    from datetime import timedelta as _td
    return timezone.now() + _td(seconds=seconds)


def _matching_offer_for(*, master_product_id: int, pack_type_code: str, supplier_org):
    """Return the supplier's APPROVED, ACTIVE, auto-quote-enabled offer for
    this (master_product, pack_type) — or None."""
    from apps.catalog.models import SupplierProduct
    return (
        SupplierProduct.objects.filter(
            organization=supplier_org,
            master_product_id=master_product_id,
            pack_type_code=pack_type_code,
            approval_status=SupplierProduct.Approval.APPROVED,
            is_active=True,
            auto_quote=True,
        )
        .first()
    )


def _suppliers_in_matching_categories(rfq: Rfq):
    """Suppliers who have ANY APPROVED+ACTIVE offer in any category that an
    RFQ item lives in. Used for the manual-draft case (spec § auto-quote
    engine, step 3). Returns a set of Organization rows."""
    from apps.catalog.models import MasterProduct, SupplierProduct
    from apps.organizations.models import Organization

    item_master_ids = list(
        rfq.items.filter(master_product_id__isnull=False)
        .values_list("master_product_id", flat=True)
    )
    if not item_master_ids:
        return Organization.objects.none()
    category_ids = list(
        MasterProduct.objects.filter(id__in=item_master_ids)
        .values_list("category_id", flat=True).distinct()
    )
    supplier_ids = (
        SupplierProduct.objects
        .filter(
            master_product__category_id__in=category_ids,
            approval_status=SupplierProduct.Approval.APPROVED,
            is_active=True,
        )
        .values_list("organization_id", flat=True)
        .distinct()
    )
    return Organization.objects.filter(id__in=list(supplier_ids))


@transaction.atomic
def generate_quotes_for_rfq(rfq: Rfq) -> list[Quote]:
    """Spec § auto-quote engine. Called when an RFQ is published.

    For each candidate supplier, create one Quote in either:
    - DRAFT_AUTO  (had at least one matching auto-quote Offer)
    - DRAFT_MANUAL (matched by category, or it's a custom request)

    QuoteItems are pre-populated for every RfqItem. Lines without a matching
    offer are created with `unit_price=0` so the supplier sees the row and
    can fill it in or decline it.

    Custom-request RFQs (`rfq.source == CUSTOM_REQUEST`): no master_product
    means no offer matching. We fan out to every active supplier as
    DRAFT_MANUAL — the spec's premise is "off-catalog needs everyone gets a
    chance to quote".
    """
    if rfq.status != Rfq.Status.PUBLISHED:
        return []

    rfq_items = list(rfq.items.all())
    if not rfq_items:
        return []

    from apps.catalog.models import SupplierProduct
    from apps.organizations.models import Organization

    if rfq.source == Rfq.Source.CUSTOM_REQUEST:
        # Broadcast to every active supplier; they all draft manually.
        candidates = Organization.objects.filter(
            type=Organization.Type.SUPPLIER, status=Organization.Status.ACTIVE,
        )
    else:
        # Universe of candidate suppliers = anyone with any matching offer +
        # anyone serving the matching categories without an auto-quote offer.
        item_master_ids = [
            ri.master_product_id for ri in rfq_items if ri.master_product_id
        ]
        direct_supplier_ids = set(
            SupplierProduct.objects.filter(
                master_product_id__in=item_master_ids,
                approval_status=SupplierProduct.Approval.APPROVED,
                is_active=True,
            ).values_list("organization_id", flat=True)
        )
        category_supplier_ids = {
            s.id for s in _suppliers_in_matching_categories(rfq)
        }
        candidate_supplier_ids = direct_supplier_ids | category_supplier_ids
        if not candidate_supplier_ids:
            return []

        candidates = Organization.objects.filter(
            id__in=candidate_supplier_ids, type=Organization.Type.SUPPLIER,
            status=Organization.Status.ACTIVE,
        )

    out: list[Quote] = []
    for supplier in candidates:
        # Was this supplier already given a quote (legacy DRAFT etc.)?
        existing = Quote.objects.filter(rfq=rfq, supplier_org=supplier).first()
        if existing is not None:
            out.append(existing)
            continue

        # Determine status + auto_send_at by checking if ANY rfq item has
        # an auto-quote-eligible offer for this supplier.
        has_auto_offer = False
        per_item_offer = {}
        for ri in rfq_items:
            if ri.master_product_id is None:
                continue
            offer = _matching_offer_for(
                master_product_id=ri.master_product_id,
                pack_type_code=ri.pack_type_code,
                supplier_org=supplier,
            )
            if offer is not None:
                has_auto_offer = True
                per_item_offer[ri.id] = offer

        if has_auto_offer:
            status = Quote.Status.DRAFT_AUTO
            auto_send_at = _auto_send_at_for(supplier)
        else:
            status = Quote.Status.DRAFT_MANUAL
            auto_send_at = None

        from apps.core.numbering import DocumentKind, next_number
        quote = Quote.objects.create(
            rfq=rfq, supplier_org=supplier,
            status=status, is_auto_generated=has_auto_offer,
            auto_send_at=auto_send_at,
            quote_number=next_number(DocumentKind.Q),
        )

        # Pre-populate QuoteItems (priced from offer where available).
        running_total = Decimal("0")
        for ri in rfq_items:
            offer = per_item_offer.get(ri.id)
            if offer is not None:
                unit = Decimal(offer.cost_price)
                line_total = (unit * ri.quantity).quantize(Decimal("0.01"))
                QuoteItem.objects.create(
                    quote=quote, rfq_item=ri,
                    unit_price=unit, total_price=line_total,
                    lead_time_days=offer.lead_time_days,
                    offer=offer,
                )
                running_total += line_total
            else:
                QuoteItem.objects.create(
                    quote=quote, rfq_item=ri,
                    unit_price=Decimal("0"), total_price=Decimal("0"),
                )

        if running_total > 0:
            quote.total = running_total
            quote.save(update_fields=["total", "updated_at"])

        record_event(
            action="quote.auto_drafted" if has_auto_offer else "quote.manual_drafted",
            target=quote, organization=supplier,
            payload={
                "rfq_id": rfq.id,
                "auto_send_at": auto_send_at.isoformat() if auto_send_at else None,
            },
        )

        from apps.notifications.services import notify_org
        notify_org(
            organization=supplier,
            kind="rfq.matched",
            title=f"New RFQ #{rfq.id} — {rfq.title}",
            body=(
                f"Auto-quote drafted; will send at {auto_send_at:%H:%M} unless you edit."
                if has_auto_offer else "Manual quote required."
            ),
            payload={"target": f"rfq:{rfq.id}", "quote_id": quote.id},
        )
        out.append(quote)

    return out


def _apply_margin_to_items(quote: Quote, *, margin_override_pct: Decimal | None = None) -> Decimal:
    """Stamp final_unit_price/final_total_price on every line. Returns the
    margin pct that was applied (so callers can persist it)."""
    from apps.pricing.services import apply_margin

    # Resolve once per quote — the spec uses a single rate per quote, not
    # per-line. (Per-category override would require multi-rate quotes.)
    first_master_category_id = None
    first_item = quote.items.select_related("rfq_item__master_product").first()
    if first_item and first_item.rfq_item.master_product_id:
        first_master_category_id = first_item.rfq_item.master_product.category_id

    final_total = Decimal("0")
    applied_pct: Decimal | None = None
    for qi in quote.items.all():
        if qi.unit_price == 0 or qi.declined:
            qi.final_unit_price = Decimal("0")
            qi.final_total_price = Decimal("0")
            qi.save(update_fields=["final_unit_price", "final_total_price"])
            continue
        final_unit, applied_pct = apply_margin(
            supplier_unit_price_sar=qi.unit_price,
            margin_pct=margin_override_pct,
            client_org_id=quote.rfq.client_org_id,
            category_id=first_master_category_id,
        )
        line_total = (final_unit * qi.rfq_item.quantity).quantize(Decimal("0.01"))
        qi.final_unit_price = final_unit
        qi.final_total_price = line_total
        qi.save(update_fields=["final_unit_price", "final_total_price"])
        final_total += line_total
    return final_total, applied_pct or Decimal("0")


@transaction.atomic
def send_quote_to_client(
    quote: Quote, *, margin_override_pct=None, hold_threshold_sar=None,
) -> Quote:
    """Apply margin server-side and either submit-to-client or
    hold-for-admin-review based on threshold.
    """
    from django.conf import settings

    if quote.status not in (
        Quote.Status.DRAFT_AUTO, Quote.Status.DRAFT_MANUAL,
        Quote.Status.PENDING_ADMIN, Quote.Status.DRAFT,
    ):
        raise QuoteError(f"Cannot send a {quote.status} quote")
    if quote.items.filter(unit_price=0, declined=False).exists():
        raise QuoteError("Cannot send: every line needs a price or must be declined")

    final_total, applied_pct = _apply_margin_to_items(
        quote, margin_override_pct=margin_override_pct,
    )
    quote.final_total = final_total
    quote.applied_margin_pct = applied_pct

    threshold = Decimal(
        hold_threshold_sar
        if hold_threshold_sar is not None
        else settings.AUTO_QUOTE_ADMIN_HOLD_THRESHOLD_SAR
    )
    # If staff is calling with an explicit override, skip the hold (they're
    # already reviewing it).
    if margin_override_pct is None and final_total > threshold:
        quote.status = Quote.Status.PENDING_ADMIN
        quote.admin_held_reason = f"Total {final_total} > threshold {threshold}"
        quote.save(update_fields=[
            "status", "final_total", "applied_margin_pct",
            "admin_held_reason", "updated_at",
        ])
        record_event(
            action="quote.held_for_admin", target=quote,
            organization=quote.supplier_org,
            payload={"final_total": str(final_total), "threshold": str(threshold)},
        )
        return quote

    quote.status = Quote.Status.SUBMITTED
    quote.submitted_at = timezone.now()
    quote.save(update_fields=[
        "status", "submitted_at", "final_total", "applied_margin_pct",
        "admin_held_reason", "updated_at",
    ])
    record_event(
        action="quote.submit", target=quote, organization=quote.supplier_org,
        payload={
            "rfq_id": quote.rfq_id,
            "supplier_total": str(quote.total),
            "client_total": str(final_total),
            "is_auto": quote.is_auto_generated,
        },
    )
    from apps.notifications.services import notify_org
    notify_org(
        organization=quote.rfq.client_org,
        kind="quote.received",
        title=f"New quote on RFQ #{quote.rfq_id}",
        body=f"Total {final_total} SAR.",
        payload={"target": f"rfq:{quote.rfq_id}", "quote_id": quote.id},
    )
    return quote


@transaction.atomic
def admin_release(
    quote: Quote, *, by, margin_override_pct=None,
) -> Quote:
    """Quote Manager: release a PENDING_ADMIN quote to the client.

    `margin_override_pct` is the slider value from the admin UI. When set,
    the quote bypasses the auto-hold threshold (staff already reviewed it).
    """
    if quote.status != Quote.Status.PENDING_ADMIN:
        raise QuoteError(f"Cannot release a {quote.status} quote")
    record_event(
        action="quote.admin_release", target=quote, actor=by,
        organization=quote.supplier_org,
        payload={"margin_override_pct": str(margin_override_pct) if margin_override_pct else None},
    )
    return send_quote_to_client(quote, margin_override_pct=margin_override_pct)


@transaction.atomic
def admin_reject(quote: Quote, *, by, reason: str = "") -> Quote:
    """Quote Manager: reject a PENDING_ADMIN quote. Goes to WITHDRAWN —
    the supplier is notified and may resubmit (we don't have a separate
    REJECTED status on Quote and creating one would muddy the state machine).
    """
    if quote.status != Quote.Status.PENDING_ADMIN:
        raise QuoteError(f"Cannot reject a {quote.status} quote")
    quote.status = Quote.Status.WITHDRAWN
    quote.withdrawn_at = timezone.now()
    quote.admin_held_reason = (reason or "Rejected by Quote Manager")[:255]
    quote.save(update_fields=[
        "status", "withdrawn_at", "admin_held_reason", "updated_at",
    ])
    record_event(
        action="quote.admin_reject", target=quote, actor=by,
        organization=quote.supplier_org, payload={"reason": reason},
    )
    from apps.notifications.services import notify_org
    notify_org(
        organization=quote.supplier_org,
        kind="quote.rejected_by_admin",
        title=f"Quote on RFQ #{quote.rfq_id} rejected by Quote Manager",
        body=reason or "Please review and resubmit.",
        payload={"target": f"rfq:{quote.rfq_id}", "quote_id": quote.id},
    )
    return quote


# ---------- R7: Line-item comparison + split awards ----------


def comparison_view(rfq: Rfq) -> dict:
    """Returns a structured comparison: rows = RFQ items, columns = quotes.

    Used by the client comparison screen. Cell content for each (rfq_item,
    quote) is the matching QuoteItem (or None if the supplier didn't quote
    that line).

    Anonymity is enforced at the serializer; this helper just returns IDs.
    """
    items = list(rfq.items.all().order_by("line_no"))
    quotes = list(
        rfq.quotes.filter(status=Quote.Status.SUBMITTED)
        .select_related("supplier_org")
        .prefetch_related("items")
    )

    # Build a per-(quote, rfq_item) lookup.
    cells: dict[tuple[int, int], QuoteItem] = {}
    for q in quotes:
        for qi in q.items.all():
            cells[(q.id, qi.rfq_item_id)] = qi

    rows = []
    for ri in items:
        row = {
            "rfq_item_id": ri.id,
            "line_no": ri.line_no,
            "display_name": ri.display_name,
            "quantity": ri.quantity,
            "pack_type_code": ri.pack_type_code,
            "cells": [],
        }
        for q in quotes:
            qi = cells.get((q.id, ri.id))
            row["cells"].append({
                "quote_id": q.id,
                "quote_item_id": qi.id if qi else None,
                "declined": qi.declined if qi else False,
                # Final (client-facing) prices only — never expose cost.
                "final_unit_price": (
                    str(qi.final_unit_price) if qi and qi.final_unit_price else None
                ),
                "final_total_price": (
                    str(qi.final_total_price) if qi and qi.final_total_price else None
                ),
                "lead_time_days": qi.lead_time_days if qi else None,
            })
        rows.append(row)

    return {
        "rfq_id": rfq.id,
        "quotes": [
            {"quote_id": q.id, "supplier_org_id": q.supplier_org_id} for q in quotes
        ],
        "rows": rows,
    }


@transaction.atomic
def award_with_selections(rfq: Rfq, *, selections: list[int], by) -> list:
    """R7 — split-award entry point.

    `selections` is a list of QuoteItem ids the client picked. Validation:
    - All quote_items belong to a SUBMITTED quote on this RFQ.
    - Each rfq_item is selected at most once.
    - At least one selection (no-op award is rejected).

    For each supplier represented in the selections, creates one Contract
    with only the selected lines. Other suppliers' quotes → LOST. Quotes
    with all-of-their-items selected → AWARDED; quotes with a subset →
    PARTIALLY_AWARDED. RFQ → AWARDED if exactly one supplier picked, else
    PARTIALLY_AWARDED.

    Returns the list of created Contracts.
    """
    if rfq.status != Rfq.Status.PUBLISHED:
        raise QuoteError(f"Cannot award on a {rfq.status} RFQ")
    if not selections:
        raise QuoteError("At least one line selection is required")

    qis = list(
        QuoteItem.objects.filter(id__in=selections)
        .select_related("quote", "rfq_item__master_product")
    )
    if len(qis) != len(set(selections)):
        raise QuoteError("Duplicate quote_item ids in selections")

    # Validate each one.
    rfq_item_ids_seen: set[int] = set()
    for qi in qis:
        if qi.quote.rfq_id != rfq.id:
            raise QuoteError(f"quote_item {qi.id} does not belong to RFQ {rfq.id}")
        if qi.quote.status != Quote.Status.SUBMITTED:
            raise QuoteError(
                f"quote_item {qi.id}'s quote is in {qi.quote.status}, "
                "must be SUBMITTED to award",
            )
        if qi.declined:
            raise QuoteError(f"quote_item {qi.id} was declined by the supplier")
        if qi.rfq_item_id in rfq_item_ids_seen:
            raise QuoteError(
                f"RFQ line {qi.rfq_item_id} appears twice in selections — "
                "each line can only be awarded to one supplier",
            )
        rfq_item_ids_seen.add(qi.rfq_item_id)

    # Persist QuoteLineSelection rows for traceability.
    QuoteLineSelection.objects.filter(rfq=rfq).delete()
    for qi in qis:
        QuoteLineSelection.objects.create(
            rfq=rfq, quote=qi.quote, quote_item=qi,
            rfq_item_id=qi.rfq_item_id, selected_by=by,
        )

    # Group selections by quote.
    by_quote: dict[int, list[QuoteItem]] = {}
    for qi in qis:
        by_quote.setdefault(qi.quote_id, []).append(qi)

    from apps.contracts.services import create_contract_from_quote_items
    contracts = []
    for _quote_id, picked_items in by_quote.items():
        quote = picked_items[0].quote
        total_lines_in_quote = quote.items.count()
        is_partial = len(picked_items) < total_lines_in_quote
        if is_partial:
            quote.status = Quote.Status.PARTIALLY_AWARDED
        else:
            quote.status = Quote.Status.AWARDED
        quote.awarded_at = timezone.now()
        quote.save(update_fields=["status", "awarded_at", "updated_at"])

        contract = create_contract_from_quote_items(
            quote=quote, quote_items=picked_items, by=by,
        )
        contracts.append(contract)

        record_event(
            action="quote.award" if not is_partial else "quote.partial_award",
            target=quote, actor=by, organization=rfq.client_org,
            payload={
                "rfq_id": rfq.id,
                "supplier_org_id": quote.supplier_org_id,
                "line_count": len(picked_items),
                "is_partial": is_partial,
            },
        )

        from apps.notifications.services import notify_org
        notify_org(
            organization=quote.supplier_org,
            kind="quote.awarded",
            title=(
                f"Your quote on RFQ #{rfq.id} was "
                f"{'partially ' if is_partial else ''}awarded"
            ),
            body=f"{len(picked_items)} line(s) awarded. Please review and sign the contract.",
            payload={
                "target": f"rfq:{rfq.id}",
                "quote_id": quote.id,
                "is_partial": is_partial,
            },
        )

    # Other SUBMITTED quotes on the RFQ → LOST.
    Quote.objects.filter(
        rfq=rfq, status=Quote.Status.SUBMITTED,
    ).update(status=Quote.Status.LOST)

    # RFQ status: AWARDED if one supplier got the whole basket, else PARTIAL.
    if len(by_quote) == 1 and len(qis) == rfq.items.count():
        rfq.status = Rfq.Status.AWARDED
    else:
        rfq.status = Rfq.Status.PARTIALLY_AWARDED
    rfq.awarded_at = timezone.now()
    rfq.save(update_fields=["status", "awarded_at", "updated_at"])

    return contracts


def process_due_auto_quotes() -> int:
    """Beat task body: send every DRAFT_AUTO quote whose `auto_send_at` has
    passed. Returns count of quotes sent. Idempotent — sending advances the
    status away from DRAFT_AUTO so the next run won't pick it up again.
    """
    now = timezone.now()
    due = Quote.objects.filter(
        status=Quote.Status.DRAFT_AUTO, auto_send_at__lte=now,
    )
    n = 0
    for q in due:
        try:
            send_quote_to_client(q)
            n += 1
        except QuoteError:
            # Skip quotes that aren't ready (e.g. lines still at 0 because
            # supplier hasn't filled them — shouldn't happen for AUTO but
            # defensive).
            continue
    return n

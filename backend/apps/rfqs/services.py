from __future__ import annotations

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.audit.services import record_event

from .models import Rfq, RfqItem


class RfqError(Exception):  # noqa: N818
    pass


@transaction.atomic
def create_rfq(*, client_org, by, **fields) -> Rfq:
    from apps.core.numbering import DocumentKind, next_number

    rfq = Rfq.objects.create(
        client_org=client_org, created_by=by,
        rfq_number=next_number(DocumentKind.RFQ),
        **fields,
    )
    record_event(action="rfq.create", target=rfq, actor=by, organization=client_org,
                 payload={"title": rfq.title, "rfq_number": rfq.rfq_number})
    return rfq


@transaction.atomic
def add_item(
    rfq: Rfq, *, master_product=None, pack_type_code: str = "",
    quantity: int, notes: str = "",
    # R6 — custom-request fields
    free_text_name: str = "", free_text_description: str = "",
    unit: str = "", specs_overrides: dict | None = None,
) -> RfqItem:
    if rfq.status != Rfq.Status.DRAFT:
        raise RfqError("Cannot add items to a non-DRAFT RFQ")
    if rfq.source == Rfq.Source.CATALOG:
        if master_product is None:
            raise RfqError("master_product is required for catalog RFQ items")
        if not pack_type_code:
            raise RfqError("pack_type_code is required for catalog RFQ items")
    elif rfq.source == Rfq.Source.CUSTOM_REQUEST:
        if not free_text_name:
            raise RfqError("free_text_name is required for custom-request items")
    next_line = (rfq.items.aggregate(m=Max("line_no"))["m"] or 0) + 1
    return RfqItem.objects.create(
        rfq=rfq, line_no=next_line,
        master_product=master_product, pack_type_code=pack_type_code,
        quantity=quantity, notes=notes,
        free_text_name=free_text_name,
        free_text_description=free_text_description,
        unit=unit,
        specs_overrides=specs_overrides or {},
    )


@transaction.atomic
def publish(rfq: Rfq) -> Rfq:
    if rfq.status != Rfq.Status.DRAFT:
        raise RfqError(f"Cannot publish a {rfq.status} RFQ")
    if not rfq.items.exists():
        raise RfqError("Add at least one line before publishing")
    rfq.status = Rfq.Status.PUBLISHED
    rfq.published_at = timezone.now()
    rfq.save(update_fields=["status", "published_at", "updated_at"])
    record_event(action="rfq.publish", target=rfq, organization=rfq.client_org,
                 payload={"items": rfq.items.count()})

    # R5: fan out auto-quote drafts to matching suppliers. Late import to
    # avoid the rfqs ↔ quotes circular at module-load.
    from apps.quotes.services import generate_quotes_for_rfq
    generate_quotes_for_rfq(rfq)

    return rfq


@transaction.atomic
def close(rfq: Rfq) -> Rfq:
    if rfq.status not in (Rfq.Status.PUBLISHED, Rfq.Status.AWARDED):
        raise RfqError(f"Cannot close a {rfq.status} RFQ")
    rfq.status = Rfq.Status.CLOSED
    rfq.closed_at = timezone.now()
    rfq.save(update_fields=["status", "closed_at", "updated_at"])
    record_event(action="rfq.close", target=rfq, organization=rfq.client_org)
    return rfq

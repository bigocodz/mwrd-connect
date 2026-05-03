"""R11 — Document numbering.

Spec § "Generators in shared utils/numbers". Format:
    MWRD-{KIND}-YYYYMMDD-XXXX

The XXXX suffix is a per-day sequence per kind (4-digit padded). Master
product codes are different — `MWRD-PROD-NNNNN` is a 5-digit zero-padded
running sequence (no date component).

Implementation choice: a single `DocumentSequence` table keeps a counter
keyed by (kind, date). `next_number(kind)` does an atomic
`INSERT … ON CONFLICT DO UPDATE` that increments and returns. The
helper is callable from any service:

    po_number = next_number(DocumentKind.CPO)   # MWRD-CPO-20260103-0001
    next_number(DocumentKind.PROD)              # MWRD-PROD-04521

Document kinds map 1:1 onto the prefixes the spec calls out: CPO, SPO,
DN, GRN, INV, RFQ, Q (quote), PROD (master product).
"""
from __future__ import annotations

import enum

from django.db import transaction
from django.utils import timezone

from .numbering_models import DocumentSequence


class DocumentKind(enum.StrEnum):
    CPO = "CPO"
    SPO = "SPO"
    DN = "DN"
    GRN = "GRN"
    INV = "INV"
    RFQ = "RFQ"
    Q = "Q"
    PROD = "PROD"  # master product code


# PROD is sequential without a date; everything else is per-day.
_DATELESS_KINDS = {DocumentKind.PROD}


def _date_key_for(kind: DocumentKind) -> str:
    if kind in _DATELESS_KINDS:
        return "ALL"
    return timezone.now().strftime("%Y%m%d")


def _format(kind: DocumentKind, date_key: str, seq: int) -> str:
    if kind in _DATELESS_KINDS:
        # MWRD-PROD-NNNNN with 5-digit zero pad.
        return f"MWRD-{kind.value}-{seq:05d}"
    return f"MWRD-{kind.value}-{date_key}-{seq:04d}"


@transaction.atomic
def next_number(kind: DocumentKind | str) -> str:
    """Return the next document number for `kind`. Atomic against concurrent
    callers — uses SELECT FOR UPDATE on the (kind, date_key) row."""
    if isinstance(kind, str):
        kind = DocumentKind(kind)
    date_key = _date_key_for(kind)
    row, _ = DocumentSequence.objects.select_for_update().get_or_create(
        kind=kind.value, date_key=date_key, defaults={"value": 0},
    )
    row.value = row.value + 1
    row.save(update_fields=["value", "updated_at"])
    return _format(kind, date_key, row.value)

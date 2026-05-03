"""Pricing service — the only place margin gets applied.

Spec rule (NEVER violate): margin is server-side only. Domain code calls
`apply_margin()` once when a quote item is materialized; the resulting
`final_unit_price` is what the client sees, the original `supplier_unit_price`
is what the supplier wrote. The two prices live on different fields of
QuoteItem (R5 wires this).

Resolution order (highest precedence first):
    1. CLIENT    — per-client override
    2. CATEGORY  — per-category override (the master_product's category)
    3. GLOBAL    — platform default

If no rule matches we fall back to the platform default in
`settings.DEFAULT_MARGIN_PCT` (15% per spec).
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import transaction

from .models import Margin


def _q(d: Decimal | str | int | float) -> Decimal:
    return Decimal(d).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_global_margin_pct() -> Decimal:
    row = Margin.objects.filter(scope=Margin.Scope.GLOBAL).first()
    if row is not None:
        return Decimal(row.pct)
    return Decimal(getattr(settings, "DEFAULT_MARGIN_PCT", "15.00"))


def resolve_margin_pct(*, client_org_id: int | None, category_id: int | None) -> Decimal:
    """Return the effective margin percentage for a (client, category) pair.

    Both args are optional. A null client/category just falls through to
    the next rule down."""
    if client_org_id is not None:
        row = Margin.objects.filter(
            scope=Margin.Scope.CLIENT, scope_id=client_org_id,
        ).first()
        if row is not None:
            return Decimal(row.pct)
    if category_id is not None:
        row = Margin.objects.filter(
            scope=Margin.Scope.CATEGORY, scope_id=category_id,
        ).first()
        if row is not None:
            return Decimal(row.pct)
    return get_global_margin_pct()


def apply_margin(
    *, supplier_unit_price_sar: Decimal | str | int | float,
    margin_pct: Decimal | None = None,
    client_org_id: int | None = None,
    category_id: int | None = None,
) -> tuple[Decimal, Decimal]:
    """Compute the client-facing unit price.

    Pass `margin_pct` to override (e.g. backoffice slider). Otherwise the
    function resolves the rate via `resolve_margin_pct`.

    Returns `(final_unit_price_sar, applied_pct)` so callers can audit
    what rate was used.
    """
    cost = Decimal(supplier_unit_price_sar)
    if margin_pct is None:
        margin_pct = resolve_margin_pct(
            client_org_id=client_org_id, category_id=category_id,
        )
    multiplier = Decimal("1") + (Decimal(margin_pct) / Decimal("100"))
    return _q(cost * multiplier), Decimal(margin_pct)


# ---------- Mutators (staff-only callers) ----------


@transaction.atomic
def set_global_margin(*, pct: Decimal | str | int | float, by) -> Margin:
    pct_d = Decimal(pct)
    obj, _ = Margin.objects.update_or_create(
        scope=Margin.Scope.GLOBAL, scope_id=None,
        defaults={"pct": pct_d, "updated_by": by},
    )
    return obj


@transaction.atomic
def set_category_margin(*, category_id: int, pct, by) -> Margin:
    obj, _ = Margin.objects.update_or_create(
        scope=Margin.Scope.CATEGORY, scope_id=category_id,
        defaults={"pct": Decimal(pct), "updated_by": by},
    )
    return obj


@transaction.atomic
def set_client_margin(*, client_org_id: int, pct, by) -> Margin:
    obj, _ = Margin.objects.update_or_create(
        scope=Margin.Scope.CLIENT, scope_id=client_org_id,
        defaults={"pct": Decimal(pct), "updated_by": by},
    )
    return obj


def delete_margin(*, scope: str, scope_id: int | None) -> None:
    Margin.objects.filter(scope=scope, scope_id=scope_id).delete()

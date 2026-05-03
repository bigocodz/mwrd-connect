from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_event

from .models import Contract, ContractItem


class ContractError(Exception):  # noqa: N818
    pass


@transaction.atomic
def create_contract_from_quote(*, quote, by) -> Contract:
    """Full-basket award path: every quote item becomes a contract item."""
    return create_contract_from_quote_items(
        quote=quote, quote_items=list(quote.items.all()), by=by,
    )


@transaction.atomic
def create_contract_from_quote_items(*, quote, quote_items, by) -> Contract:
    """R7 — partial-award path. Used by the split-award flow when only a
    subset of a quote's items was picked. The total is the sum of the
    selected lines (cost-side) — final/client total is recomputed later
    if needed by downstream PO/invoice generation.

    Note: ContractItem.master_product is NOT NULL today. For custom-request
    items (master_product is None on RfqItem) we'd need a schema change.
    Until R6 custom-request flow is awarded in production, this path
    raises clearly rather than silently dropping the line.
    """
    from decimal import Decimal

    rfq = quote.rfq
    line_total = sum(
        (qi.total_price for qi in quote_items), start=Decimal("0"),
    )
    contract = Contract.objects.create(
        rfq=rfq, quote=quote,
        client_org=rfq.client_org,
        supplier_org=quote.supplier_org,
        total=line_total,
        delivery_location=rfq.delivery_location,
        required_by=rfq.required_by,
        notes=rfq.notes,
        created_by=by,
    )
    for qi in sorted(quote_items, key=lambda q: q.rfq_item.line_no):
        ri = qi.rfq_item
        if ri.master_product_id is None:
            # Custom-request line — not supported by ContractItem schema yet.
            raise ContractError(
                "Custom-request lines cannot be awarded until ContractItem "
                "supports nullable master_product (R8 task)."
            )
        ContractItem.objects.create(
            contract=contract,
            line_no=ri.line_no,
            master_product=ri.master_product,
            pack_type_code=ri.pack_type_code,
            quantity=ri.quantity,
            unit_price=qi.unit_price,
            total_price=qi.total_price,
        )
    record_event(
        action="contract.create", target=contract, actor=by,
        organization=contract.client_org,
        payload={
            "total": str(contract.total),
            "line_count": len(quote_items),
            "is_partial": len(quote_items) < quote.items.count(),
        },
    )
    return contract


def _maybe_issue_order(contract: Contract, *, by):
    """If both parties have signed, transition to ORDER_ISSUED and create an
    Order. Returns the new Order or None."""
    if contract.client_signed_at is None or contract.supplier_signed_at is None:
        return None
    contract.status = Contract.Status.ORDER_ISSUED
    contract.save(update_fields=["status", "updated_at"])
    from apps.orders.services import create_order_from_contract
    return create_order_from_contract(contract=contract, by=by)


@transaction.atomic
def sign_as_client(contract: Contract, *, by) -> Contract:
    if contract.status != Contract.Status.PENDING_SIGNATURES:
        raise ContractError(f"Cannot sign a {contract.status} contract")
    if contract.client_signed_at is not None:
        raise ContractError("Already signed by client")
    contract.client_signed_at = timezone.now()
    contract.client_signed_by = by
    if contract.supplier_signed_at is not None:
        contract.status = Contract.Status.SIGNED
    contract.save(update_fields=[
        "client_signed_at", "client_signed_by", "status", "updated_at",
    ])
    record_event(action="contract.sign_client", target=contract, actor=by,
                 organization=contract.client_org)
    from apps.notifications.services import notify_org
    notify_org(
        organization=contract.supplier_org,
        kind="contract.client_signed",
        title=f"Contract #{contract.id} signed by client — your signature next",
        payload={"target": f"contract:{contract.id}"},
    )
    _maybe_issue_order(contract, by=by)
    contract.refresh_from_db()
    return contract


@transaction.atomic
def sign_as_supplier(contract: Contract, *, by) -> Contract:
    if contract.status != Contract.Status.PENDING_SIGNATURES:
        raise ContractError(f"Cannot sign a {contract.status} contract")
    if contract.supplier_signed_at is not None:
        raise ContractError("Already signed by supplier")
    contract.supplier_signed_at = timezone.now()
    contract.supplier_signed_by = by
    if contract.client_signed_at is not None:
        contract.status = Contract.Status.SIGNED
    contract.save(update_fields=[
        "supplier_signed_at", "supplier_signed_by", "status", "updated_at",
    ])
    record_event(action="contract.sign_supplier", target=contract, actor=by,
                 organization=contract.supplier_org)
    from apps.notifications.services import notify_org
    notify_org(
        organization=contract.client_org,
        kind="contract.supplier_signed",
        title=f"Contract #{contract.id} signed by supplier",
        payload={"target": f"contract:{contract.id}"},
    )
    _maybe_issue_order(contract, by=by)
    contract.refresh_from_db()
    return contract

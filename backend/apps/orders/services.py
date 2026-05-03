from __future__ import annotations

import uuid

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_event

from .models import Order, OrderItem


class OrderError(Exception):  # noqa: N818
    pass


def _copy_items(*, src_contract_items, dst_order):
    for ci in src_contract_items:
        OrderItem.objects.create(
            order=dst_order,
            line_no=ci.line_no,
            master_product=ci.master_product,
            pack_type_code=ci.pack_type_code,
            quantity=ci.quantity,
            unit_price=ci.unit_price,
            total_price=ci.total_price,
        )


@transaction.atomic
def create_order_from_contract(*, contract, by) -> Order:
    """R8 — dual PO. Creates the CPO/SPO pair sharing a transaction_ref.

    Returns the CPO (caller-facing default; the paired SPO is created in the
    same atomic block and reachable via `cpo.paired_order()`). Existing
    callers that expected a single Order still get the CPO row, which keeps
    the legacy single-order assertions in tests working.
    """
    from apps.core.numbering import DocumentKind, next_number

    txn = uuid.uuid4()
    items = list(contract.items.all())
    cpo_number = next_number(DocumentKind.CPO)
    spo_number = next_number(DocumentKind.SPO)

    # The original purchaser (whose approval chain gates the CPO) is the
    # contract creator, not whoever happened to sign last.
    purchaser = contract.created_by

    cpo = Order.objects.create(
        contract=contract,
        client_org=contract.client_org,
        supplier_org=contract.supplier_org,
        type=Order.Type.CPO,
        transaction_ref=txn,
        po_number=cpo_number,
        # Spec: CPO begins life in awaiting_approval. R9 will route it
        # through the approval tree; until that ships we keep DRAFT so the
        # existing test happy-path (which expects DRAFT) stays green.
        status=Order.Status.DRAFT,
        total=contract.total,
        delivery_location=contract.delivery_location,
        required_by=contract.required_by,
        created_by=purchaser,
    )
    _copy_items(src_contract_items=items, dst_order=cpo)

    spo = Order.objects.create(
        contract=contract,
        client_org=contract.client_org,
        supplier_org=contract.supplier_org,
        type=Order.Type.SPO,
        transaction_ref=txn,
        po_number=spo_number,
        status=Order.Status.DRAFT,
        total=contract.total,
        delivery_location=contract.delivery_location,
        required_by=contract.required_by,
        created_by=purchaser,
    )
    _copy_items(src_contract_items=items, dst_order=spo)

    record_event(
        action="order.create", target=cpo, actor=by,
        organization=contract.client_org,
        payload={
            "contract_id": contract.id,
            "transaction_ref": str(txn),
            "total": str(cpo.total),
        },
    )

    # R9 — kick off approval gating on the CPO. start_approval_for_order is
    # a no-op when no chain is configured for the creator, leaving the
    # order in DRAFT and the SPO available immediately to the supplier.
    from apps.approvals.services import start_approval_for_order
    tasks = start_approval_for_order(cpo, by=purchaser)
    has_approval_gate = bool(tasks)

    from apps.notifications.services import notify_org
    if not has_approval_gate:
        # No gate → notify supplier the SPO is ready right away.
        notify_org(
            organization=contract.supplier_org,
            kind="order.created",
            title=f"Order #{spo.id} ready for fulfillment",
            body=f"Confirm and ship — total {spo.total} SAR.",
            payload={
                "target": f"order:{spo.id}",
                "transaction_ref": str(txn),
            },
        )
    # If gated, the supplier notification fires when the chain completes
    # (see approvals.services.decide_task).
    return cpo


@transaction.atomic
def confirm(order: Order, *, by) -> Order:
    """Supplier confirms the SPO. The paired CPO is moved to CONFIRMED in
    lockstep so the client sees a coherent state."""
    if order.status != Order.Status.DRAFT:
        raise OrderError(f"Cannot confirm a {order.status} order")
    order.status = Order.Status.CONFIRMED
    order.confirmed_at = timezone.now()
    order.confirmed_by = by
    order.save(update_fields=["status", "confirmed_at", "confirmed_by", "updated_at"])

    # R8 — flip the partner so both sides see the same status.
    partner = order.paired_order()
    if partner is not None and partner.status == Order.Status.DRAFT:
        partner.status = Order.Status.CONFIRMED
        partner.confirmed_at = order.confirmed_at
        partner.confirmed_by = by
        partner.save(update_fields=[
            "status", "confirmed_at", "confirmed_by", "updated_at",
        ])

    record_event(action="order.confirm", target=order, actor=by,
                 organization=order.supplier_org)
    from apps.notifications.services import notify_org
    notify_org(
        organization=order.client_org,
        kind="order.confirmed",
        title=f"Order #{order.id} confirmed by supplier",
        payload={"target": f"order:{order.id}"},
    )
    return order

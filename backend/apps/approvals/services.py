"""R9 — Approval Tree services.

Public surface:
- `set_direct_approver(member, approver, organization)`: configure a node,
  with cycle detection.
- `approval_chain_for(member, organization)`: walk `direct_approver` up
  from `member` and return the user-id sequence (excluding `member`).
- `start_approval_for_order(order, by)`: kicks the CPO into AWAITING_APPROVAL
  and creates the chain of ApprovalTasks. No-op if the creator has no
  approval node — that's the "no approval gate" fallthrough.
- `decide_task(task, *, status, by, note='')`: approver action. Approving
  the last task moves the CPO + paired SPO into CONFIRMED.
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_event

from .models import ApprovalNode, ApprovalTask


class ApprovalError(Exception):  # noqa: N818
    pass


# ---------- Tree configuration ----------


def _walk_upward(*, organization, start_user_id: int, max_depth: int = 50) -> list[int]:
    """Walk up the approval chain from start_user_id, returning the list of
    *approver* user_ids encountered (does not include start_user_id).

    `max_depth` is a defensive cap; if hit, we treat it as a cycle.
    """
    chain: list[int] = []
    seen = {start_user_id}
    cursor = start_user_id
    for _ in range(max_depth):
        node = ApprovalNode.objects.filter(
            organization=organization, member_id=cursor,
        ).only("direct_approver_id").first()
        if node is None or node.direct_approver_id is None:
            return chain
        nxt = node.direct_approver_id
        if nxt in seen:
            raise ApprovalError("Cycle detected in approval chain")
        chain.append(nxt)
        seen.add(nxt)
        cursor = nxt
    raise ApprovalError("Approval chain exceeded max depth")


def approval_chain_for(*, organization, member) -> list[int]:
    """Returns the ordered list of approver user_ids for `member`.
    Empty if no approval gate is configured for this user.
    """
    return _walk_upward(organization=organization, start_user_id=member.id)


@transaction.atomic
def set_direct_approver(*, organization, member, approver) -> ApprovalNode:
    """Idempotent upsert of an ApprovalNode. Rejects cycles.

    Spec: A approves B who eventually approves A is forbidden. We check by
    walking upward from the proposed approver — if `member` appears, the
    new edge would close a loop.
    """
    if approver is not None and approver.id == member.id:
        raise ApprovalError("A user cannot be their own approver")

    if approver is not None:
        # Walk upward from the proposed approver. If `member` shows up, this
        # edge would create a cycle.
        existing = _walk_upward(
            organization=organization, start_user_id=approver.id,
        )
        if member.id in existing or approver.id == member.id:
            raise ApprovalError(
                "Cycle detected: assigning this approver would close a loop",
            )

    node, _ = ApprovalNode.objects.update_or_create(
        organization=organization, member=member,
        defaults={"direct_approver": approver},
    )
    record_event(
        action="approval.node.set", target=node,
        organization=organization,
        payload={"member_id": member.id, "approver_id": approver.id if approver else None},
    )
    return node


# ---------- Per-order workflow ----------


@transaction.atomic
def start_approval_for_order(order, *, by) -> list[ApprovalTask]:
    """If the order's creator has an approval chain, create ApprovalTasks
    and move the CPO to AWAITING_APPROVAL. Returns the list of tasks.

    No-op (returns []) if there's no chain configured. Caller decides what
    that means (we leave the order in DRAFT; the legacy fulfillment flow
    can then proceed without approval gating).
    """
    from apps.orders.models import Order

    if order.type != Order.Type.CPO:
        raise ApprovalError("Approval gating is only applied to CPO orders")
    if order.status != Order.Status.DRAFT:
        raise ApprovalError(f"Cannot start approval for {order.status} order")

    chain = approval_chain_for(
        organization=order.client_org, member=order.created_by,
    )
    if not chain:
        return []

    order.status = Order.Status.AWAITING_APPROVAL
    order.save(update_fields=["status", "updated_at"])

    tasks = []
    for i, approver_id in enumerate(chain):
        t = ApprovalTask.objects.create(
            order=order, approver_id=approver_id,
            order_in_chain=i + 1,
            status=ApprovalTask.Status.PENDING,
        )
        tasks.append(t)

    record_event(
        action="approval.start", target=order, actor=by,
        organization=order.client_org,
        payload={"chain": chain, "task_count": len(tasks)},
    )

    from apps.notifications.services import notify_user
    notify_user(
        user_id=tasks[0].approver_id,
        kind="approval.task_assigned",
        title=f"Approval needed for order #{order.id}",
        body=f"Total {order.total} SAR. Review and approve.",
        payload={"target": f"order:{order.id}", "task_id": tasks[0].id},
    )
    return tasks


def _next_pending_task(order) -> ApprovalTask | None:
    return (
        ApprovalTask.objects.filter(
            order=order, status=ApprovalTask.Status.PENDING,
        )
        .order_by("order_in_chain")
        .first()
    )


@transaction.atomic
def decide_task(task: ApprovalTask, *, status: str, by, note: str = "") -> ApprovalTask:
    """Approver action. `status` must be APPROVED or REJECTED."""
    from apps.orders.models import Order

    if status not in (ApprovalTask.Status.APPROVED, ApprovalTask.Status.REJECTED):
        raise ApprovalError(f"Invalid decision status {status}")
    if task.status != ApprovalTask.Status.PENDING:
        raise ApprovalError(f"Task already {task.status}")
    if task.approver_id != by.id:
        raise ApprovalError("Only the assigned approver can decide this task")

    # The active task must be the lowest-ordered pending task.
    active = _next_pending_task(task.order)
    if active is None or active.id != task.id:
        raise ApprovalError("Earlier tasks in the chain are still pending")

    task.status = status
    task.note = note
    task.decided_at = timezone.now()
    task.save(update_fields=["status", "note", "decided_at", "updated_at"])

    cpo = task.order

    if status == ApprovalTask.Status.REJECTED:
        # Cancel the CPO and SPO; mark remaining tasks SKIPPED.
        ApprovalTask.objects.filter(
            order=cpo, status=ApprovalTask.Status.PENDING,
        ).update(status=ApprovalTask.Status.SKIPPED)
        cpo.status = Order.Status.CANCELLED
        cpo.cancelled_at = timezone.now()
        cpo.save(update_fields=["status", "cancelled_at", "updated_at"])
        partner = cpo.paired_order()
        if partner is not None:
            partner.status = Order.Status.CANCELLED
            partner.cancelled_at = cpo.cancelled_at
            partner.save(update_fields=["status", "cancelled_at", "updated_at"])
        record_event(
            action="approval.reject", target=cpo, actor=by,
            organization=cpo.client_org, payload={"task_id": task.id, "note": note},
        )
        return task

    # Approved — open next task or finalise.
    nxt = _next_pending_task(cpo)
    if nxt is not None:
        from apps.notifications.services import notify_user
        notify_user(
            user_id=nxt.approver_id,
            kind="approval.task_assigned",
            title=f"Approval needed for order #{cpo.id}",
            payload={"target": f"order:{cpo.id}", "task_id": nxt.id},
        )
        return task

    # All tasks approved → CPO + SPO go to CONFIRMED. Spec: "Final approver
    # approves → CPO 'confirmed', SPO sent to supplier."
    cpo.status = Order.Status.CONFIRMED
    cpo.confirmed_at = timezone.now()
    cpo.confirmed_by = by
    cpo.save(update_fields=["status", "confirmed_at", "confirmed_by", "updated_at"])
    partner = cpo.paired_order()
    if partner is not None and partner.status == Order.Status.DRAFT:
        partner.status = Order.Status.CONFIRMED
        partner.confirmed_at = cpo.confirmed_at
        partner.confirmed_by = by
        partner.save(update_fields=["status", "confirmed_at", "confirmed_by", "updated_at"])
        from apps.notifications.services import notify_org
        notify_org(
            organization=cpo.supplier_org,
            kind="order.created",
            title=f"Order #{partner.id} ready for fulfillment",
            payload={"target": f"order:{partner.id}"},
        )

    record_event(
        action="approval.complete", target=cpo, actor=by,
        organization=cpo.client_org, payload={"task_id": task.id},
    )
    return task

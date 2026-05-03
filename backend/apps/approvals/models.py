"""R9 — Approval Tree.

Spec § approval flow (every CPO must clear the chain before it 'confirms'):

1. CPO `status='awaiting_approval'`.
2. Compute the chain by walking `ApprovalNode.direct_approver` upward from
   the order creator until you hit a node with `direct_approver=NULL`.
3. Create one `ApprovalTask` for each link in the chain, ordered. Open the
   first one (`status=pending`); the rest stay queued.
4. Approver decides: approve → next task opens. Reject → CPO cancelled.
5. Final approve → CPO `status='confirmed'`, paired SPO sent to supplier.

Cycle detection: `set_direct_approver(member, approver)` walks upward from
`approver` and refuses if `member` appears anywhere in the chain.

This is opt-in per company: a member with no `ApprovalNode` row falls
through to the legacy "no approval needed" code path so existing flows
keep working until ops configures the tree.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models


class ApprovalNode(models.Model):
    """One row per (company, member). The member's `direct_approver` (also a
    user) is who must approve their orders. NULL = top of chain.
    """
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE,
        related_name="approval_nodes",
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="approval_membership",
    )
    direct_approver = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="approves_for", null=True, blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "member"],
                name="uniq_approval_node_per_org_member",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "member"]),
            models.Index(fields=["direct_approver"]),
        ]

    def __str__(self) -> str:
        return f"AN<org={self.organization_id} m={self.member_id} → {self.direct_approver_id}>"


class ApprovalTask(models.Model):
    """One per link in the chain for a given CPO. Created in order_in_chain
    order; only the lowest pending one is "active" — the rest wait until
    the previous one is approved.
    """
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        SKIPPED = "SKIPPED", "Skipped"  # e.g. parent rejected

    # Targets the CPO half of the dual PO pair.
    order = models.ForeignKey(
        "orders.Order", on_delete=models.CASCADE, related_name="approval_tasks",
    )
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="approval_tasks",
    )
    order_in_chain = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True,
    )
    note = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["order", "order_in_chain"],
                name="uniq_approval_task_per_order_chain",
            ),
        ]
        indexes = [
            models.Index(fields=["order", "status"]),
            models.Index(fields=["approver", "status"]),
        ]

    def __str__(self) -> str:
        return (
            f"AT<order={self.order_id} #{self.order_in_chain} "
            f"{self.approver_id} [{self.status}]>"
        )

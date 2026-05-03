"""notify() — fan-out helper. Writes an in-app Notification for every user
the caller specifies, and optionally queues an email."""
from __future__ import annotations

from collections.abc import Iterable

from .models import Notification


def notify(
    *,
    users: Iterable,
    kind: str,
    title: str,
    body: str = "",
    organization=None,
    payload: dict | None = None,
) -> list[Notification]:
    out: list[Notification] = []
    for user in users:
        n = Notification.objects.create(
            user=user,
            organization=organization,
            kind=kind,
            title=title,
            body=body,
            payload=payload or {},
        )
        out.append(n)
    return out


def notify_user(
    *, user_id: int, kind: str, title: str, body: str = "",
    payload: dict | None = None,
):
    """Notify a single user by id. Used by R9 approval-task assignments."""
    from apps.accounts.models import User

    user = User.objects.filter(id=user_id).first()
    if user is None:
        return []
    return notify(
        users=[user], kind=kind, title=title, body=body,
        organization=None, payload=payload,
    )


def notify_org(*, organization, kind: str, title: str, body: str = "", payload: dict | None = None):
    """Notify every active member of an org."""
    from apps.organizations.models import Membership

    user_ids = list(
        Membership.objects.filter(
            organization=organization, status=Membership.Status.ACTIVE,
        ).values_list("user_id", flat=True)
    )
    from apps.accounts.models import User
    users = User.objects.filter(id__in=user_ids)
    return notify(
        users=users, kind=kind, title=title, body=body,
        organization=organization, payload=payload,
    )

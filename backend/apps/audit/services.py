"""Audit log service. The single entrypoint domain code uses to write events."""
from __future__ import annotations

import logging
from typing import Any

from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.core.context import current_request_id, current_user_id

from .models import AuditLog

logger = logging.getLogger("apps.audit")


def record_event(
    *,
    action: str,
    target: models.Model | None = None,
    actor=None,
    organization=None,
    payload: dict[str, Any] | None = None,
) -> AuditLog:
    """Insert a new AuditLog row.

    `actor` and `organization` default to the current request context if not
    given — so domain services can call `record_event(action=..., target=...)`
    without plumbing actor/org through.
    """
    actor_id = None
    if actor is not None:
        actor_id = getattr(actor, "id", None)
    elif (cuid := current_user_id.get()) is not None:
        actor_id = cuid

    target_ct = ContentType.objects.get_for_model(target) if target is not None else None
    target_id = getattr(target, "id", None) if target is not None else None

    log = AuditLog.objects.create(
        actor_id=actor_id,
        organization=organization,
        action=action,
        target_ct=target_ct,
        target_id=target_id,
        payload=payload or {},
        request_id=current_request_id.get() or "",
    )
    logger.info(
        "audit.recorded",
        extra={
            "event": "audit.recorded",
            "action": action,
            "target_id": target_id,
            "audit_id": log.id,
        },
    )
    return log

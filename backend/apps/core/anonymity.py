"""Anonymity helpers.

Spec rule (NEVER violate): a customer-facing API response must NEVER expose
the real `name` or `legal_name` of an organization that the viewer's org is
NOT party to. Only `platform_alias` may cross that boundary. Backoffice
(staff scope) is the single exception — staff sees real names.

Three layers of defense:

1. **`anonymized_org_name(viewer_org_id, viewer_scope, target_org)`** —
   the per-row helper. Returns `target_org.name` when the viewer is staff
   or the viewer's own org; else returns `target_org.platform_alias`.

2. **`AnonymizedOrgNameField`** — a DRF serializer field that calls (1)
   automatically using the request context.

3. **`assert_no_realname_leak(response_body, real_names)`** — a test helper
   that grep-asserts that none of a list of forbidden real names appear in
   the response. Used in integration tests to lock the rule structurally.
"""
from __future__ import annotations

from typing import Any

from rest_framework import serializers


def anonymized_org_name(
    *, viewer_org_id: int | None, viewer_scope: str | None, target_org,
) -> str:
    """Return the right thing to show the viewer for `target_org`.

    Staff: real name. Same-org viewer: real name. Cross-org viewer: alias.
    Falls back to alias if (somehow) the alias was never allocated.
    """
    if target_org is None:
        return ""
    if viewer_scope == "staff":
        return target_org.name
    if viewer_org_id is not None and viewer_org_id == target_org.id:
        return target_org.name
    return target_org.platform_alias or f"Org-{target_org.id}"


class AnonymizedOrgNameField(serializers.Field):
    """Serializer field for an `Organization` FK.

    Reads the request from the serializer context and returns either the
    real name (staff or same-org) or the platform_alias (cross-org).

    Usage:
        class QuoteSerializer(serializers.ModelSerializer):
            supplier_name = AnonymizedOrgNameField(source="supplier_org")
            ...
    """
    def to_representation(self, value) -> str:
        # Read viewer context from the request-scoped ContextVars set by
        # `apps.core.middleware.AnonymityContextMiddleware` (which runs as a
        # DRF auth-class side effect, AFTER request.user is populated). This
        # avoids per-view `context={"request": request}` plumbing.
        from .context import current_org_id, current_scope
        return anonymized_org_name(
            viewer_org_id=current_org_id.get(),
            viewer_scope=current_scope.get(),
            target_org=value,
        )

    def to_internal_value(self, data: Any) -> Any:
        # Read-only field; ignore writes.
        raise NotImplementedError("AnonymizedOrgNameField is read-only")


def assert_no_realname_leak(payload: Any, forbidden: list[str]) -> None:
    """Test helper. Recursively walks `payload` (dict / list / str / etc.)
    and raises if any `forbidden` string appears verbatim. Use in
    integration tests:

        body = api_client.get("/api/...").json()
        assert_no_realname_leak(body, [client_org.name, supplier_org.name])
    """
    import json as _json
    blob = _json.dumps(payload, default=str)
    for needle in forbidden:
        if needle and needle in blob:
            raise AssertionError(
                f"Anonymity leak: '{needle}' appeared in payload"
            )

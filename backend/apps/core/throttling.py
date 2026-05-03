"""Per-organization rate limits.

DRF's `UserRateThrottle` keys per user; we want per-org instead so a single
abusive org can't burn through quota using many seats. Subclass per use case
and set `scope` (rate is read from `DEFAULT_THROTTLE_RATES`).

Falls back to per-user when no org context is set (e.g. an unauth or
staff request). Anonymous requests fall through to `AnonRateThrottle`.
"""
from rest_framework.throttling import SimpleRateThrottle


class OrgRateThrottle(SimpleRateThrottle):
    """Keys on (active_organization_id) when present, else (user_id)."""
    scope = "org"

    def get_cache_key(self, request, view):
        org_id = getattr(request, "active_organization_id", None)
        if org_id is not None:
            ident = f"org:{org_id}"
        elif request.user and request.user.is_authenticated:
            ident = f"user:{request.user.pk}"
        else:
            return None  # let AnonRateThrottle handle it
        return self.cache_format % {"scope": self.scope, "ident": ident}


class WriteOrgRateThrottle(OrgRateThrottle):
    """Tighter cap for write endpoints. Configure
    `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['org-write'] = '120/min'`.
    """
    scope = "org-write"

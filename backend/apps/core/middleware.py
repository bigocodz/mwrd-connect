import uuid

from .context import (
    current_org_id,
    current_request_id,
    current_scope,
    current_user_id,
)


class CurrentOrgMiddleware:
    """Sets the active organization + scope on the request-scoped context.

    Reads `request.active_organization_id` and `request.token_scope` set by
    JWTCookieAuthentication from the token claim. The anonymity layer reads
    these via ContextVars so serializers don't need explicit context=.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        org_id = None
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False) and not user.is_staff:
            org_id = getattr(request, "active_organization_id", None)
        scope = getattr(request, "token_scope", None)

        token_org = current_org_id.set(org_id)
        token_user = current_user_id.set(
            user.id if user and getattr(user, "is_authenticated", False) else None
        )
        token_scope = current_scope.set(scope)
        try:
            return self.get_response(request)
        finally:
            current_org_id.reset(token_org)
            current_user_id.reset(token_user)
            current_scope.reset(token_scope)


class AuditContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        rid = request.headers.get("X-Request-Id") or uuid.uuid4().hex
        token = current_request_id.set(rid)
        try:
            response = self.get_response(request)
            response["X-Request-Id"] = rid
            return response
        finally:
            current_request_id.reset(token)

from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication


class JWTCookieAuthentication(JWTAuthentication):
    """Reads JWT from httpOnly cookie; falls back to Authorization header.

    Sets `request.active_organization_id`, `active_membership_role`, and
    `token_scope` from token claims so middleware and permissions can read
    them without re-decoding.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            raw = request.COOKIES.get(settings.JWT_COOKIE_NAME)
            if raw is None:
                return None
            validated = self.get_validated_token(raw)
        else:
            raw = self.get_raw_token(header)
            if raw is None:
                return None
            validated = self.get_validated_token(raw)

        user = self.get_user(validated)

        request.active_organization_id = validated.get("org_id")
        request.active_membership_role = validated.get("role")
        request.token_scope = validated.get("scope", "customer")

        # Populate ContextVars now (auth runs AFTER CurrentOrgMiddleware, so
        # the middleware's pre-auth values are stale). The anonymity layer
        # and structured logger both read these.
        from apps.core.context import current_org_id, current_scope, current_user_id
        current_org_id.set(request.active_organization_id)
        current_user_id.set(user.id if user else None)
        current_scope.set(request.token_scope)

        return user, validated

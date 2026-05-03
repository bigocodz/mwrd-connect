"""drf-spectacular extensions so JWTCookieAuthentication appears in the OpenAPI
spec correctly. Imported eagerly via apps.accounts.apps.ready()."""
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class JWTCookieAuthExtension(OpenApiAuthenticationExtension):
    target_class = "apps.accounts.authentication.JWTCookieAuthentication"
    name = "JWTCookieAuth"

    def get_security_definition(self, auto_schema):  # noqa: ARG002
        from django.conf import settings

        return {
            "type": "apiKey",
            "in": "cookie",
            "name": settings.JWT_COOKIE_NAME,
            "description": (
                "HttpOnly cookie set by /api/auth/login. "
                "Falls back to Authorization: Bearer header for tooling."
            ),
        }

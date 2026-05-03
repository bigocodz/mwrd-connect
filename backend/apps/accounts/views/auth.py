import logging

from django.conf import settings
from django.contrib.auth import authenticate
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.organizations.models import Membership

from ..serializers import (
    ErrorSerializer,
    LoginResponseSerializer,
    LoginSerializer,
    MeResponseSerializer,
    OrganizationBriefSerializer,
    UserSerializer,
)

logger = logging.getLogger("apps.accounts.auth")


def _set_jwt_cookies(response, refresh) -> None:
    access = refresh.access_token
    response.set_cookie(
        settings.JWT_COOKIE_NAME,
        str(access),
        domain=settings.JWT_COOKIE_DOMAIN,
        secure=settings.JWT_COOKIE_SECURE,
        httponly=True,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=int(access["exp"] - access["iat"]),
    )
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        str(refresh),
        domain=settings.JWT_COOKIE_DOMAIN,
        secure=settings.JWT_COOKIE_SECURE,
        httponly=True,
        samesite=settings.JWT_COOKIE_SAMESITE,
        path="/api/auth/",
        max_age=int(refresh["exp"] - refresh["iat"]),
    )


def _clear_jwt_cookies(response) -> None:
    response.delete_cookie(settings.JWT_COOKIE_NAME, domain=settings.JWT_COOKIE_DOMAIN)
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        domain=settings.JWT_COOKIE_DOMAIN,
        path="/api/auth/",
    )


class CustomerLoginView(APIView):
    """Login for client and supplier portals. Rejects MWRD staff users."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(
        request=LoginSerializer,
        responses={
            200: LoginResponseSerializer,
            401: OpenApiResponse(response=ErrorSerializer),
            403: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["auth"],
    )
    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"].lower()
        user = authenticate(
            request, email=email, password=ser.validated_data["password"]
        )
        if user is None or user.is_staff:
            logger.info("login.fail", extra={"event": "login.fail", "email": email})
            return Response({"detail": "Invalid credentials"}, status=401)

        membership = (
            Membership.objects.filter(user=user, status=Membership.Status.ACTIVE)
            .select_related("organization")
            .first()
        )
        if membership is None:
            logger.info("login.no_org", extra={"event": "login.no_org", "user_id": user.id})
            return Response({"detail": "No active organization"}, status=403)

        refresh = RefreshToken.for_user(user)
        refresh["org_id"] = membership.organization_id
        refresh["role"] = membership.role
        refresh["scope"] = "customer"

        logger.info(
            "login.ok",
            extra={
                "event": "login.ok",
                "user_id": user.id,
                "org_id": membership.organization_id,
                "role": membership.role,
                "scope": "customer",
            },
        )

        resp = Response(
            {
                "user": UserSerializer(user).data,
                "organization": OrganizationBriefSerializer(membership.organization).data,
                "role": membership.role,
            }
        )
        _set_jwt_cookies(resp, refresh)
        return resp


class RefreshView(APIView):
    """Rotates the refresh cookie and issues a new access cookie.

    Reads the refresh token from cookie only — never accepts it in the body
    or headers, since httpOnly is the whole point.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        request=None,
        responses={
            200: OpenApiResponse(response=None, description="Cookies refreshed"),
            401: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["auth"],
    )
    def post(self, request):
        from ..models import User

        raw = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if not raw:
            return Response({"detail": "No refresh cookie"}, status=401)
        try:
            refresh = RefreshToken(raw)
            user = User.objects.get(id=refresh["user_id"])
            new_refresh = RefreshToken.for_user(user)
            for claim in ("org_id", "role", "scope"):
                if claim in refresh:
                    new_refresh[claim] = refresh[claim]
        except (InvalidToken, TokenError, User.DoesNotExist):
            resp = Response({"detail": "Invalid refresh"}, status=401)
            _clear_jwt_cookies(resp)
            return resp

        resp = Response({"ok": True})
        _set_jwt_cookies(resp, new_refresh)
        return resp


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={204: OpenApiResponse(description="Cookies cleared")},
        tags=["auth"],
    )
    def post(self, request):
        logger.info("logout", extra={"event": "logout", "user_id": request.user.id})
        resp = Response(status=204)
        _clear_jwt_cookies(resp)
        return resp


class MeView(APIView):
    @extend_schema(
        responses={200: MeResponseSerializer, 401: OpenApiResponse(response=ErrorSerializer)},
        tags=["auth"],
    )
    def get(self, request):
        org_id = getattr(request, "active_organization_id", None)
        organization = None
        if org_id is not None:
            from apps.organizations.models import Organization

            organization = (
                Organization.objects.filter(id=org_id).first()
            )
        return Response(
            {
                "user": UserSerializer(request.user).data,
                "organization": (
                    OrganizationBriefSerializer(organization).data if organization else None
                ),
                "role": getattr(request, "active_membership_role", None),
                "scope": getattr(request, "token_scope", "customer"),
            }
        )

import logging

from django.db import transaction
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.organizations import services as org_services
from apps.organizations.models import Invite

from ..models import User
from ..serializers import (
    ErrorSerializer,
    LoginResponseSerializer,
    OrganizationBriefSerializer,
    SignupFromInviteSerializer,
    UserSerializer,
)
from .auth import _set_jwt_cookies

logger = logging.getLogger("apps.accounts.signup")


class SignupFromInviteView(APIView):
    """Creates a User and accepts the invite in one step.

    Invitee flow: user clicks the invite link in their email →
    frontend calls /orgs/invites/preview to render org name → user fills
    full_name + password → frontend POSTs here. On success the user is
    logged in (cookies set) and the membership is active.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(
        request=SignupFromInviteSerializer,
        responses={
            201: LoginResponseSerializer,
            400: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["auth"],
    )
    def post(self, request):
        ser = SignupFromInviteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        token = ser.validated_data["token"]

        # Look up invite first to know the email — we don't trust client input here.
        invite = (
            Invite.objects.filter(
                token_hash=org_services.hash_token(token),
                status=Invite.Status.PENDING,
            )
            .select_related("organization")
            .first()
        )
        if invite is None or invite.is_expired:
            return Response({"detail": "Invalid or expired invite"}, status=400)

        with transaction.atomic():
            user, created = User.objects.get_or_create(
                email=invite.email.lower(),
                defaults={"full_name": ser.validated_data["full_name"]},
            )
            if created:
                user.set_password(ser.validated_data["password"])
                user.save(update_fields=["password"])
            elif not user.check_password(ser.validated_data["password"]):
                # Existing account with a different password — return the same
                # generic message as a bad-token, so the response doesn't
                # confirm whether the invite email is already a registered
                # account (account-existence enumeration). The legitimate
                # path is: log in via /api/auth/login first, then accept
                # the invite via /api/orgs/invites/accept.
                return Response(
                    {"detail": "Invalid or expired invite"}, status=400,
                )

            membership = org_services.accept_invite(raw_token=token, user=user)

        logger.info(
            "signup.accept_invite",
            extra={
                "event": "signup.accept_invite",
                "user_id": user.id,
                "org_id": membership.organization_id,
                "kind": invite.kind,
            },
        )

        refresh = RefreshToken.for_user(user)
        refresh["org_id"] = membership.organization_id
        refresh["role"] = membership.role
        refresh["scope"] = "customer"

        resp = Response(
            {
                "user": UserSerializer(user).data,
                "organization": OrganizationBriefSerializer(invite.organization).data,
                "role": membership.role,
            },
            status=201,
        )
        _set_jwt_cookies(resp, refresh)
        return resp

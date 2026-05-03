"""Public R2 endpoints — register / activate / onboarding.

These are the SHARED public-auth surface (mounted on both client.mwrd.io and
supplier.mwrd.io). Spec rule: backoffice users are NEVER created here.
"""
from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.organizations import services as org_services
from apps.organizations.models import Lead, Organization

from ..serializers import (
    ErrorSerializer,
    LoginResponseSerializer,
    OrganizationBriefSerializer,
    UserSerializer,
)
from .auth import _set_jwt_cookies


class RegisterRequestSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=32)
    account_type = serializers.ChoiceField(choices=Organization.Type.choices)
    company_name = serializers.CharField(max_length=255)
    signup_intent = serializers.CharField(max_length=2000, allow_blank=True, default="")
    expected_monthly_volume_sar = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True,
    )


class RegisterResponseSerializer(serializers.Serializer):
    lead_id = serializers.IntegerField()
    status = serializers.CharField()
    message = serializers.CharField()


class ActivateRequestSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(min_length=12, max_length=200, write_only=True)


class OnboardingRequestSerializer(serializers.Serializer):
    cr_number = serializers.CharField(max_length=64, allow_blank=True, default="")
    vat_number = serializers.CharField(max_length=64, allow_blank=True, default="")
    legal_name = serializers.CharField(max_length=255, allow_blank=True, default="")
    legal_name_ar = serializers.CharField(max_length=255, allow_blank=True, default="")


class RegisterView(APIView):
    """Public form on `/register`. Creates a Lead, NO password set yet.
    Spec: 'we'll call you within 24 hours'."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"  # share scope; same brute-force shape

    @extend_schema(
        request=RegisterRequestSerializer,
        responses={201: RegisterResponseSerializer},
        tags=["public-auth"],
    )
    def post(self, request):
        ser = RegisterRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        lead = org_services.register_lead(**ser.validated_data)
        return Response(
            {
                "lead_id": lead.id,
                "status": lead.status,
                "message": (
                    "Thanks. We'll call you on the number you provided within 24 hours "
                    "to verify your details. Once verified, you'll receive an activation "
                    "email to set your password."
                ),
            },
            status=201,
        )


class ActivateView(APIView):
    """Public — token-gated. Creates User+Org+Membership and signs the user in."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(
        request=ActivateRequestSerializer,
        responses={
            201: LoginResponseSerializer,
            400: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["public-auth"],
    )
    def post(self, request):
        ser = ActivateRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            user, org, membership = org_services.activate_lead(
                raw_token=ser.validated_data["token"],
                password=ser.validated_data["password"],
            )
        except (Lead.DoesNotExist, ValueError):
            return Response(
                {"detail": "Invalid or expired activation token"}, status=400,
            )

        refresh = RefreshToken.for_user(user)
        refresh["org_id"] = org.id
        refresh["role"] = membership.role
        refresh["scope"] = "customer"

        resp = Response(
            {
                "user": UserSerializer(user).data,
                "organization": OrganizationBriefSerializer(org).data,
                "role": membership.role,
            },
            status=201,
        )
        _set_jwt_cookies(resp, refresh)
        return resp


class OnboardingView(APIView):
    """First-login wizard sink — adds CR/VAT/legal names, marks
    `onboarding_completed`. Idempotent."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=OnboardingRequestSerializer,
        responses={200: OrganizationBriefSerializer},
        tags=["public-auth"],
    )
    def patch(self, request):
        org = Organization.objects.get(id=request.active_organization_id)
        ser = OnboardingRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        org_services.complete_onboarding(organization=org, **ser.validated_data)
        return Response(OrganizationBriefSerializer(org).data)

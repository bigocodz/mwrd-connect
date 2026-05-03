import logging

from django.contrib.auth import authenticate
from django_otp.plugins.otp_totp.models import TOTPDevice
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from ..serializers import (
    ErrorSerializer,
    StaffEnrollConfirmSerializer,
    StaffEnrollStartResponseSerializer,
    StaffEnrollStartSerializer,
    StaffLoginResponseSerializer,
    StaffLoginSerializer,
)
from .auth import _set_jwt_cookies

logger = logging.getLogger("apps.accounts.staff_auth")

DENY = ({"detail": "Invalid credentials"}, 401)


def _authenticate_staff(request, email: str, password: str):
    """Returns the staff user only if (user exists AND is_staff AND password ok).
    Returns None for every failure mode — no enumeration."""
    user = authenticate(request, email=email.lower(), password=password)
    if user is None or not user.is_staff:
        return None
    return user


class StaffLoginView(APIView):
    """Login for the MWRD admin portal. Mandatory TOTP."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(
        request=StaffLoginSerializer,
        responses={
            200: StaffLoginResponseSerializer,
            401: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["staff-auth"],
    )
    def post(self, request):
        ser = StaffLoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"]
        password = ser.validated_data["password"]
        otp = ser.validated_data["otp"]

        user = _authenticate_staff(request, email, password)
        device = (
            TOTPDevice.objects.filter(user=user, confirmed=True).first()
            if user is not None else None
        )

        # Always do a TOTP verify to keep timing constant between
        # bad-password and bad-OTP failure paths. We discard the result
        # if the user lookup failed; otherwise we use it.
        otp_ok = False
        if device is not None:
            otp_ok = device.verify_token(otp)
        else:
            # Dummy verify against a throwaway secret of the same shape so
            # bad-password and bad-OTP paths take similar wall-clock time.
            try:
                from django_otp.oath import TOTP
                TOTP(b"\x00" * 20, 30, 0, 6).verify(int(otp), tolerance=0)
            except (ValueError, TypeError):
                pass

        if user is None:
            logger.info("staff_login.fail", extra={"event": "staff_login.fail", "email": email})
            return Response(*DENY)
        if device is None or not otp_ok:
            logger.info(
                "staff_login.otp_fail",
                extra={"event": "staff_login.otp_fail", "user_id": user.id},
            )
            return Response(*DENY)

        refresh = RefreshToken.for_user(user)
        refresh["scope"] = "staff"

        logger.info(
            "staff_login.ok",
            extra={"event": "staff_login.ok", "user_id": user.id, "scope": "staff"},
        )

        resp = Response({"ok": True})
        _set_jwt_cookies(resp, refresh)
        return resp


class StaffEnrollStartView(APIView):
    """Begin TOTP enrollment for a staff user.

    Requires email+password (no OTP, since they don't have one yet).
    Refuses if the user already has a confirmed device.
    Creates an unconfirmed TOTPDevice and returns its provisioning_uri so the
    client can render a QR code. Multiple calls overwrite the unconfirmed
    device — no rate limit beyond the global login throttle.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(
        request=StaffEnrollStartSerializer,
        responses={
            200: StaffEnrollStartResponseSerializer,
            401: OpenApiResponse(response=ErrorSerializer),
            409: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["staff-auth"],
    )
    def post(self, request):
        ser = StaffEnrollStartSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = _authenticate_staff(
            request, ser.validated_data["email"], ser.validated_data["password"]
        )
        if user is None:
            return Response(*DENY)

        if TOTPDevice.objects.filter(user=user, confirmed=True).exists():
            return Response({"detail": "Already enrolled"}, status=409)

        TOTPDevice.objects.filter(user=user, confirmed=False).delete()
        device = TOTPDevice.objects.create(user=user, name="default", confirmed=False)
        return Response(
            {
                "provisioning_uri": device.config_url,
                "secret": device.bin_key.hex(),
            }
        )


class StaffEnrollConfirmView(APIView):
    """Confirm the unconfirmed TOTPDevice with a valid code."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(
        request=StaffEnrollConfirmSerializer,
        responses={
            200: StaffLoginResponseSerializer,
            401: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["staff-auth"],
    )
    def post(self, request):
        ser = StaffEnrollConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = _authenticate_staff(
            request, ser.validated_data["email"], ser.validated_data["password"]
        )
        if user is None:
            return Response(*DENY)

        device = TOTPDevice.objects.filter(user=user, confirmed=False).order_by("-id").first()
        if device is None or not device.verify_token(ser.validated_data["otp"]):
            return Response(*DENY)

        device.confirmed = True
        device.save(update_fields=["confirmed"])
        logger.info(
            "staff_totp.enrolled",
            extra={"event": "staff_totp.enrolled", "user_id": user.id},
        )

        refresh = RefreshToken.for_user(user)
        refresh["scope"] = "staff"
        resp = Response({"ok": True})
        _set_jwt_cookies(resp, refresh)
        return resp

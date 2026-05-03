"""R5 — Backoffice Quote Manager.

Three endpoints under /api/staff/quotes/:

- GET    /api/staff/quotes/pending          → list PENDING_ADMIN quotes
- POST   /api/staff/quotes/<id>/release     → apply margin override + send
- POST   /api/staff/quotes/<id>/reject      → reject with reason

The "release" call is the slider in the spec's Quote Manager screen — the
admin sees the supplier total + a margin pct widget, drags the pct, and
clicks Release. We use the admin's chosen pct as `margin_override_pct`
which both stamps the quote and skips the auto-hold threshold check.
"""
from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsStaffWithScope

from . import services
from .models import Quote
from .serializers import QuoteErrorSerializer, QuoteSerializer


class ReleaseSerializer(serializers.Serializer):
    margin_pct = serializers.DecimalField(
        max_digits=6, decimal_places=2, min_value=0, max_value=100,
        required=False, allow_null=True,
    )


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=True, default="")


class StaffPendingQuotesView(APIView):
    """List quotes held for admin review."""
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        responses={200: QuoteSerializer(many=True)}, tags=["staff-quotes"],
    )
    def get(self, request):
        qs = (
            Quote.objects
            .filter(status=Quote.Status.PENDING_ADMIN)
            .select_related("supplier_org", "rfq__client_org")
            .prefetch_related("items__rfq_item__master_product")
            .order_by("-updated_at")
        )
        return Response(QuoteSerializer(qs, many=True).data)


class StaffReleaseQuoteView(APIView):
    """Release a held quote to the client. Optional margin override."""
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=ReleaseSerializer,
        responses={
            200: QuoteSerializer,
            400: OpenApiResponse(response=QuoteErrorSerializer),
            404: OpenApiResponse(description="not found"),
        },
        tags=["staff-quotes"],
    )
    def post(self, request, quote_id: int):
        quote = Quote.objects.filter(id=quote_id).first()
        if quote is None:
            return Response({"detail": "not found"}, status=404)
        ser = ReleaseSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            services.admin_release(
                quote, by=request.user,
                margin_override_pct=ser.validated_data.get("margin_pct"),
            )
        except services.QuoteError as e:
            return Response({"detail": str(e)}, status=400)
        quote.refresh_from_db()
        return Response(QuoteSerializer(quote).data)


class StaffRejectQuoteView(APIView):
    """Reject a held quote. Sends supplier a notification with the reason."""
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=RejectSerializer,
        responses={
            200: QuoteSerializer,
            400: OpenApiResponse(response=QuoteErrorSerializer),
            404: OpenApiResponse(description="not found"),
        },
        tags=["staff-quotes"],
    )
    def post(self, request, quote_id: int):
        quote = Quote.objects.filter(id=quote_id).first()
        if quote is None:
            return Response({"detail": "not found"}, status=404)
        ser = RejectSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            services.admin_reject(
                quote, by=request.user, reason=ser.validated_data.get("reason", ""),
            )
        except services.QuoteError as e:
            return Response({"detail": str(e)}, status=400)
        quote.refresh_from_db()
        return Response(QuoteSerializer(quote).data)

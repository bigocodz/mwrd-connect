"""Backoffice margin management. Customer-facing portals NEVER call these
endpoints — they live under /api/staff/."""
from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsStaffWithScope

from . import services
from .models import Margin


class MarginSerializer(serializers.ModelSerializer):
    class Meta:
        model = Margin
        fields = ("id", "scope", "scope_id", "pct", "updated_at")
        read_only_fields = fields


class SetGlobalMarginSerializer(serializers.Serializer):
    pct = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0, max_value=100)


class SetCategoryMarginSerializer(SetGlobalMarginSerializer):
    category_id = serializers.IntegerField()


class SetClientMarginSerializer(SetGlobalMarginSerializer):
    client_org_id = serializers.IntegerField()


class PricingErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "PricingError"


class StaffMarginListView(APIView):
    """All margin rules — global + category + client overrides."""
    permission_classes = [IsStaffWithScope]

    @extend_schema(responses={200: MarginSerializer(many=True)}, tags=["staff-pricing"])
    def get(self, request):
        qs = Margin.objects.order_by("scope", "scope_id")
        return Response(MarginSerializer(qs, many=True).data)


class StaffSetGlobalMarginView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=SetGlobalMarginSerializer,
        responses={200: MarginSerializer},
        tags=["staff-pricing"],
    )
    def post(self, request):
        ser = SetGlobalMarginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = services.set_global_margin(pct=ser.validated_data["pct"], by=request.user)
        return Response(MarginSerializer(obj).data)


class StaffSetCategoryMarginView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=SetCategoryMarginSerializer,
        responses={200: MarginSerializer},
        tags=["staff-pricing"],
    )
    def post(self, request):
        ser = SetCategoryMarginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = services.set_category_margin(
            category_id=ser.validated_data["category_id"],
            pct=ser.validated_data["pct"],
            by=request.user,
        )
        return Response(MarginSerializer(obj).data)


class StaffSetClientMarginView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=SetClientMarginSerializer,
        responses={200: MarginSerializer},
        tags=["staff-pricing"],
    )
    def post(self, request):
        ser = SetClientMarginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = services.set_client_margin(
            client_org_id=ser.validated_data["client_org_id"],
            pct=ser.validated_data["pct"],
            by=request.user,
        )
        return Response(MarginSerializer(obj).data)


class StaffDeleteMarginView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        responses={
            204: OpenApiResponse(description="deleted"),
            400: OpenApiResponse(response=PricingErrorSerializer),
        },
        tags=["staff-pricing"],
    )
    def delete(self, request, margin_id: int):
        margin = Margin.objects.filter(id=margin_id).first()
        if margin is None:
            return Response(status=204)
        if margin.scope == Margin.Scope.GLOBAL:
            return Response(
                {"detail": "Global margin cannot be deleted; PATCH the value instead."},
                status=400,
            )
        margin.delete()
        return Response(status=204)

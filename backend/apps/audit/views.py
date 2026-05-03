from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsStaffWithScope
from apps.organizations.models import Organization

from .models import AuditLog
from .serializers import AuditLogSerializer


class StaffAuditSearchView(APIView):
    """Staff search across all audit events. Filter by action, target, org."""

    permission_classes = [IsStaffWithScope]

    @extend_schema(
        parameters=[
            OpenApiParameter("action", str, OpenApiParameter.QUERY, required=False),
            OpenApiParameter("organization_id", int, OpenApiParameter.QUERY, required=False),
            OpenApiParameter("target_type", str, OpenApiParameter.QUERY, required=False),
            OpenApiParameter("target_id", int, OpenApiParameter.QUERY, required=False),
            OpenApiParameter("limit", int, OpenApiParameter.QUERY, required=False),
        ],
        responses={200: AuditLogSerializer(many=True)},
        tags=["staff-audit"],
    )
    def get(self, request):
        qs = AuditLog.objects.select_related("actor", "target_ct")
        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        org_id = request.query_params.get("organization_id")
        if org_id:
            qs = qs.filter(organization_id=org_id)
        ttype = request.query_params.get("target_type")
        if ttype:
            qs = qs.filter(target_ct__model=ttype)
        tid = request.query_params.get("target_id")
        if tid:
            qs = qs.filter(target_id=tid)
        try:
            limit = min(int(request.query_params.get("limit", 100)), 500)
        except ValueError:
            limit = 100
        qs = qs.order_by("-created_at")[:limit]
        return Response(AuditLogSerializer(qs, many=True).data)


class OrgAuditView(APIView):
    """Customer view: their own org's audit trail."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: AuditLogSerializer(many=True)}, tags=["audit"])
    def get(self, request):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        qs = (
            AuditLog.objects.select_related("actor", "target_ct")
            .filter(organization=org)
            .order_by("-created_at")[:200]
        )
        return Response(AuditLogSerializer(qs, many=True).data)

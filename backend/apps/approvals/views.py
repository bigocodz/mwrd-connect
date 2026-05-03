"""R9 — Approval Tree endpoints (client portal)."""
from __future__ import annotations

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.organizations.models import Organization

from . import services
from .models import ApprovalNode, ApprovalTask

# ---------- Serializers ----------


class ApprovalNodeSerializer(serializers.ModelSerializer):
    chain = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalNode
        fields = (
            "id", "organization", "member", "direct_approver", "chain",
            "created_at", "updated_at",
        )
        read_only_fields = fields

    def get_chain(self, obj):
        # Computed at serialize time so the UI can show the full path.
        return services.approval_chain_for(
            organization=obj.organization, member=obj.member,
        )


class SetApproverSerializer(serializers.Serializer):
    member_id = serializers.IntegerField()
    approver_id = serializers.IntegerField(allow_null=True, required=False)


class ApprovalTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalTask
        fields = (
            "id", "order", "approver", "order_in_chain", "status",
            "note", "decided_at", "created_at",
        )
        read_only_fields = fields


class DecideTaskSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[ApprovalTask.Status.APPROVED, ApprovalTask.Status.REJECTED]
    )
    note = serializers.CharField(allow_blank=True, default="")


class ApprovalErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "ApprovalError"


# ---------- Views ----------


def _client_org(request):
    org = get_object_or_404(Organization, id=request.active_organization_id)
    if org.type != Organization.Type.CLIENT:
        raise PermissionDenied("Client-only endpoint")
    return org


class ApprovalTreeView(APIView):
    """List + upsert approval nodes for the active client org."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: ApprovalNodeSerializer(many=True)}, tags=["approvals"],
    )
    def get(self, request):
        org = _client_org(request)
        qs = ApprovalNode.objects.filter(organization=org).select_related(
            "member", "direct_approver",
        )
        return Response(ApprovalNodeSerializer(qs, many=True).data)

    @extend_schema(
        request=SetApproverSerializer,
        responses={
            200: ApprovalNodeSerializer,
            400: OpenApiResponse(response=ApprovalErrorSerializer),
        },
        tags=["approvals"],
    )
    def post(self, request):
        org = _client_org(request)
        ser = SetApproverSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        member = get_object_or_404(User, id=ser.validated_data["member_id"])
        approver_id = ser.validated_data.get("approver_id")
        approver = (
            get_object_or_404(User, id=approver_id) if approver_id else None
        )
        try:
            node = services.set_direct_approver(
                organization=org, member=member, approver=approver,
            )
        except services.ApprovalError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(ApprovalNodeSerializer(node).data)


class MyApprovalTasksView(APIView):
    """Tasks awaiting the current user's decision."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: ApprovalTaskSerializer(many=True)}, tags=["approvals"],
    )
    def get(self, request):
        qs = ApprovalTask.objects.filter(
            approver=request.user, status=ApprovalTask.Status.PENDING,
        ).order_by("created_at")
        return Response(ApprovalTaskSerializer(qs, many=True).data)


class DecideApprovalTaskView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=DecideTaskSerializer,
        responses={
            200: ApprovalTaskSerializer,
            400: OpenApiResponse(response=ApprovalErrorSerializer),
        },
        tags=["approvals"],
    )
    def post(self, request, task_id: int):
        task = get_object_or_404(ApprovalTask, id=task_id)
        ser = DecideTaskSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            services.decide_task(
                task,
                status=ser.validated_data["status"],
                by=request.user,
                note=ser.validated_data.get("note", ""),
            )
        except services.ApprovalError as e:
            return Response({"detail": str(e)}, status=400)
        task.refresh_from_db()
        return Response(ApprovalTaskSerializer(task).data)

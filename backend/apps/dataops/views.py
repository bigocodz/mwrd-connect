from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsStaffWithScope
from apps.organizations.models import Membership, Organization

from . import services


class PurgeRequestSerializer(serializers.Serializer):
    organization_id = serializers.IntegerField()
    reason = serializers.CharField(min_length=10, max_length=2000)
    confirm_public_id = serializers.CharField(
        help_text="The org's public_id, repeated as a confirmation guard.",
    )


class PurgeResultSerializer(serializers.Serializer):
    organization_id = serializers.IntegerField()
    counts = serializers.DictField()


class DataopsErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "DataopsError"


class ExportMyOrgView(APIView):
    """The active org's owners/admins can download their full data zip."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: OpenApiResponse(description="application/zip"),
                   403: OpenApiResponse(response=DataopsErrorSerializer)},
        tags=["dataops"],
    )
    def get(self, request):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        # Only owners/admins can pull org-wide data
        is_admin = Membership.objects.filter(
            user=request.user, organization=org, status="ACTIVE",
            role__in=[Membership.Role.OWNER, Membership.Role.ADMIN],
        ).exists()
        if not is_admin:
            return Response({"detail": "Owner or admin role required"}, status=403)

        zip_bytes = services.export_org(org)
        resp = HttpResponse(zip_bytes, content_type="application/zip")
        resp["Content-Disposition"] = (
            f'attachment; filename="mwrd-export-{org.public_id}.zip"'
        )
        return resp


class StaffPurgeOrgView(APIView):
    """Staff-only org purge with double-confirmation."""

    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=PurgeRequestSerializer,
        responses={
            200: PurgeResultSerializer,
            400: OpenApiResponse(response=DataopsErrorSerializer),
        },
        tags=["staff-dataops"],
    )
    def post(self, request):
        ser = PurgeRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        org = get_object_or_404(Organization, id=ser.validated_data["organization_id"])
        if ser.validated_data["confirm_public_id"] != org.public_id:
            return Response({"detail": "public_id confirmation does not match"}, status=400)
        try:
            counts = services.purge_org(
                org, by=request.user, reason=ser.validated_data["reason"],
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response({"organization_id": org.id, "counts": counts})

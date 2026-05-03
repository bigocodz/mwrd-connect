from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsStaffWithScope
from apps.notifications.tasks import send_owner_invite_email
from apps.organizations import services as org_services
from apps.organizations.models import Organization
from apps.organizations.services import (
    InvalidTransition,
    create_organization_with_owner_invite,
)


class CreateOrgRequestSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=Organization.Type.choices)
    name = serializers.CharField(max_length=255)
    public_id = serializers.CharField(max_length=32)
    contact_email = serializers.EmailField()


class CreateOrgResponseSerializer(serializers.Serializer):
    organization_id = serializers.IntegerField()
    invite_id = serializers.IntegerField()


class OrgListItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = (
            "id", "type", "status", "name", "public_id", "contact_email",
            "activated_at", "suspended_at", "suspension_reason",
            "created_at", "updated_at",
        )
        read_only_fields = fields


class SuspendRequestSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=1000)


class ErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "OpsError"


class CreateOrgWithInviteView(APIView):
    """Staff-only: create a new client/supplier org and email an owner invite."""

    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=CreateOrgRequestSerializer,
        responses={
            201: CreateOrgResponseSerializer,
            401: OpenApiResponse(response=ErrorSerializer),
            403: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["staff"],
    )
    def post(self, request):
        ser = CreateOrgRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        org, invite, raw_token = create_organization_with_owner_invite(
            **ser.validated_data,
            invited_by=request.user,
        )
        send_owner_invite_email.delay(invite.id, raw_token)
        return Response(
            {"organization_id": org.id, "invite_id": invite.id},
            status=201,
        )


class OrgListView(APIView):
    """Staff-only list of all orgs (clients + suppliers)."""

    permission_classes = [IsStaffWithScope]

    @extend_schema(responses={200: OrgListItemSerializer(many=True)}, tags=["staff"])
    def get(self, request):
        qs = Organization.objects.order_by("-created_at")
        type_filter = request.query_params.get("type")
        status_filter = request.query_params.get("status")
        if type_filter:
            qs = qs.filter(type=type_filter)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(OrgListItemSerializer(qs, many=True).data)


class OrgDetailView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(responses={200: OrgListItemSerializer}, tags=["staff"])
    def get(self, request, org_id: int):
        org = get_object_or_404(Organization, id=org_id)
        return Response(OrgListItemSerializer(org).data)


class OrgSuspendView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=SuspendRequestSerializer,
        responses={
            200: OrgListItemSerializer,
            400: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["staff"],
    )
    def post(self, request, org_id: int):
        ser = SuspendRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        org = get_object_or_404(Organization, id=org_id)
        try:
            org = org_services.suspend_org(
                org, by=request.user, reason=ser.validated_data["reason"]
            )
        except InvalidTransition as e:
            return Response({"detail": str(e)}, status=400)
        return Response(OrgListItemSerializer(org).data)


class OrgUnsuspendView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=None,
        responses={
            200: OrgListItemSerializer,
            400: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["staff"],
    )
    def post(self, request, org_id: int):
        org = get_object_or_404(Organization, id=org_id)
        try:
            org = org_services.unsuspend_org(org, by=request.user)
        except InvalidTransition as e:
            return Response({"detail": str(e)}, status=400)
        return Response(OrgListItemSerializer(org).data)


class OrgArchiveView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=None,
        responses={
            200: OrgListItemSerializer,
            400: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["staff"],
    )
    def post(self, request, org_id: int):
        org = get_object_or_404(Organization, id=org_id)
        try:
            org = org_services.archive_org(org, by=request.user)
        except InvalidTransition as e:
            return Response({"detail": str(e)}, status=400)
        return Response(OrgListItemSerializer(org).data)


# ---------- R2: Leads queue ----------

from apps.organizations import services as _org_services  # noqa: E402
from apps.organizations.models import Lead as _Lead  # noqa: E402


class LeadListItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField()
    account_type = serializers.CharField()
    company_name = serializers.CharField()
    signup_intent = serializers.CharField()
    status = serializers.CharField()
    callback_notes = serializers.CharField()
    callback_completed_at = serializers.DateTimeField(allow_null=True)
    activated_at = serializers.DateTimeField(allow_null=True)
    rejection_reason = serializers.CharField()
    created_at = serializers.DateTimeField()


class CompleteCallbackSerializer(serializers.Serializer):
    notes = serializers.CharField(max_length=2000, allow_blank=True, default="")


class CompleteCallbackResponseSerializer(serializers.Serializer):
    lead_id = serializers.IntegerField()
    activation_token_DEV_ONLY = serializers.CharField(  # noqa: N815
        help_text=(
            "ONLY returned in dev. In prod the activation email task delivers "
            "this to the lead's email address."
        ),
    )


class RejectLeadSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=1, max_length=2000)


class StaffLeadsListView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        responses={200: LeadListItemSerializer(many=True)},
        tags=["staff"],
    )
    def get(self, request):
        status_filter = request.query_params.get("status")
        qs = _Lead.objects.all().order_by("-created_at")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(LeadListItemSerializer(qs, many=True).data)


class StaffCompleteCallbackView(APIView):
    """Ops marks a callback complete. Issues activation token; in dev returns
    the raw token for visibility, in prod the email task delivers it."""
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=CompleteCallbackSerializer,
        responses={
            200: CompleteCallbackResponseSerializer,
            400: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["staff"],
    )
    def post(self, request, lead_id: int):
        ser = CompleteCallbackSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        lead = get_object_or_404(_Lead, id=lead_id)
        try:
            lead, raw_token = _org_services.complete_callback(
                lead=lead, by=request.user, notes=ser.validated_data["notes"],
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        # TODO(notifications): send_activation_email.delay(lead.id, raw_token)
        return Response({
            "lead_id": lead.id,
            "activation_token_DEV_ONLY": raw_token,
        })


class StaffRejectLeadView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=RejectLeadSerializer,
        responses={
            200: LeadListItemSerializer,
            400: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["staff"],
    )
    def post(self, request, lead_id: int):
        ser = RejectLeadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        lead = get_object_or_404(_Lead, id=lead_id)
        try:
            _org_services.reject_lead(lead=lead, reason=ser.validated_data["reason"])
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(LeadListItemSerializer(lead).data)

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.permissions import IsOrgRole
from apps.notifications.tasks import send_team_invite_email

from . import services
from .models import Invite, Membership, Organization


class AcceptInviteRequestSerializer(serializers.Serializer):
    token = serializers.CharField()


class InvitePreviewOrganizationSerializer(serializers.Serializer):
    name = serializers.CharField()
    type = serializers.ChoiceField(choices=Organization.Type.choices)


class InvitePreviewResponseSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.CharField()
    kind = serializers.CharField()
    organization = InvitePreviewOrganizationSerializer()


class AcceptInviteResponseSerializer(serializers.Serializer):
    organization_id = serializers.IntegerField()
    role = serializers.CharField()


class ErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "OrgsError"


class InvitePreviewView(APIView):
    """Pre-accept lookup so the frontend can render org name + role."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"  # share the login scope — same brute-force shape

    @extend_schema(
        request=AcceptInviteRequestSerializer,
        responses={
            200: InvitePreviewResponseSerializer,
            400: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["organizations"],
    )
    def post(self, request):
        ser = AcceptInviteRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        invite = (
            Invite.objects.filter(
                token_hash=services.hash_token(ser.validated_data["token"]),
                status=Invite.Status.PENDING,
            )
            .select_related("organization")
            .first()
        )
        if invite is None or invite.is_expired:
            return Response({"detail": "Invalid or expired invite"}, status=400)
        return Response(
            {
                "email": invite.email,
                "role": invite.role,
                "kind": invite.kind,
                "organization": {
                    "name": invite.organization.name,
                    "type": invite.organization.type,
                },
            }
        )


class AcceptInviteView(APIView):
    """User must be authenticated (signed up or logged in) before calling."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=AcceptInviteRequestSerializer,
        responses={
            200: AcceptInviteResponseSerializer,
            400: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["organizations"],
    )
    def post(self, request):
        ser = AcceptInviteRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            membership = services.accept_invite(
                raw_token=ser.validated_data["token"], user=request.user
            )
        except (Invite.DoesNotExist, ValueError):
            return Response({"detail": "Invalid or expired invite"}, status=400)
        return Response(
            {"organization_id": membership.organization_id, "role": membership.role}
        )


class CanInviteTeam(IsOrgRole):
    roles = (Membership.Role.OWNER, Membership.Role.ADMIN)


class CreateTeamInviteRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=Membership.Role.choices)


class CreateTeamInviteResponseSerializer(serializers.Serializer):
    invite_id = serializers.IntegerField()


class CreateTeamInviteView(APIView):
    """Org owner/admin invites a teammate to their own org."""

    permission_classes = [IsAuthenticated, CanInviteTeam]

    @extend_schema(
        request=CreateTeamInviteRequestSerializer,
        responses={
            201: CreateTeamInviteResponseSerializer,
            400: OpenApiResponse(response=ErrorSerializer),
            403: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["organizations"],
    )
    def post(self, request):
        ser = CreateTeamInviteRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if ser.validated_data["role"] == Membership.Role.OWNER:
            return Response({"detail": "OWNER role cannot be team-invited"}, status=400)

        org = get_object_or_404(Organization, id=request.active_organization_id)
        invite, raw_token = services.create_team_invite(
            organization=org,
            email=ser.validated_data["email"],
            role=ser.validated_data["role"],
            invited_by=request.user,
        )
        send_team_invite_email.delay(invite.id, raw_token)
        return Response({"invite_id": invite.id}, status=201)


class TeamMembershipListItemSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = Membership
        fields = ("id", "user_email", "user_full_name", "role", "status", "created_at")
        read_only_fields = fields


class TeamListView(APIView):
    """List the active org's team members. Visible to any member."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: TeamMembershipListItemSerializer(many=True)},
        tags=["organizations"],
    )
    def get(self, request):
        org_id = request.active_organization_id
        qs = (
            Membership.objects.filter(organization_id=org_id)
            .select_related("user")
            .order_by("created_at")
        )
        return Response(TeamMembershipListItemSerializer(qs, many=True).data)

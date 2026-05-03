"""KYC endpoints.

Customer-facing (org owner / admin role required):
    GET  /api/kyc/current                    current submission
    PATCH /api/kyc/current                   update legal info on the open draft
    POST /api/kyc/current/uploads            request signed PUT URL
    POST /api/kyc/current/documents          register a completed upload
    DELETE /api/kyc/current/documents/<id>   remove an uploaded doc
    POST /api/kyc/current/submit             submit for review

Staff-only (under /api/staff/kyc/...):
    GET  /api/staff/kyc/queue                submissions awaiting review
    GET  /api/staff/kyc/<id>                 submission detail
    POST /api/staff/kyc/<id>/approve
    POST /api/staff/kyc/<id>/request-changes
    POST /api/staff/kyc/<id>/reject
"""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsOrgRole, IsStaffWithScope
from apps.core.storage import signed_upload_url
from apps.organizations.models import Membership, Organization

from . import services
from .models import KycDocument, KycSubmission
from .serializers import (
    AttachDocumentSerializer,
    ErrorSerializer,
    KycDocumentSerializer,
    KycSubmissionSerializer,
    ReviewActionSerializer,
    SignedUploadRequestSerializer,
    SignedUploadResponseSerializer,
)


class CanManageKyc(IsOrgRole):
    """Owners and admins can manage their org's KYC submission."""
    roles = (Membership.Role.OWNER, Membership.Role.ADMIN)


def _current_org(request) -> Organization:
    org_id = getattr(request, "active_organization_id", None)
    return get_object_or_404(Organization, id=org_id)


# ---------- Customer-facing views ----------

class CurrentSubmissionView(APIView):
    permission_classes = [IsAuthenticated, CanManageKyc]

    @extend_schema(responses={200: KycSubmissionSerializer}, tags=["kyc"])
    def get(self, request):
        sub = services.get_or_create_draft(_current_org(request))
        return Response(KycSubmissionSerializer(sub).data)

    @extend_schema(
        request=KycSubmissionSerializer,
        responses={200: KycSubmissionSerializer},
        tags=["kyc"],
    )
    def patch(self, request):
        sub = services.get_or_create_draft(_current_org(request))
        if sub.status not in (
            KycSubmission.Status.DRAFT,
            KycSubmission.Status.CHANGES_REQUESTED,
        ):
            return Response({"detail": "Submission is locked"}, status=400)
        ser = KycSubmissionSerializer(sub, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class SignedUploadView(APIView):
    permission_classes = [IsAuthenticated, CanManageKyc]

    @extend_schema(
        request=SignedUploadRequestSerializer,
        responses={200: SignedUploadResponseSerializer},
        tags=["kyc"],
    )
    def post(self, request):
        ser = SignedUploadRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        sub = services.get_or_create_draft(_current_org(request))
        key = services.make_storage_key(
            org_id=sub.organization_id,
            submission_id=sub.id,
            kind=ser.validated_data["kind"],
            filename=ser.validated_data["filename"],
        )
        upload = signed_upload_url(key, ser.validated_data["content_type"])
        return Response({"upload": upload, "storage_key": key})


class AttachDocumentView(APIView):
    permission_classes = [IsAuthenticated, CanManageKyc]

    @extend_schema(
        request=AttachDocumentSerializer,
        responses={201: KycDocumentSerializer},
        tags=["kyc"],
    )
    def post(self, request):
        ser = AttachDocumentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        sub = services.get_or_create_draft(_current_org(request))
        if sub.status not in (
            KycSubmission.Status.DRAFT,
            KycSubmission.Status.CHANGES_REQUESTED,
        ):
            return Response({"detail": "Submission is locked"}, status=400)
        doc = services.attach_document(sub, **ser.validated_data)
        return Response(KycDocumentSerializer(doc).data, status=201)


class DeleteDocumentView(APIView):
    permission_classes = [IsAuthenticated, CanManageKyc]

    @extend_schema(responses={204: None}, tags=["kyc"])
    def delete(self, request, doc_id: int):
        sub = services.get_or_create_draft(_current_org(request))
        if sub.status not in (
            KycSubmission.Status.DRAFT,
            KycSubmission.Status.CHANGES_REQUESTED,
        ):
            return Response({"detail": "Submission is locked"}, status=400)
        doc = get_object_or_404(KycDocument, id=doc_id, submission=sub)
        doc.delete()
        return Response(status=204)


class SubmitForReviewView(APIView):
    permission_classes = [IsAuthenticated, CanManageKyc]

    @extend_schema(
        request=None,
        responses={
            200: KycSubmissionSerializer,
            400: OpenApiResponse(response=ErrorSerializer),
        },
        tags=["kyc"],
    )
    def post(self, request):
        sub = services.get_or_create_draft(_current_org(request))
        try:
            sub = services.submit_for_review(sub, by=request.user)
        except services.InvalidKycTransition as e:
            return Response({"detail": str(e)}, status=400)
        return Response(KycSubmissionSerializer(sub).data)


# ---------- Staff-only review views ----------

class StaffQueueView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        responses={200: KycSubmissionSerializer(many=True)},
        tags=["staff-kyc"],
    )
    def get(self, request):
        qs = (
            KycSubmission.objects.filter(status=KycSubmission.Status.SUBMITTED)
            .select_related("organization")
            .order_by("submitted_at")
        )
        return Response(KycSubmissionSerializer(qs, many=True).data)


class StaffSubmissionDetailView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(responses={200: KycSubmissionSerializer}, tags=["staff-kyc"])
    def get(self, request, submission_id: int):
        sub = get_object_or_404(KycSubmission, id=submission_id)
        return Response(KycSubmissionSerializer(sub).data)


def _do_review(request, submission_id: int, action_name: str):
    ser = ReviewActionSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    sub = get_object_or_404(KycSubmission, id=submission_id)
    fn = getattr(services, action_name)
    try:
        sub = fn(sub, by=request.user, notes=ser.validated_data.get("notes", ""))
    except services.InvalidKycTransition as e:
        return Response({"detail": str(e)}, status=400)
    return Response(KycSubmissionSerializer(sub).data)


class StaffApproveView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=ReviewActionSerializer,
        responses={200: KycSubmissionSerializer, 400: OpenApiResponse(response=ErrorSerializer)},
        tags=["staff-kyc"],
    )
    def post(self, request, submission_id: int):
        return _do_review(request, submission_id, "approve")


class StaffRequestChangesView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=ReviewActionSerializer,
        responses={200: KycSubmissionSerializer, 400: OpenApiResponse(response=ErrorSerializer)},
        tags=["staff-kyc"],
    )
    def post(self, request, submission_id: int):
        return _do_review(request, submission_id, "request_changes")


class StaffRejectView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=ReviewActionSerializer,
        responses={200: KycSubmissionSerializer, 400: OpenApiResponse(response=ErrorSerializer)},
        tags=["staff-kyc"],
    )
    def post(self, request, submission_id: int):
        return _do_review(request, submission_id, "reject")

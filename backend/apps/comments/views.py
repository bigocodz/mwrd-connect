"""Comments endpoints.

URL shape:
    GET  /api/comments?on=<type>:<id>   list a thread
    POST /api/comments?on=<type>:<id>   add to a thread

Allowed `<type>` values: rfq, order, contract, supplier_invoice,
client_invoice, delivery_note, grn. The view enforces that the active org
is a party to the target.
"""
from __future__ import annotations

from django.contrib.contenttypes.models import ContentType
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Organization

from .models import Comment
from .serializers import (
    CommentSerializer,
    CommentsErrorSerializer,
    CreateCommentSerializer,
)

# Map URL slug → (app_label, model_name, attrs to check for membership).
# A user whose active org matches any of `attrs` on the target gets access.
_TARGET_TYPES: dict[str, tuple[str, str, tuple[str, ...]]] = {
    "rfq": ("rfqs", "rfq", ("client_org_id",)),
    "order": ("orders", "order", ("client_org_id", "supplier_org_id")),
    "contract": ("contracts", "contract", ("client_org_id", "supplier_org_id")),
    "supplier_invoice": ("invoicing", "supplierinvoice", ("supplier_org_id",)),
    "client_invoice": ("invoicing", "clientinvoice", ("client_org_id",)),
    "delivery_note": ("fulfillment", "deliverynote", ("client_org_id", "supplier_org_id")),
    "grn": ("fulfillment", "goodsreceiptnote", ("client_org_id",)),
}


def _resolve_target(request, on: str):
    try:
        type_slug, raw_id = on.split(":")
        target_id = int(raw_id)
    except (ValueError, AttributeError) as exc:
        raise PermissionDenied("Bad target") from exc
    spec = _TARGET_TYPES.get(type_slug)
    if spec is None:
        raise PermissionDenied("Unknown target type")
    app_label, model_name, attrs = spec
    ct = ContentType.objects.get(app_label=app_label, model=model_name)
    target = get_object_or_404(ct.model_class(), id=target_id)

    # R8 — dual PO. The CPO and SPO are paired — both sides of a transaction
    # need to see the same comment thread. We canonicalize all order targets
    # to the CPO so storage uses one stable id regardless of which order
    # the caller passed.
    if type_slug == "order":
        from apps.orders.models import Order as _Order
        if target.type == _Order.Type.SPO:
            cpo = target.paired_order()
            if cpo is not None:
                target = cpo

    org = get_object_or_404(Organization, id=request.active_organization_id)

    # For supplier inbox on PUBLISHED RFQs: also allow suppliers to comment
    # on an RFQ they're participating in (any quote exists).
    if type_slug == "rfq" and org.type == Organization.Type.SUPPLIER:
        if target.quotes.filter(supplier_org=org).exists():
            return ct, target
        if target.status == "PUBLISHED":
            return ct, target  # broadcast — suppliers can ask questions

    if any(getattr(target, a, None) == org.id for a in attrs):
        return ct, target

    raise PermissionDenied("Not a party to this thread")


class CommentsListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[OpenApiParameter("on", str, OpenApiParameter.QUERY, required=True)],
        responses={
            200: CommentSerializer(many=True),
            403: OpenApiResponse(response=CommentsErrorSerializer),
        },
        tags=["comments"],
    )
    def get(self, request):
        on = request.query_params.get("on") or ""
        ct, target = _resolve_target(request, on)
        qs = (
            Comment.objects.filter(target_ct=ct, target_id=target.id, deleted_at__isnull=True)
            .select_related("author", "author_org")
            .order_by("created_at")
        )
        return Response(CommentSerializer(qs, many=True).data)

    @extend_schema(
        request=CreateCommentSerializer,
        parameters=[OpenApiParameter("on", str, OpenApiParameter.QUERY, required=True)],
        responses={
            201: CommentSerializer,
            403: OpenApiResponse(response=CommentsErrorSerializer),
        },
        tags=["comments"],
    )
    def post(self, request):
        on = request.query_params.get("on") or ""
        ct, target = _resolve_target(request, on)
        ser = CreateCommentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        comment = Comment.objects.create(
            target_ct=ct, target_id=target.id,
            author=request.user,
            author_org_id=request.active_organization_id,
            body=ser.validated_data["body"],
        )
        return Response(CommentSerializer(comment).data, status=201)

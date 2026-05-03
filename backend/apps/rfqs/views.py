"""RFQ endpoints — visibility split between client owner and supplier inbox."""
from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import MasterProduct
from apps.organizations.models import Organization

from . import services
from .models import Rfq
from .serializers import (
    RfqAddItemSerializer,
    RfqCreateSerializer,
    RfqErrorSerializer,
    RfqItemSerializer,
    RfqSerializer,
)


def _client_org(request) -> Organization:
    org = get_object_or_404(Organization, id=request.active_organization_id)
    if org.type != Organization.Type.CLIENT:
        raise PermissionDenied("Client-only endpoint")
    return org


def _supplier_org(request) -> Organization:
    org = get_object_or_404(Organization, id=request.active_organization_id)
    if org.type != Organization.Type.SUPPLIER:
        raise PermissionDenied("Supplier-only endpoint")
    return org


def _visible_rfq(request, rfq_id: int) -> Rfq:
    """Return the RFQ if the active org is allowed to see it (client owner
    or — for published RFQs — any supplier)."""
    org = get_object_or_404(Organization, id=request.active_organization_id)
    rfq = get_object_or_404(Rfq, id=rfq_id)
    if rfq.client_org_id == org.id:
        return rfq
    if org.type == Organization.Type.SUPPLIER and rfq.status in (
        Rfq.Status.PUBLISHED, Rfq.Status.AWARDED, Rfq.Status.CLOSED
    ):
        return rfq
    raise PermissionDenied("Not allowed to view this RFQ")


class RfqListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: RfqSerializer(many=True)}, tags=["rfqs"])
    def get(self, request):
        """Client portal: list of own RFQs (any status)."""
        org = _client_org(request)
        qs = (
            Rfq.objects.filter(client_org=org)
            .prefetch_related("items")
            .order_by("-created_at")
        )
        return Response(RfqSerializer(qs, many=True).data)

    @extend_schema(
        request=RfqCreateSerializer,
        responses={201: RfqSerializer},
        tags=["rfqs"],
    )
    def post(self, request):
        org = _client_org(request)
        ser = RfqCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        rfq = services.create_rfq(client_org=org, by=request.user, **ser.validated_data)
        return Response(RfqSerializer(rfq).data, status=201)


class RfqDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: RfqSerializer}, tags=["rfqs"])
    def get(self, request, rfq_id: int):
        rfq = _visible_rfq(request, rfq_id)
        return Response(RfqSerializer(rfq).data)


class RfqAddItemView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=RfqAddItemSerializer,
        responses={
            201: RfqItemSerializer,
            400: OpenApiResponse(response=RfqErrorSerializer),
        },
        tags=["rfqs"],
    )
    def post(self, request, rfq_id: int):
        org = _client_org(request)
        rfq = get_object_or_404(Rfq, id=rfq_id, client_org=org)
        ser = RfqAddItemSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        master = None
        if data.get("master_product"):
            master = get_object_or_404(MasterProduct, id=data["master_product"])
        try:
            item = services.add_item(
                rfq,
                master_product=master,
                pack_type_code=data.get("pack_type_code", ""),
                quantity=data["quantity"],
                notes=data.get("notes", ""),
                free_text_name=data.get("free_text_name", ""),
                free_text_description=data.get("free_text_description", ""),
                unit=data.get("unit", ""),
                specs_overrides=data.get("specs_overrides") or {},
            )
        except services.RfqError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(RfqItemSerializer(item).data, status=201)


class RfqPublishView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: RfqSerializer,
            400: OpenApiResponse(response=RfqErrorSerializer),
        },
        tags=["rfqs"],
    )
    def post(self, request, rfq_id: int):
        org = _client_org(request)
        rfq = get_object_or_404(Rfq, id=rfq_id, client_org=org)
        try:
            services.publish(rfq)
        except services.RfqError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(RfqSerializer(rfq).data)


class RfqCloseView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: RfqSerializer, 400: OpenApiResponse(response=RfqErrorSerializer)},
        tags=["rfqs"],
    )
    def post(self, request, rfq_id: int):
        org = _client_org(request)
        rfq = get_object_or_404(Rfq, id=rfq_id, client_org=org)
        try:
            services.close(rfq)
        except services.RfqError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(RfqSerializer(rfq).data)


class RfqInboxView(APIView):
    """Supplier inbox: RFQs published and not yet closed/awarded by anyone else.

    For v1 broadcast model this includes any PUBLISHED RFQ. We also show
    AWARDED/CLOSED RFQs the supplier already quoted on so they can see the
    outcome.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: RfqSerializer(many=True)}, tags=["rfqs"])
    def get(self, request):
        org = _supplier_org(request)
        qs = (
            Rfq.objects.filter(
                Q(status=Rfq.Status.PUBLISHED)
                | Q(quotes__supplier_org=org)
            )
            .prefetch_related("items")
            .distinct()
            .order_by("-published_at", "-created_at")
        )
        return Response(RfqSerializer(qs, many=True).data)

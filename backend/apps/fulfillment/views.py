from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.organizations.models import Organization

from . import services
from .models import DeliveryNote, GoodsReceiptNote
from .serializers import (
    CreateDnSerializer,
    DeliveryNoteSerializer,
    FulfillmentErrorSerializer,
    GrnLineUpdateSerializer,
    GrnSerializer,
    ThreeWayMatchSerializer,
)


def _own_org(request) -> Organization:
    return get_object_or_404(Organization, id=request.active_organization_id)


class OrderDeliveryNotesView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: DeliveryNoteSerializer(many=True)},
        tags=["fulfillment"],
    )
    def get(self, request, order_id: int):
        org = _own_org(request)
        order = get_object_or_404(
            Order.objects.filter(Q(client_org=org) | Q(supplier_org=org)),
            id=order_id,
        )
        qs = order.delivery_notes.prefetch_related("items").order_by("-created_at")
        return Response(DeliveryNoteSerializer(qs, many=True).data)

    @extend_schema(
        request=CreateDnSerializer,
        responses={
            201: DeliveryNoteSerializer,
            400: OpenApiResponse(response=FulfillmentErrorSerializer),
        },
        tags=["fulfillment"],
    )
    def post(self, request, order_id: int):
        org = _own_org(request)
        order = get_object_or_404(Order, id=order_id, supplier_org=org)
        ser = CreateDnSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            dn = services.create_dn(
                order=order, by=request.user, lines=ser.validated_data["lines"],
            )
        except services.FulfillmentError as e:
            return Response({"detail": str(e)}, status=400)
        if ser.validated_data.get("notes"):
            dn.notes = ser.validated_data["notes"]
            dn.save(update_fields=["notes"])
        return Response(DeliveryNoteSerializer(dn).data, status=201)


class DnDispatchView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: DeliveryNoteSerializer, 400: OpenApiResponse(response=FulfillmentErrorSerializer)},  # noqa: E501
        tags=["fulfillment"],
    )
    def post(self, request, dn_id: int):
        org = _own_org(request)
        dn = get_object_or_404(DeliveryNote, id=dn_id, supplier_org=org)
        try:
            services.dispatch_dn(dn)
        except services.FulfillmentError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(DeliveryNoteSerializer(dn).data)


class CreateOrGetGrnView(APIView):
    """Client receives a DN — creates (or returns existing) GRN."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: GrnSerializer, 400: OpenApiResponse(response=FulfillmentErrorSerializer)},
        tags=["fulfillment"],
    )
    def post(self, request, dn_id: int):
        org = _own_org(request)
        dn = get_object_or_404(DeliveryNote, id=dn_id, client_org=org)
        try:
            grn = services.create_grn(dn=dn, by=request.user)
        except services.FulfillmentError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(GrnSerializer(grn).data)


class SetGrnLineView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=GrnLineUpdateSerializer,
        responses={200: GrnSerializer, 400: OpenApiResponse(response=FulfillmentErrorSerializer)},
        tags=["fulfillment"],
    )
    def patch(self, request, grn_id: int):
        org = _own_org(request)
        grn = get_object_or_404(GoodsReceiptNote, id=grn_id, client_org=org)
        ser = GrnLineUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            services.set_grn_line(grn=grn, **ser.validated_data)
        except services.FulfillmentError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(GrnSerializer(grn).data)


class CompleteGrnView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: GrnSerializer, 400: OpenApiResponse(response=FulfillmentErrorSerializer)},
        tags=["fulfillment"],
    )
    def post(self, request, grn_id: int):
        org = _own_org(request)
        grn = get_object_or_404(GoodsReceiptNote, id=grn_id, client_org=org)
        try:
            services.complete_grn(grn)
        except services.FulfillmentError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(GrnSerializer(grn).data)


class ThreeWayMatchView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: ThreeWayMatchSerializer}, tags=["fulfillment"])
    def get(self, request, order_id: int):
        org = _own_org(request)
        order = get_object_or_404(
            Order.objects.filter(Q(client_org=org) | Q(supplier_org=org)),
            id=order_id,
        )
        # Strip the ready_for_invoice_qty dict — internal only.
        out = services.three_way_match(order)
        return Response({"matched": out["matched"], "lines": out["lines"]})


class IncomingDeliveriesView(APIView):
    """Client list of inbound DNs."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: DeliveryNoteSerializer(many=True)}, tags=["fulfillment"])
    def get(self, request):
        org = _own_org(request)
        if org.type != Organization.Type.CLIENT:
            raise PermissionDenied("Client-only endpoint")
        qs = (
            DeliveryNote.objects.filter(client_org=org)
            .prefetch_related("items")
            .order_by("-created_at")
        )
        return Response(DeliveryNoteSerializer(qs, many=True).data)


class OutgoingDeliveriesView(APIView):
    """Supplier list of outbound DNs."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: DeliveryNoteSerializer(many=True)}, tags=["fulfillment"])
    def get(self, request):
        org = _own_org(request)
        if org.type != Organization.Type.SUPPLIER:
            raise PermissionDenied("Supplier-only endpoint")
        qs = (
            DeliveryNote.objects.filter(supplier_org=org)
            .prefetch_related("items")
            .order_by("-created_at")
        )
        return Response(DeliveryNoteSerializer(qs, many=True).data)

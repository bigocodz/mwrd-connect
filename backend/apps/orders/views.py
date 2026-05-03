from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Organization

from . import services
from .models import Order
from .serializers import OrderErrorSerializer, OrderSerializer


def _orders_for_viewer(org: Organization):
    """R8 — clients see CPOs (their procurement document), suppliers see
    SPOs (their fulfillment document). JOINT rows from before the dual-PO
    migration are visible to both sides for backwards-compatibility.
    """
    base = Order.objects.prefetch_related("items").order_by("-created_at")
    if org.type == Organization.Type.CLIENT:
        return base.filter(
            Q(client_org=org) & (Q(type=Order.Type.CPO) | Q(type=Order.Type.JOINT))
        )
    if org.type == Organization.Type.SUPPLIER:
        return base.filter(
            Q(supplier_org=org) & (Q(type=Order.Type.SPO) | Q(type=Order.Type.JOINT))
        )
    return Order.objects.none()


class OrderListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OrderSerializer(many=True)}, tags=["orders"])
    def get(self, request):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        return Response(OrderSerializer(_orders_for_viewer(org), many=True).data)


class OrderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OrderSerializer}, tags=["orders"])
    def get(self, request, order_id: int):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        order = get_object_or_404(_orders_for_viewer(org), id=order_id)
        return Response(OrderSerializer(order).data)


class OrderConfirmView(APIView):
    """Supplier-side confirmation of the order."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: OrderSerializer, 400: OpenApiResponse(response=OrderErrorSerializer)},
        tags=["orders"],
    )
    def post(self, request, order_id: int):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        order = get_object_or_404(Order, id=order_id)
        if order.supplier_org_id != org.id:
            raise PermissionDenied("Only the supplier can confirm")
        try:
            services.confirm(order, by=request.user)
        except services.OrderError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(OrderSerializer(order).data)

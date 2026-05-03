from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsStaffWithScope
from apps.orders.models import Order
from apps.organizations.models import Organization

from . import services
from .models import ClientInvoice, SupplierInvoice
from .serializers import (
    ClientInvoiceSerializer,
    InvoicingErrorSerializer,
    SupplierInvoiceSerializer,
)


def _own_org(request) -> Organization:
    return get_object_or_404(Organization, id=request.active_organization_id)


class SupplierInvoiceListView(APIView):
    """Supplier sees their own invoices."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: SupplierInvoiceSerializer(many=True)}, tags=["invoicing"])
    def get(self, request):
        org = _own_org(request)
        if org.type != Organization.Type.SUPPLIER:
            raise PermissionDenied("Supplier-only endpoint")
        qs = (
            SupplierInvoice.objects.filter(supplier_org=org)
            .prefetch_related("items")
            .order_by("-created_at")
        )
        return Response(SupplierInvoiceSerializer(qs, many=True).data)


class SupplierInvoiceCreateFromOrderView(APIView):
    """Supplier raises an invoice once an order is fully GRN-matched."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            201: SupplierInvoiceSerializer,
            400: OpenApiResponse(response=InvoicingErrorSerializer),
        },
        tags=["invoicing"],
    )
    def post(self, request, order_id: int):
        org = _own_org(request)
        order = get_object_or_404(Order, id=order_id, supplier_org=org)
        try:
            si = services.create_supplier_invoice_from_order(order=order)
        except services.InvoicingError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(SupplierInvoiceSerializer(si).data, status=201)


class SupplierInvoiceIssueView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: SupplierInvoiceSerializer,
            400: OpenApiResponse(response=InvoicingErrorSerializer),
        },
        tags=["invoicing"],
    )
    def post(self, request, si_id: int):
        org = _own_org(request)
        si = get_object_or_404(SupplierInvoice, id=si_id, supplier_org=org)
        try:
            services.issue_supplier_invoice(si)
        except services.InvoicingError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(SupplierInvoiceSerializer(si).data)


class StaffGenerateClientInvoiceView(APIView):
    """Staff (or automation) creates the client-facing invoice from a supplier
    invoice. Margin is taken from the client org's `commission_rate` or a
    platform default."""

    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=None,
        responses={
            201: ClientInvoiceSerializer,
            400: OpenApiResponse(response=InvoicingErrorSerializer),
        },
        tags=["staff-invoicing"],
    )
    def post(self, request, si_id: int):
        si = get_object_or_404(SupplierInvoice, id=si_id)
        try:
            ci = services.create_client_invoice_from_supplier_invoice(si=si)
        except services.InvoicingError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(ClientInvoiceSerializer(ci).data, status=201)


class StaffIssueClientInvoiceView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=None,
        responses={
            200: ClientInvoiceSerializer,
            400: OpenApiResponse(response=InvoicingErrorSerializer),
        },
        tags=["staff-invoicing"],
    )
    def post(self, request, ci_id: int):
        ci = get_object_or_404(ClientInvoice, id=ci_id)
        try:
            services.issue_client_invoice(ci)
        except services.InvoicingError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(ClientInvoiceSerializer(ci).data)


class ClientInvoiceListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: ClientInvoiceSerializer(many=True)}, tags=["invoicing"])
    def get(self, request):
        org = _own_org(request)
        if org.type != Organization.Type.CLIENT:
            raise PermissionDenied("Client-only endpoint")
        qs = (
            ClientInvoice.objects.filter(client_org=org)
            .prefetch_related("items")
            .order_by("-created_at")
        )
        return Response(ClientInvoiceSerializer(qs, many=True).data)

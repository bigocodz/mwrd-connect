"""Aggregate selectors. Single endpoint per portal."""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.contracts.models import Contract
from apps.core.permissions import IsStaffWithScope
from apps.invoicing.models import ClientInvoice, SupplierInvoice
from apps.kyc.models import KycSubmission
from apps.orders.models import Order
from apps.organizations.models import Organization
from apps.quotes.models import Quote
from apps.rfqs.models import Rfq


class SummarySerializer(serializers.Serializer):
    """Loose schema — fields differ per role."""
    role = serializers.CharField()
    counts = serializers.DictField()


class CustomerSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: SummarySerializer}, tags=["dashboards"])
    def get(self, request):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        if org.type == Organization.Type.CLIENT:
            counts = {
                "open_rfqs": Rfq.objects.filter(client_org=org, status__in=["DRAFT", "PUBLISHED"]).count(),  # noqa: E501
                "contracts_to_sign": Contract.objects.filter(
                    client_org=org, status="PENDING_SIGNATURES",
                    client_signed_at__isnull=True,
                ).count(),
                "orders_in_flight": Order.objects.filter(
                    client_org=org, status__in=["DRAFT", "CONFIRMED", "IN_FULFILLMENT"],
                ).count(),
                "invoices_to_pay": ClientInvoice.objects.filter(
                    client_org=org, status="ISSUED",
                ).count(),
            }
        else:
            counts = {
                "rfqs_in_inbox": Rfq.objects.filter(status="PUBLISHED").count(),
                "draft_quotes": Quote.objects.filter(supplier_org=org, status="DRAFT").count(),
                "contracts_to_sign": Contract.objects.filter(
                    supplier_org=org, status="PENDING_SIGNATURES",
                    supplier_signed_at__isnull=True,
                ).count(),
                "orders_to_ship": Order.objects.filter(
                    supplier_org=org, status__in=["DRAFT", "CONFIRMED", "IN_FULFILLMENT"],
                ).count(),
                "invoices_unpaid": SupplierInvoice.objects.filter(
                    supplier_org=org, status="ISSUED",
                ).count(),
            }
        return Response({"role": org.type, "counts": counts})


class StaffSummaryView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(responses={200: SummarySerializer}, tags=["staff-dashboards"])
    def get(self, request):
        from apps.catalog.models import ProductAdditionRequest, SupplierProduct

        counts = {
            "kyc_pending_review": KycSubmission.objects.filter(status="SUBMITTED").count(),
            "supplier_listings_pending": SupplierProduct.objects.filter(approval_status="PENDING").count(),  # noqa: E501
            "addition_requests_pending": ProductAdditionRequest.objects.filter(status="PENDING").count(),  # noqa: E501
            "active_orgs": Organization.objects.filter(status="ACTIVE").count(),
            "open_orders": Order.objects.filter(
                status__in=["DRAFT", "CONFIRMED", "IN_FULFILLMENT"],
            ).count(),
            "issued_client_invoices": ClientInvoice.objects.filter(status="ISSUED").count(),
            "issued_supplier_invoices": SupplierInvoice.objects.filter(status="ISSUED").count(),
        }
        return Response({"role": "STAFF", "counts": counts})

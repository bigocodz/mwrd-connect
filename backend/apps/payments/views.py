from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsStaffWithScope
from apps.invoicing.models import ClientInvoice, SupplierInvoice
from apps.organizations.models import Organization

from . import services
from .models import Payment, Payout
from .serializers import (
    PaymentSerializer,
    PaymentsErrorSerializer,
    PayoutSerializer,
    RecordPaymentSerializer,
    RecordPayoutSerializer,
    StatementSerializer,
)


def _own_org(request) -> Organization:
    return get_object_or_404(Organization, id=request.active_organization_id)


class RecordPaymentView(APIView):
    """Client records that they paid one of their invoices.

    For Phase 5: client self-reports the payment (e.g. provides bank reference).
    Staff can also reconcile/override later. PSP integration lands when the
    monetization model is decided.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=RecordPaymentSerializer,
        responses={
            201: PaymentSerializer,
            400: OpenApiResponse(response=PaymentsErrorSerializer),
        },
        tags=["payments"],
    )
    def post(self, request):
        org = _own_org(request)
        if org.type != Organization.Type.CLIENT:
            raise PermissionDenied("Client-only endpoint")
        ser = RecordPaymentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        invoice = get_object_or_404(
            ClientInvoice, id=ser.validated_data["invoice_id"], client_org=org,
        )
        try:
            payment = services.record_payment(
                invoice=invoice,
                amount=ser.validated_data["amount"],
                method=ser.validated_data["method"],
                reference=ser.validated_data["reference"],
                by=request.user,
            )
        except services.PaymentsError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(PaymentSerializer(payment).data, status=201)


class StaffRecordPayoutView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=RecordPayoutSerializer,
        responses={
            201: PayoutSerializer,
            400: OpenApiResponse(response=PaymentsErrorSerializer),
        },
        tags=["staff-payments"],
    )
    def post(self, request):
        ser = RecordPayoutSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        invoice = get_object_or_404(
            SupplierInvoice, id=ser.validated_data["invoice_id"],
        )
        try:
            payout = services.record_payout(
                invoice=invoice,
                amount=ser.validated_data["amount"],
                method=ser.validated_data["method"],
                reference=ser.validated_data["reference"],
                by=request.user,
            )
        except services.PaymentsError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(PayoutSerializer(payout).data, status=201)


class PaymentListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PaymentSerializer(many=True)}, tags=["payments"])
    def get(self, request):
        org = _own_org(request)
        if org.type != Organization.Type.CLIENT:
            raise PermissionDenied("Client-only endpoint")
        qs = Payment.objects.filter(client_org=org).order_by("-paid_at")
        return Response(PaymentSerializer(qs, many=True).data)


class PayoutListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PayoutSerializer(many=True)}, tags=["payments"])
    def get(self, request):
        org = _own_org(request)
        if org.type != Organization.Type.SUPPLIER:
            raise PermissionDenied("Supplier-only endpoint")
        qs = Payout.objects.filter(supplier_org=org).order_by("-paid_at")
        return Response(PayoutSerializer(qs, many=True).data)


class StatementView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: StatementSerializer}, tags=["payments"])
    def get(self, request):
        org = _own_org(request)
        return Response(services.org_statement(organization=org))


# ---------- R13 — Moyasar payment intent endpoints ----------


class CreatePaymentIntentView(APIView):
    """Client kicks off the payment flow against an issued ClientInvoice.
    Returns the Moyasar intent the frontend redirects to.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: dict}, tags=["payments"])
    def post(self, request, invoice_id: int):
        org = _own_org(request)
        if org.type != Organization.Type.CLIENT:
            raise PermissionDenied("Client-only endpoint")
        invoice = get_object_or_404(ClientInvoice, id=invoice_id, client_org=org)
        try:
            data = services.create_payment_intent(
                invoice=invoice,
                callback_url=request.data.get("callback_url", ""),
            )
        except services.PaymentsError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(data)


class CapturePaymentView(APIView):
    """Webhook-equivalent: capture confirms a Moyasar intent and writes
    the Payment row, marking the invoice paid. In stub mode the frontend
    can call this directly after the mock redirect."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={201: PaymentSerializer}, tags=["payments"])
    def post(self, request, invoice_id: int):
        org = _own_org(request)
        if org.type != Organization.Type.CLIENT:
            raise PermissionDenied("Client-only endpoint")
        invoice = get_object_or_404(ClientInvoice, id=invoice_id, client_org=org)
        intent_id = request.data.get("intent_id")
        if not intent_id:
            return Response({"detail": "intent_id is required"}, status=400)
        try:
            payment = services.capture_payment(
                invoice=invoice, intent_id=intent_id, by=request.user,
            )
        except services.PaymentsError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(PaymentSerializer(payment).data, status=201)


class RefundPaymentView(APIView):
    """Staff-initiated refund. Body: `{"amount": "<sar>"}`. Partial allowed."""
    permission_classes = [IsStaffWithScope]

    @extend_schema(responses={200: PaymentSerializer}, tags=["staff-payments"])
    def post(self, request, payment_id: int):
        from decimal import Decimal

        payment = get_object_or_404(Payment, id=payment_id)
        amount = request.data.get("amount")
        if amount is None:
            return Response({"detail": "amount is required"}, status=400)
        try:
            services.refund_payment(payment=payment, amount=Decimal(str(amount)))
        except services.PaymentsError as e:
            return Response({"detail": str(e)}, status=400)
        payment.refresh_from_db()
        return Response(PaymentSerializer(payment).data)

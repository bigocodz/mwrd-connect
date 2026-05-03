from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Organization
from apps.rfqs.models import Rfq

from . import services
from .models import Quote
from .serializers import (
    QuoteErrorSerializer,
    QuoteItemSerializer,
    QuoteSerializer,
    SetItemPriceSerializer,
)


def _supplier_org(request) -> Organization:
    org = get_object_or_404(Organization, id=request.active_organization_id)
    if org.type != Organization.Type.SUPPLIER:
        raise PermissionDenied("Supplier-only endpoint")
    return org


class CreateOrGetQuoteView(APIView):
    """Supplier hits this on an RFQ to start (or resume) a quote."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: QuoteSerializer,
            201: QuoteSerializer,
            400: OpenApiResponse(response=QuoteErrorSerializer),
        },
        tags=["quotes"],
    )
    def post(self, request, rfq_id: int):
        org = _supplier_org(request)
        rfq = get_object_or_404(Rfq, id=rfq_id)
        try:
            quote = services.create_or_get_draft_for_rfq(rfq=rfq, supplier_org=org)
        except services.QuoteError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(QuoteSerializer(quote).data)


class RfqQuotesListView(APIView):
    """List quotes on an RFQ.

    - The client owner sees all non-draft quotes.
    - A supplier sees only their own quote (any status).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: QuoteSerializer(many=True)}, tags=["quotes"])
    def get(self, request, rfq_id: int):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        rfq = get_object_or_404(Rfq, id=rfq_id)
        if rfq.client_org_id == org.id:
            qs = (
                Quote.objects.filter(rfq=rfq)
                .exclude(status=Quote.Status.DRAFT)
                .select_related("supplier_org")
                .prefetch_related("items__rfq_item__master_product")
                .order_by("-submitted_at")
            )
        elif org.type == Organization.Type.SUPPLIER:
            qs = (
                Quote.objects.filter(rfq=rfq, supplier_org=org)
                .prefetch_related("items__rfq_item__master_product")
            )
        else:
            raise PermissionDenied("Not allowed")
        return Response(QuoteSerializer(qs, many=True).data)


class QuoteDetailView(APIView):
    """Visible to the owning supplier, the RFQ's client, or staff."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: QuoteSerializer}, tags=["quotes"])
    def get(self, request, quote_id: int):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        quote = get_object_or_404(Quote, id=quote_id)
        if (
            quote.supplier_org_id != org.id
            and quote.rfq.client_org_id != org.id
        ):
            raise PermissionDenied("Not allowed to view this quote")
        return Response(QuoteSerializer(quote).data)


class QuoteSetItemPriceView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=SetItemPriceSerializer,
        responses={
            200: QuoteItemSerializer,
            400: OpenApiResponse(response=QuoteErrorSerializer),
        },
        tags=["quotes"],
    )
    def patch(self, request, quote_id: int, item_id: int):
        org = _supplier_org(request)
        quote = get_object_or_404(Quote, id=quote_id, supplier_org=org)
        ser = SetItemPriceSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            item = services.set_item_price(quote=quote, item_id=item_id, **ser.validated_data)
        except services.QuoteError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(QuoteItemSerializer(item).data)


class QuoteSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: QuoteSerializer, 400: OpenApiResponse(response=QuoteErrorSerializer)},
        tags=["quotes"],
    )
    def post(self, request, quote_id: int):
        org = _supplier_org(request)
        quote = get_object_or_404(Quote, id=quote_id, supplier_org=org)
        try:
            services.submit(quote)
        except services.QuoteError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(QuoteSerializer(quote).data)


class QuoteWithdrawView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: QuoteSerializer, 400: OpenApiResponse(response=QuoteErrorSerializer)},
        tags=["quotes"],
    )
    def post(self, request, quote_id: int):
        org = _supplier_org(request)
        quote = get_object_or_404(Quote, id=quote_id, supplier_org=org)
        try:
            services.withdraw(quote)
        except services.QuoteError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(QuoteSerializer(quote).data)


class AwardQuoteView(APIView):
    """Client-side: award a specific quote on their RFQ."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: QuoteSerializer,
            400: OpenApiResponse(response=QuoteErrorSerializer),
        },
        tags=["quotes"],
    )
    def post(self, request, rfq_id: int, quote_id: int):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        rfq = get_object_or_404(Rfq, id=rfq_id, client_org=org)
        quote = get_object_or_404(Quote, id=quote_id, rfq=rfq)
        try:
            services.award(quote, by=request.user)
        except services.QuoteError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(QuoteSerializer(quote).data)


class RfqComparisonView(APIView):
    """R7 — Line-item comparison.

    Returns rows×cells: each RFQ item is a row; each SUBMITTED quote is a
    column. The cell shows that supplier's bid for that line (or null if
    they didn't quote it / declined). Suppliers in the response are
    referenced by id only — the AnonymizedOrgNameField on the quotes-list
    elsewhere does the alias swap. Cell prices are final/client-side ONLY.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: dict}, tags=["quotes"])
    def get(self, request, rfq_id: int):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        rfq = get_object_or_404(Rfq, id=rfq_id, client_org=org)
        return Response(services.comparison_view(rfq))


class AwardWithSelectionsView(APIView):
    """R7 — split-award. Body: `{"selections": [<quote_item_id>, ...]}`.

    For each supplier represented in the selections, creates a (possibly
    partial) Contract. Multiple Contracts may result from a single call.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: dict,
            400: OpenApiResponse(response=QuoteErrorSerializer),
        },
        tags=["quotes"],
    )
    def post(self, request, rfq_id: int):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        rfq = get_object_or_404(Rfq, id=rfq_id, client_org=org)
        selections = request.data.get("selections") or []
        if not isinstance(selections, list) or not all(isinstance(s, int) for s in selections):
            return Response(
                {"detail": "`selections` must be a list of quote_item ids"},
                status=400,
            )
        try:
            contracts = services.award_with_selections(
                rfq, selections=selections, by=request.user,
            )
        except services.QuoteError as e:
            return Response({"detail": str(e)}, status=400)
        return Response({
            "rfq_status": rfq.status,
            "contract_ids": [c.id for c in contracts],
        })

from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Organization

from . import services
from .models import Contract
from .serializers import ContractErrorSerializer, ContractSerializer


def _get_for_org(request, contract_id: int) -> Contract:
    org = get_object_or_404(Organization, id=request.active_organization_id)
    contract = get_object_or_404(
        Contract.objects.filter(Q(client_org=org) | Q(supplier_org=org)),
        id=contract_id,
    )
    return contract


class ContractListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: ContractSerializer(many=True)}, tags=["contracts"])
    def get(self, request):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        qs = (
            Contract.objects
            .filter(Q(client_org=org) | Q(supplier_org=org))
            .prefetch_related("items")
            .order_by("-created_at")
        )
        return Response(ContractSerializer(qs, many=True).data)


class ContractDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: ContractSerializer}, tags=["contracts"])
    def get(self, request, contract_id: int):
        return Response(ContractSerializer(_get_for_org(request, contract_id)).data)


class ContractSignClientView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: ContractSerializer, 400: OpenApiResponse(response=ContractErrorSerializer)},
        tags=["contracts"],
    )
    def post(self, request, contract_id: int):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        contract = get_object_or_404(Contract, id=contract_id)
        if contract.client_org_id != org.id:
            raise PermissionDenied("Only the client org can sign as client")
        try:
            services.sign_as_client(contract, by=request.user)
        except services.ContractError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(ContractSerializer(contract).data)


class ContractSignSupplierView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: ContractSerializer, 400: OpenApiResponse(response=ContractErrorSerializer)},
        tags=["contracts"],
    )
    def post(self, request, contract_id: int):
        org = get_object_or_404(Organization, id=request.active_organization_id)
        contract = get_object_or_404(Contract, id=contract_id)
        if contract.supplier_org_id != org.id:
            raise PermissionDenied("Only the supplier org can sign as supplier")
        try:
            services.sign_as_supplier(contract, by=request.user)
        except services.ContractError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(ContractSerializer(contract).data)

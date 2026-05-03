"""R10 — shopping endpoints (favourites, company catalogs, carts).

All client-portal — no staff endpoints. Each view enforces tenant scoping
via `request.active_organization_id`.
"""
from __future__ import annotations

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import MasterProduct
from apps.organizations.models import Organization
from apps.rfqs.serializers import RfqSerializer

from . import services
from .models import Cart, CompanyCatalog, Favourite
from .serializers import (
    AddCartItemSerializer,
    CartSerializer,
    CompanyCatalogSerializer,
    FavouriteSerializer,
    SaveCartSerializer,
    ShoppingErrorSerializer,
    SubmitCartSerializer,
)

# Reused inline OpenAPI body schema for endpoints that take a single
# master-product id. Pulled out so the line-length linter is happy.
_MASTER_PRODUCT_ID_BODY = {
    "type": "object",
    "properties": {"master_product_id": {"type": "integer"}},
}


def _client_org(request) -> Organization:
    org = get_object_or_404(Organization, id=request.active_organization_id)
    if org.type != Organization.Type.CLIENT:
        raise PermissionDenied("Client-only endpoint")
    return org


# ---------- Favourites ----------


class FavouritesListAddView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: FavouriteSerializer(many=True)}, tags=["shopping"])
    def get(self, request):
        qs = Favourite.objects.filter(user=request.user).select_related("master_product")
        return Response(FavouriteSerializer(qs, many=True).data)

    @extend_schema(
        request={"application/json": _MASTER_PRODUCT_ID_BODY},
        responses={201: FavouriteSerializer},
        tags=["shopping"],
    )
    def post(self, request):
        mp_id = request.data.get("master_product_id")
        master = get_object_or_404(MasterProduct, id=mp_id)
        fav = services.add_favourite(user=request.user, master_product=master)
        return Response(FavouriteSerializer(fav).data, status=201)


class FavouriteDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None}, tags=["shopping"])
    def delete(self, request, master_product_id: int):
        services.remove_favourite(user=request.user, master_product_id=master_product_id)
        return Response(status=204)


# ---------- Company catalogs ----------


class CompanyCatalogListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CompanyCatalogSerializer(many=True)}, tags=["shopping"])
    def get(self, request):
        org = _client_org(request)
        qs = CompanyCatalog.objects.filter(organization=org).prefetch_related(
            "items__master_product",
        )
        return Response(CompanyCatalogSerializer(qs, many=True).data)

    @extend_schema(
        responses={
            201: CompanyCatalogSerializer,
            400: OpenApiResponse(response=ShoppingErrorSerializer),
        },
        tags=["shopping"],
    )
    def post(self, request):
        org = _client_org(request)
        try:
            cat = services.create_company_catalog(
                organization=org,
                name=request.data.get("name", ""),
                description=request.data.get("description", ""),
                by=request.user,
            )
        except services.ShoppingError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(CompanyCatalogSerializer(cat).data, status=201)


class CompanyCatalogDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CompanyCatalogSerializer}, tags=["shopping"])
    def get(self, request, catalog_id: int):
        org = _client_org(request)
        cat = get_object_or_404(CompanyCatalog, id=catalog_id, organization=org)
        return Response(CompanyCatalogSerializer(cat).data)

    @extend_schema(responses={204: None}, tags=["shopping"])
    def delete(self, request, catalog_id: int):
        org = _client_org(request)
        cat = get_object_or_404(CompanyCatalog, id=catalog_id, organization=org)
        cat.delete()
        return Response(status=204)


class CompanyCatalogItemsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request={"application/json": _MASTER_PRODUCT_ID_BODY},
        responses={201: CompanyCatalogSerializer},
        tags=["shopping"],
    )
    def post(self, request, catalog_id: int):
        org = _client_org(request)
        cat = get_object_or_404(CompanyCatalog, id=catalog_id, organization=org)
        master = get_object_or_404(MasterProduct, id=request.data.get("master_product_id"))
        services.add_to_company_catalog(catalog=cat, master_product=master)
        return Response(CompanyCatalogSerializer(cat).data, status=201)

    @extend_schema(responses={204: None}, tags=["shopping"])
    def delete(self, request, catalog_id: int, master_product_id: int):
        org = _client_org(request)
        cat = get_object_or_404(CompanyCatalog, id=catalog_id, organization=org)
        services.remove_from_company_catalog(catalog=cat, master_product_id=master_product_id)
        return Response(status=204)


# ---------- Cart ----------


class ActiveCartView(APIView):
    """GET — current active cart. POST — add item."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CartSerializer}, tags=["shopping"])
    def get(self, request):
        org = _client_org(request)
        cart = services.get_or_create_active_cart(user=request.user, organization=org)
        return Response(CartSerializer(cart).data)

    @extend_schema(
        request=AddCartItemSerializer,
        responses={
            201: CartSerializer,
            400: OpenApiResponse(response=ShoppingErrorSerializer),
        },
        tags=["shopping"],
    )
    def post(self, request):
        org = _client_org(request)
        ser = AddCartItemSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cart = services.get_or_create_active_cart(user=request.user, organization=org)
        master = get_object_or_404(MasterProduct, id=ser.validated_data["master_product"])
        try:
            services.add_to_cart(
                cart=cart, master_product=master,
                pack_type_code=ser.validated_data["pack_type_code"],
                quantity=ser.validated_data["quantity"],
                notes=ser.validated_data.get("notes", ""),
            )
        except services.ShoppingError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(CartSerializer(cart).data, status=201)


class CartItemDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None}, tags=["shopping"])
    def delete(self, request, item_id: int):
        org = _client_org(request)
        cart = services.get_or_create_active_cart(user=request.user, organization=org)
        services.remove_from_cart(cart=cart, item_id=item_id)
        return Response(status=204)


class SaveCartView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=SaveCartSerializer,
        responses={
            200: CartSerializer,
            400: OpenApiResponse(response=ShoppingErrorSerializer),
        },
        tags=["shopping"],
    )
    def post(self, request):
        org = _client_org(request)
        cart = services.get_or_create_active_cart(user=request.user, organization=org)
        ser = SaveCartSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            services.save_cart(cart=cart, name=ser.validated_data["name"])
        except services.ShoppingError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(CartSerializer(cart).data)


class SavedCartsListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CartSerializer(many=True)}, tags=["shopping"])
    def get(self, request):
        org = _client_org(request)
        qs = (
            Cart.objects.filter(
                user=request.user, organization=org, status=Cart.Status.SAVED,
            )
            .prefetch_related("items__master_product")
            .order_by("-created_at")
        )
        return Response(CartSerializer(qs, many=True).data)


class ResumeCartView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CartSerializer}, tags=["shopping"])
    def post(self, request, cart_id: int):
        org = _client_org(request)
        cart = get_object_or_404(
            Cart, id=cart_id, user=request.user, organization=org,
        )
        try:
            services.resume_cart(cart=cart, user=request.user, organization=org)
        except services.ShoppingError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(CartSerializer(cart).data)


class SubmitCartView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=SubmitCartSerializer,
        responses={
            201: RfqSerializer,
            400: OpenApiResponse(response=ShoppingErrorSerializer),
        },
        tags=["shopping"],
    )
    def post(self, request, cart_id: int):
        org = _client_org(request)
        cart = get_object_or_404(
            Cart, id=cart_id, user=request.user, organization=org,
        )
        ser = SubmitCartSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            rfq = services.submit_cart_as_rfq(
                cart=cart, user=request.user, **ser.validated_data,
            )
        except services.ShoppingError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(RfqSerializer(rfq).data, status=201)

"""Catalog endpoints.

Public-ish (any authenticated customer):
    GET  /api/catalog/categories
    GET  /api/catalog/products            ?q=&category_id=&limit=
    GET  /api/catalog/products/<id>
    GET  /api/catalog/bundles

Supplier (org owner/admin):
    GET    /api/catalog/supplier/products            (own org's listings)
    POST   /api/catalog/supplier/products
    PATCH  /api/catalog/supplier/products/<id>
    DELETE /api/catalog/supplier/products/<id>
    POST   /api/catalog/supplier/products/<id>/submit
    GET    /api/catalog/supplier/addition-requests
    POST   /api/catalog/supplier/addition-requests
    POST   /api/catalog/supplier/uploads             (signed PUT URL for images)

Staff (admin portal):
    POST   /api/staff/catalog/categories
    POST   /api/staff/catalog/products
    PATCH  /api/staff/catalog/products/<id>
    POST   /api/staff/catalog/products/<id>/deprecate
    GET    /api/staff/catalog/supplier-products      (review queue)
    POST   /api/staff/catalog/supplier-products/<id>/approve
    POST   /api/staff/catalog/supplier-products/<id>/reject
    GET    /api/staff/catalog/addition-requests
    POST   /api/staff/catalog/addition-requests/<id>/approve
    POST   /api/staff/catalog/addition-requests/<id>/reject
    POST   /api/staff/catalog/bundles
"""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsOrgRole, IsStaffWithScope
from apps.core.storage import signed_upload_url
from apps.organizations.models import Membership, Organization

from . import services
from .models import (
    Bundle,
    Category,
    MasterProduct,
    ProductAdditionRequest,
    SupplierProduct,
)
from .serializers import (
    BundleCreateSerializer,
    BundleSerializer,
    CatalogErrorSerializer,
    CategoryCreateSerializer,
    CategorySerializer,
    MasterProductSerializer,
    NotesSerializer,
    ProductAdditionRequestSerializer,
    ReasonSerializer,
    SignedImageUploadRequest,
    SignedImageUploadResponse,
    SupplierProductSerializer,
)


class CanManageCatalog(IsOrgRole):
    """Owners and admins of supplier orgs can manage their listings."""
    roles = (Membership.Role.OWNER, Membership.Role.ADMIN)


def _supplier_org(request) -> Organization:
    org = get_object_or_404(Organization, id=request.active_organization_id)
    if org.type != Organization.Type.SUPPLIER:
        raise PermissionDenied("Supplier-only endpoint")
    return org


# ---------- Customer-facing browse ----------


class CategoryListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CategorySerializer(many=True)}, tags=["catalog"])
    def get(self, request):
        qs = Category.objects.filter(is_active=True).order_by(
            "level", "display_order", "name_en"
        )
        return Response(CategorySerializer(qs, many=True).data)


class MasterProductSearchView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("q", str, OpenApiParameter.QUERY, required=False),
            OpenApiParameter("category_id", int, OpenApiParameter.QUERY, required=False),
            OpenApiParameter("limit", int, OpenApiParameter.QUERY, required=False),
        ],
        responses={200: MasterProductSerializer(many=True)},
        tags=["catalog"],
    )
    def get(self, request):
        q = request.query_params.get("q") or None
        category_id = request.query_params.get("category_id")
        try:
            category_id_int = int(category_id) if category_id else None
        except ValueError:
            category_id_int = None
        try:
            limit = min(int(request.query_params.get("limit", 50)), 200)
        except ValueError:
            limit = 50
        qs = services.search_master_products(
            q=q, category_id=category_id_int, limit=limit
        )
        return Response(MasterProductSerializer(qs, many=True).data)


class MasterProductDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: MasterProductSerializer}, tags=["catalog"])
    def get(self, request, mp_id: int):
        # Customers only see ACTIVE master products. Deprecated SKU ids
        # are visible only via the staff list view.
        mp = get_object_or_404(
            MasterProduct, id=mp_id, status=MasterProduct.Status.ACTIVE,
        )
        return Response(MasterProductSerializer(mp).data)


class BundleListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: BundleSerializer(many=True)}, tags=["catalog"])
    def get(self, request):
        qs = (
            Bundle.objects.filter(status=Bundle.Status.ACTIVE)
            .prefetch_related("items")
            .order_by("display_order", "name_en")
        )
        return Response(BundleSerializer(qs, many=True).data)


# ---------- Supplier views ----------


class SupplierProductListCreateView(APIView):
    permission_classes = [IsAuthenticated, CanManageCatalog]

    @extend_schema(responses={200: SupplierProductSerializer(many=True)}, tags=["catalog-supplier"])
    def get(self, request):
        org = _supplier_org(request)
        qs = (
            SupplierProduct.objects.filter(organization=org)
            .select_related("master_product")
            .order_by("-created_at")
        )
        return Response(SupplierProductSerializer(qs, many=True).data)

    @extend_schema(
        request=SupplierProductSerializer,
        responses={
            201: SupplierProductSerializer,
            400: OpenApiResponse(response=CatalogErrorSerializer),
        },
        tags=["catalog-supplier"],
    )
    def post(self, request):
        org = _supplier_org(request)
        ser = SupplierProductSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        master_id = ser.validated_data.pop("master_product").id
        master = get_object_or_404(MasterProduct, id=master_id)
        sp = services.create_supplier_product(
            organization=org, master_product=master, **ser.validated_data
        )
        return Response(SupplierProductSerializer(sp).data, status=201)


class SupplierProductDetailView(APIView):
    permission_classes = [IsAuthenticated, CanManageCatalog]

    def _get(self, request, sp_id: int) -> SupplierProduct:
        org = _supplier_org(request)
        return get_object_or_404(SupplierProduct, id=sp_id, organization=org)

    @extend_schema(responses={200: SupplierProductSerializer}, tags=["catalog-supplier"])
    def get(self, request, sp_id: int):
        return Response(SupplierProductSerializer(self._get(request, sp_id)).data)

    @extend_schema(
        request=SupplierProductSerializer,
        responses={200: SupplierProductSerializer},
        tags=["catalog-supplier"],
    )
    def patch(self, request, sp_id: int):
        sp = self._get(request, sp_id)
        ser = SupplierProductSerializer(sp, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(SupplierProductSerializer(sp).data)

    @extend_schema(responses={204: None}, tags=["catalog-supplier"])
    def delete(self, request, sp_id: int):
        sp = self._get(request, sp_id)
        if sp.approval_status not in (
            SupplierProduct.Approval.DRAFT,
            SupplierProduct.Approval.REJECTED,
        ):
            return Response({"detail": "Cannot delete an active listing"}, status=400)
        sp.delete()
        return Response(status=204)


class SupplierProductSubmitView(APIView):
    permission_classes = [IsAuthenticated, CanManageCatalog]

    @extend_schema(
        request=None,
        responses={
            200: SupplierProductSerializer,
            400: OpenApiResponse(response=CatalogErrorSerializer),
        },
        tags=["catalog-supplier"],
    )
    def post(self, request, sp_id: int):
        org = _supplier_org(request)
        sp = get_object_or_404(SupplierProduct, id=sp_id, organization=org)
        try:
            sp = services.submit_supplier_product(sp)
        except services.CatalogError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(SupplierProductSerializer(sp).data)


class SupplierAdditionRequestListCreateView(APIView):
    permission_classes = [IsAuthenticated, CanManageCatalog]

    @extend_schema(
        responses={200: ProductAdditionRequestSerializer(many=True)},
        tags=["catalog-supplier"],
    )
    def get(self, request):
        org = _supplier_org(request)
        qs = ProductAdditionRequest.objects.filter(organization=org).order_by("-created_at")
        return Response(ProductAdditionRequestSerializer(qs, many=True).data)

    @extend_schema(
        request=ProductAdditionRequestSerializer,
        responses={201: ProductAdditionRequestSerializer},
        tags=["catalog-supplier"],
    )
    def post(self, request):
        org = _supplier_org(request)
        ser = ProductAdditionRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        req = services.create_product_addition_request(
            organization=org, **ser.validated_data
        )
        return Response(ProductAdditionRequestSerializer(req).data, status=201)


class CatalogImageUploadView(APIView):
    """Returns a signed PUT URL for catalog image uploads."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=SignedImageUploadRequest,
        responses={200: SignedImageUploadResponse},
        tags=["catalog"],
    )
    def post(self, request):
        ser = SignedImageUploadRequest(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        key = services.make_image_key(
            owner=d["owner"], owner_id=d["owner_id"], filename=d["filename"]
        )
        upload = signed_upload_url(key, d["content_type"])
        return Response({"upload": upload, "storage_key": key})


# ---------- Staff (admin portal) views ----------


class StaffCategoryCreateView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=CategoryCreateSerializer,
        responses={
            201: CategorySerializer,
            400: OpenApiResponse(response=CatalogErrorSerializer),
        },
        tags=["staff-catalog"],
    )
    def post(self, request):
        ser = CategoryCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            cat = services.create_category(**d)
        except services.CatalogError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(CategorySerializer(cat).data, status=201)


class StaffMasterProductListCreateView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(responses={200: MasterProductSerializer(many=True)}, tags=["staff-catalog"])
    def get(self, request):
        qs = MasterProduct.objects.select_related("category").order_by("-created_at")
        return Response(MasterProductSerializer(qs, many=True).data)

    @extend_schema(
        request=MasterProductSerializer,
        responses={201: MasterProductSerializer},
        tags=["staff-catalog"],
    )
    def post(self, request):
        ser = MasterProductSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        mp = services.create_master_product(by=request.user, **ser.validated_data)
        return Response(MasterProductSerializer(mp).data, status=201)


class StaffMasterProductDetailView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=MasterProductSerializer,
        responses={200: MasterProductSerializer},
        tags=["staff-catalog"],
    )
    def patch(self, request, mp_id: int):
        mp = get_object_or_404(MasterProduct, id=mp_id)
        ser = MasterProductSerializer(mp, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        mp = services.update_master_product(mp, **ser.validated_data)
        return Response(MasterProductSerializer(mp).data)


class StaffMasterProductDeprecateView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=ReasonSerializer,
        responses={200: MasterProductSerializer},
        tags=["staff-catalog"],
    )
    def post(self, request, mp_id: int):
        ser = ReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        mp = get_object_or_404(MasterProduct, id=mp_id)
        services.deprecate_master_product(mp, reason=ser.validated_data["reason"])
        return Response(MasterProductSerializer(mp).data)


class StaffSupplierProductReviewListView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(responses={200: SupplierProductSerializer(many=True)}, tags=["staff-catalog"])
    def get(self, request):
        qs = (
            SupplierProduct.objects.filter(approval_status=SupplierProduct.Approval.PENDING)
            .select_related("organization", "master_product")
            .order_by("created_at")
        )
        return Response(SupplierProductSerializer(qs, many=True).data)


class StaffSupplierProductApproveView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=None,
        responses={
            200: SupplierProductSerializer,
            400: OpenApiResponse(response=CatalogErrorSerializer),
        },
        tags=["staff-catalog"],
    )
    def post(self, request, sp_id: int):
        sp = get_object_or_404(SupplierProduct, id=sp_id)
        try:
            services.approve_supplier_product(sp)
        except services.CatalogError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(SupplierProductSerializer(sp).data)


class StaffSupplierProductRejectView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=ReasonSerializer,
        responses={
            200: SupplierProductSerializer,
            400: OpenApiResponse(response=CatalogErrorSerializer),
        },
        tags=["staff-catalog"],
    )
    def post(self, request, sp_id: int):
        ser = ReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        sp = get_object_or_404(SupplierProduct, id=sp_id)
        try:
            services.reject_supplier_product(sp, reason=ser.validated_data["reason"])
        except services.CatalogError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(SupplierProductSerializer(sp).data)


class StaffAdditionRequestListView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        responses={200: ProductAdditionRequestSerializer(many=True)},
        tags=["staff-catalog"],
    )
    def get(self, request):
        qs = (
            ProductAdditionRequest.objects.filter(
                status=ProductAdditionRequest.Status.PENDING
            )
            .select_related("organization", "category")
            .order_by("created_at")
        )
        return Response(ProductAdditionRequestSerializer(qs, many=True).data)


class StaffAdditionRequestApproveView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=NotesSerializer,
        responses={
            200: ProductAdditionRequestSerializer,
            400: OpenApiResponse(response=CatalogErrorSerializer),
        },
        tags=["staff-catalog"],
    )
    def post(self, request, req_id: int):
        ser = NotesSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        req = get_object_or_404(ProductAdditionRequest, id=req_id)
        try:
            services.approve_product_addition_request(
                req, by=request.user, admin_notes=ser.validated_data.get("notes", "")
            )
        except services.CatalogError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(ProductAdditionRequestSerializer(req).data)


class StaffAdditionRequestRejectView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=ReasonSerializer,
        responses={
            200: ProductAdditionRequestSerializer,
            400: OpenApiResponse(response=CatalogErrorSerializer),
        },
        tags=["staff-catalog"],
    )
    def post(self, request, req_id: int):
        ser = ReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        req = get_object_or_404(ProductAdditionRequest, id=req_id)
        try:
            services.reject_product_addition_request(
                req, by=request.user, reason=ser.validated_data["reason"]
            )
        except services.CatalogError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(ProductAdditionRequestSerializer(req).data)


class StaffBundleCreateView(APIView):
    permission_classes = [IsStaffWithScope]

    @extend_schema(
        request=BundleCreateSerializer,
        responses={201: BundleSerializer},
        tags=["staff-catalog"],
    )
    def post(self, request):
        ser = BundleCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        items = ser.validated_data.pop("items")
        category_id = ser.validated_data.pop("category", None)
        bundle = services.create_bundle_with_items(
            by=request.user,
            items=items,
            category_id=category_id,
            **ser.validated_data,
        )
        return Response(BundleSerializer(bundle).data, status=201)

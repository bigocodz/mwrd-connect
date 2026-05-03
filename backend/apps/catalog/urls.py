from django.urls import path

from .views import (
    BundleListView,
    CatalogImageUploadView,
    CategoryListView,
    MasterProductDetailView,
    MasterProductSearchView,
    StaffAdditionRequestApproveView,
    StaffAdditionRequestListView,
    StaffAdditionRequestRejectView,
    StaffBundleCreateView,
    StaffCategoryCreateView,
    StaffMasterProductDeprecateView,
    StaffMasterProductDetailView,
    StaffMasterProductListCreateView,
    StaffSupplierProductApproveView,
    StaffSupplierProductRejectView,
    StaffSupplierProductReviewListView,
    SupplierAdditionRequestListCreateView,
    SupplierProductDetailView,
    SupplierProductListCreateView,
    SupplierProductSubmitView,
)

# Customer-facing browse — mounted at /api/catalog/
customer_patterns = [
    path("categories", CategoryListView.as_view()),
    path("products", MasterProductSearchView.as_view()),
    path("products/<int:mp_id>", MasterProductDetailView.as_view()),
    path("bundles", BundleListView.as_view()),
    # Supplier-side endpoints (the supplier portal only — guarded by org type)
    path("supplier/products", SupplierProductListCreateView.as_view()),
    path("supplier/products/<int:sp_id>", SupplierProductDetailView.as_view()),
    path("supplier/products/<int:sp_id>/submit", SupplierProductSubmitView.as_view()),
    path("supplier/addition-requests", SupplierAdditionRequestListCreateView.as_view()),
    path("supplier/uploads", CatalogImageUploadView.as_view()),
]

# Staff (admin portal) — mounted at /api/staff/catalog/
staff_patterns = [
    path("categories", StaffCategoryCreateView.as_view()),
    path("products", StaffMasterProductListCreateView.as_view()),
    path("products/<int:mp_id>", StaffMasterProductDetailView.as_view()),
    path("products/<int:mp_id>/deprecate", StaffMasterProductDeprecateView.as_view()),
    path("supplier-products", StaffSupplierProductReviewListView.as_view()),
    path("supplier-products/<int:sp_id>/approve", StaffSupplierProductApproveView.as_view()),
    path("supplier-products/<int:sp_id>/reject", StaffSupplierProductRejectView.as_view()),
    path("addition-requests", StaffAdditionRequestListView.as_view()),
    path("addition-requests/<int:req_id>/approve", StaffAdditionRequestApproveView.as_view()),
    path("addition-requests/<int:req_id>/reject", StaffAdditionRequestRejectView.as_view()),
    path("bundles", StaffBundleCreateView.as_view()),
]

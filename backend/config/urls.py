from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.audit.urls import customer_patterns as audit_customer_patterns
from apps.audit.urls import staff_patterns as audit_staff_patterns
from apps.catalog.urls import customer_patterns as catalog_customer_patterns
from apps.catalog.urls import staff_patterns as catalog_staff_patterns
from apps.dashboards.urls import customer_patterns as dashboards_customer_patterns
from apps.dashboards.urls import staff_patterns as dashboards_staff_patterns
from apps.dataops.urls import customer_patterns as dataops_customer_patterns
from apps.dataops.urls import staff_patterns as dataops_staff_patterns
from apps.fulfillment.urls import order_patterns as fulfillment_order_patterns
from apps.fulfillment.urls import urlpatterns as fulfillment_top_patterns
from apps.invoicing.urls import customer_patterns as invoicing_customer_patterns
from apps.invoicing.urls import order_patterns as invoicing_order_patterns
from apps.invoicing.urls import staff_patterns as invoicing_staff_patterns
from apps.kyc.urls import customer_patterns as kyc_customer_patterns
from apps.kyc.urls import staff_patterns as kyc_staff_patterns
from apps.payments.urls import customer_patterns as payments_customer_patterns
from apps.payments.urls import staff_patterns as payments_staff_patterns
from apps.approvals.urls import customer_patterns as approvals_customer_patterns
from apps.pricing.urls import staff_patterns as pricing_staff_patterns
from apps.shopping.urls import customer_patterns as shopping_customer_patterns
from apps.quotes.urls import (
    quote_patterns,
    rfq_quote_patterns,
    staff_quote_patterns,
)

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/orgs/", include("apps.organizations.urls")),
    path("api/kyc/", include(kyc_customer_patterns)),
    path("api/catalog/", include(catalog_customer_patterns)),
    path("api/rfqs/", include("apps.rfqs.urls")),
    path("api/rfqs/", include(rfq_quote_patterns)),
    path("api/quotes/", include(quote_patterns)),
    path("api/contracts/", include("apps.contracts.urls")),
    path("api/orders/", include("apps.orders.urls")),
    path("api/orders/", include(fulfillment_order_patterns)),
    path("api/orders/", include(invoicing_order_patterns)),
    path("api/", include(fulfillment_top_patterns)),
    path("api/", include(invoicing_customer_patterns)),
    path("api/", include(payments_customer_patterns)),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.comments.urls")),
    path("api/", include(audit_customer_patterns)),
    path("api/", include(dashboards_customer_patterns)),
    path("api/", include("apps.integrations.wathq.urls")),
    path("api/", include("apps.integrations.spl.urls")),
    path("api/", include(dataops_customer_patterns)),
    path("api/", include(approvals_customer_patterns)),
    path("api/", include(shopping_customer_patterns)),
    path("api/staff/", include("apps.ops.urls")),
    path("api/staff/kyc/", include(kyc_staff_patterns)),
    path("api/staff/catalog/", include(catalog_staff_patterns)),
    path("api/staff/", include(invoicing_staff_patterns)),
    path("api/staff/", include(payments_staff_patterns)),
    path("api/staff/", include(audit_staff_patterns)),
    path("api/staff/", include(dashboards_staff_patterns)),
    path("api/staff/", include(dataops_staff_patterns)),
    path("api/staff/", include(pricing_staff_patterns)),
    path("api/staff/", include(staff_quote_patterns)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

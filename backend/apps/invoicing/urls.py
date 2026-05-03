from django.urls import path

from .views import (
    ClientInvoiceListView,
    StaffGenerateClientInvoiceView,
    StaffIssueClientInvoiceView,
    SupplierInvoiceCreateFromOrderView,
    SupplierInvoiceIssueView,
    SupplierInvoiceListView,
)

# Customer-facing
customer_patterns = [
    path("supplier-invoices", SupplierInvoiceListView.as_view()),
    path("supplier-invoices/<int:si_id>/issue", SupplierInvoiceIssueView.as_view()),
    path("client-invoices", ClientInvoiceListView.as_view()),
]

# Per-order
order_patterns = [
    path("<int:order_id>/supplier-invoice", SupplierInvoiceCreateFromOrderView.as_view()),
]

# Staff-only
staff_patterns = [
    path(
        "supplier-invoices/<int:si_id>/generate-client-invoice",
        StaffGenerateClientInvoiceView.as_view(),
    ),
    path("client-invoices/<int:ci_id>/issue", StaffIssueClientInvoiceView.as_view()),
]

from django.urls import path

from .views import OrgAuditView, StaffAuditSearchView

customer_patterns = [
    path("audit", OrgAuditView.as_view()),
]

staff_patterns = [
    path("audit", StaffAuditSearchView.as_view()),
]

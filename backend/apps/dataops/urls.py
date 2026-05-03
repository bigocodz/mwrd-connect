from django.urls import path

from .views import ExportMyOrgView, StaffPurgeOrgView

customer_patterns = [
    path("export", ExportMyOrgView.as_view()),
]

staff_patterns = [
    path("purge", StaffPurgeOrgView.as_view()),
]

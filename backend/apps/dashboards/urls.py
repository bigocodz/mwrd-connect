from django.urls import path

from .views import CustomerSummaryView, StaffSummaryView

customer_patterns = [
    path("dashboard/summary", CustomerSummaryView.as_view()),
]

staff_patterns = [
    path("dashboard/summary", StaffSummaryView.as_view()),
]

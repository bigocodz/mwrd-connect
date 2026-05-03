from django.urls import path

from .views import (
    StaffDeleteMarginView,
    StaffMarginListView,
    StaffSetCategoryMarginView,
    StaffSetClientMarginView,
    StaffSetGlobalMarginView,
)

# All routes are staff-only — mount under /api/staff/.
staff_patterns = [
    path("margins", StaffMarginListView.as_view()),
    path("margins/global", StaffSetGlobalMarginView.as_view()),
    path("margins/category", StaffSetCategoryMarginView.as_view()),
    path("margins/client", StaffSetClientMarginView.as_view()),
    path("margins/<int:margin_id>", StaffDeleteMarginView.as_view()),
]

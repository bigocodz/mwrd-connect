from django.urls import path

from .views import (
    ApprovalTreeView,
    DecideApprovalTaskView,
    MyApprovalTasksView,
)

# Mounted under /api/
customer_patterns = [
    path("approvals/tree", ApprovalTreeView.as_view()),
    path("approvals/tasks", MyApprovalTasksView.as_view()),
    path("approvals/tasks/<int:task_id>/decide", DecideApprovalTaskView.as_view()),
]

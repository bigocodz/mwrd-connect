from django.urls import path

from .views import (
    AttachDocumentView,
    CurrentSubmissionView,
    DeleteDocumentView,
    SignedUploadView,
    StaffApproveView,
    StaffQueueView,
    StaffRejectView,
    StaffRequestChangesView,
    StaffSubmissionDetailView,
    SubmitForReviewView,
)

# Customer-facing routes (mounted at /api/kyc/)
customer_patterns = [
    path("current", CurrentSubmissionView.as_view()),
    path("current/uploads", SignedUploadView.as_view()),
    path("current/documents", AttachDocumentView.as_view()),
    path("current/documents/<int:doc_id>", DeleteDocumentView.as_view()),
    path("current/submit", SubmitForReviewView.as_view()),
]

# Staff-only routes (mounted at /api/staff/kyc/)
staff_patterns = [
    path("queue", StaffQueueView.as_view()),
    path("<int:submission_id>", StaffSubmissionDetailView.as_view()),
    path("<int:submission_id>/approve", StaffApproveView.as_view()),
    path("<int:submission_id>/request-changes", StaffRequestChangesView.as_view()),
    path("<int:submission_id>/reject", StaffRejectView.as_view()),
]

from django.urls import path

from .views import (
    CapturePaymentView,
    CreatePaymentIntentView,
    PaymentListView,
    PayoutListView,
    RecordPaymentView,
    RefundPaymentView,
    StaffRecordPayoutView,
    StatementView,
)

customer_patterns = [
    path("payments", PaymentListView.as_view()),
    path("payments/record", RecordPaymentView.as_view()),
    # R13 — Moyasar payment intents.
    path("invoices/<int:invoice_id>/payment-intent", CreatePaymentIntentView.as_view()),
    path("invoices/<int:invoice_id>/payment-capture", CapturePaymentView.as_view()),
    path("payouts", PayoutListView.as_view()),
    path("statement", StatementView.as_view()),
]

staff_patterns = [
    path("payouts/record", StaffRecordPayoutView.as_view()),
    path("payments/<int:payment_id>/refund", RefundPaymentView.as_view()),
]

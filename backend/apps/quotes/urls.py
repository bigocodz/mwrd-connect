from django.urls import path

from .staff_views import (
    StaffPendingQuotesView,
    StaffRejectQuoteView,
    StaffReleaseQuoteView,
)
from .views import (
    AwardQuoteView,
    AwardWithSelectionsView,
    CreateOrGetQuoteView,
    QuoteDetailView,
    QuoteSetItemPriceView,
    QuoteSubmitView,
    QuoteWithdrawView,
    RfqComparisonView,
    RfqQuotesListView,
)

# Mounted at /api/quotes/
quote_patterns = [
    path("<int:quote_id>", QuoteDetailView.as_view()),
    path("<int:quote_id>/items/<int:item_id>", QuoteSetItemPriceView.as_view()),
    path("<int:quote_id>/submit", QuoteSubmitView.as_view()),
    path("<int:quote_id>/withdraw", QuoteWithdrawView.as_view()),
]

# These hang off /api/rfqs/<rfq_id>/...
rfq_quote_patterns = [
    path("<int:rfq_id>/quotes", CreateOrGetQuoteView.as_view()),
    path("<int:rfq_id>/quotes-list", RfqQuotesListView.as_view()),
    path("<int:rfq_id>/quotes/<int:quote_id>/award", AwardQuoteView.as_view()),
    # R7 — line-item comparison + split-award
    path("<int:rfq_id>/comparison", RfqComparisonView.as_view()),
    path("<int:rfq_id>/award-selections", AwardWithSelectionsView.as_view()),
]

# /api/staff/quotes/ — Backoffice Quote Manager
staff_quote_patterns = [
    path("quotes/pending", StaffPendingQuotesView.as_view()),
    path("quotes/<int:quote_id>/release", StaffReleaseQuoteView.as_view()),
    path("quotes/<int:quote_id>/reject", StaffRejectQuoteView.as_view()),
]

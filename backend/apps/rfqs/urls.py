from django.urls import path

from .views import (
    RfqAddItemView,
    RfqCloseView,
    RfqDetailView,
    RfqInboxView,
    RfqListCreateView,
    RfqPublishView,
)

urlpatterns = [
    path("", RfqListCreateView.as_view()),
    path("inbox", RfqInboxView.as_view()),
    path("<int:rfq_id>", RfqDetailView.as_view()),
    path("<int:rfq_id>/items", RfqAddItemView.as_view()),
    path("<int:rfq_id>/publish", RfqPublishView.as_view()),
    path("<int:rfq_id>/close", RfqCloseView.as_view()),
]

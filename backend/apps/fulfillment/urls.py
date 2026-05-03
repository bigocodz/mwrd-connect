from django.urls import path

from .views import (
    CompleteGrnView,
    CreateOrGetGrnView,
    DnDispatchView,
    IncomingDeliveriesView,
    OrderDeliveryNotesView,
    OutgoingDeliveriesView,
    SetGrnLineView,
    ThreeWayMatchView,
)

# Top-level patterns hung off /api/
urlpatterns = [
    path("deliveries/incoming", IncomingDeliveriesView.as_view()),
    path("deliveries/outgoing", OutgoingDeliveriesView.as_view()),
    path("deliveries/<int:dn_id>/dispatch", DnDispatchView.as_view()),
    path("deliveries/<int:dn_id>/grn", CreateOrGetGrnView.as_view()),
    path("grns/<int:grn_id>/lines", SetGrnLineView.as_view()),
    path("grns/<int:grn_id>/complete", CompleteGrnView.as_view()),
]

# Per-order patterns mounted under /api/orders/<order_id>/...
order_patterns = [
    path("<int:order_id>/deliveries", OrderDeliveryNotesView.as_view()),
    path("<int:order_id>/three-way-match", ThreeWayMatchView.as_view()),
]

from django.urls import path

from .views import OrderConfirmView, OrderDetailView, OrderListView

urlpatterns = [
    path("", OrderListView.as_view()),
    path("<int:order_id>", OrderDetailView.as_view()),
    path("<int:order_id>/confirm", OrderConfirmView.as_view()),
]

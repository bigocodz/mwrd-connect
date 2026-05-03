from django.urls import path

from .views import InboxView, MarkAllReadView, MarkReadView

urlpatterns = [
    path("notifications", InboxView.as_view()),
    path("notifications/mark-all-read", MarkAllReadView.as_view()),
    path("notifications/<int:notification_id>/read", MarkReadView.as_view()),
]

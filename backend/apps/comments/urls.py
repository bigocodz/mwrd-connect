from django.urls import path

from .views import CommentsListCreateView

urlpatterns = [
    path("comments", CommentsListCreateView.as_view()),
]

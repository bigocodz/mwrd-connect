from django.urls import path

from .views import ShortCodeLookupView

urlpatterns = [
    path("spl/lookup", ShortCodeLookupView.as_view()),
]

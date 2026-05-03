from django.urls import path

from .views import CrLookupView

urlpatterns = [
    path("wathq/cr-lookup", CrLookupView.as_view()),
]

from django.urls import path

from .views import (
    ContractDetailView,
    ContractListView,
    ContractSignClientView,
    ContractSignSupplierView,
)

urlpatterns = [
    path("", ContractListView.as_view()),
    path("<int:contract_id>", ContractDetailView.as_view()),
    path("<int:contract_id>/sign-client", ContractSignClientView.as_view()),
    path("<int:contract_id>/sign-supplier", ContractSignSupplierView.as_view()),
]

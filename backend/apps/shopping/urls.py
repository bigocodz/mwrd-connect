from django.urls import path

from .views import (
    ActiveCartView,
    CartItemDeleteView,
    CompanyCatalogDetailView,
    CompanyCatalogItemsView,
    CompanyCatalogListCreateView,
    FavouriteDeleteView,
    FavouritesListAddView,
    ResumeCartView,
    SaveCartView,
    SavedCartsListView,
    SubmitCartView,
)

# Mounted under /api/
customer_patterns = [
    # Favourites
    path("favourites", FavouritesListAddView.as_view()),
    path("favourites/<int:master_product_id>", FavouriteDeleteView.as_view()),
    # Company catalogs
    path("catalogs", CompanyCatalogListCreateView.as_view()),
    path("catalogs/<int:catalog_id>", CompanyCatalogDetailView.as_view()),
    path("catalogs/<int:catalog_id>/items", CompanyCatalogItemsView.as_view()),
    path(
        "catalogs/<int:catalog_id>/items/<int:master_product_id>",
        CompanyCatalogItemsView.as_view(),
    ),
    # Cart
    path("cart", ActiveCartView.as_view()),
    path("cart/items/<int:item_id>", CartItemDeleteView.as_view()),
    path("cart/save", SaveCartView.as_view()),
    path("cart/saved", SavedCartsListView.as_view()),
    path("cart/<int:cart_id>/resume", ResumeCartView.as_view()),
    path("cart/<int:cart_id>/submit", SubmitCartView.as_view()),
]

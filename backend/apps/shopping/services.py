"""R10 — services for shopping (Cart, Favourite, CompanyCatalog).

Working-day arithmetic: spec says "7 working days from creation". We treat
Friday and Saturday as the Saudi weekend (the rest as working days). The
helper is exposed here so the test suite can pin its behavior.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_event

from .models import Cart, CartItem, CompanyCatalog, CompanyCatalogItem, Favourite


class ShoppingError(Exception):  # noqa: N818
    pass


# ---------- Working-day helper ----------


# Saudi weekend: Friday=4, Saturday=5 (Python's weekday(): Mon=0..Sun=6).
_SA_WEEKEND = {4, 5}


def add_working_days(start: datetime, days: int) -> datetime:
    """Return start + `days` working days, skipping Friday and Saturday."""
    cursor = start
    added = 0
    while added < days:
        cursor = cursor + timedelta(days=1)
        if cursor.weekday() not in _SA_WEEKEND:
            added += 1
    return cursor


# ---------- Favourites ----------


@transaction.atomic
def add_favourite(*, user, master_product) -> Favourite:
    fav, _ = Favourite.objects.get_or_create(user=user, master_product=master_product)
    return fav


@transaction.atomic
def remove_favourite(*, user, master_product_id: int) -> None:
    Favourite.objects.filter(user=user, master_product_id=master_product_id).delete()


# ---------- Company catalogs ----------


@transaction.atomic
def create_company_catalog(*, organization, name: str, description: str, by) -> CompanyCatalog:
    if not name.strip():
        raise ShoppingError("Catalog name is required")
    return CompanyCatalog.objects.create(
        organization=organization, name=name, description=description, created_by=by,
    )


@transaction.atomic
def add_to_company_catalog(*, catalog: CompanyCatalog, master_product) -> CompanyCatalogItem:
    item, _ = CompanyCatalogItem.objects.get_or_create(
        catalog=catalog, master_product=master_product,
    )
    return item


@transaction.atomic
def remove_from_company_catalog(*, catalog: CompanyCatalog, master_product_id: int) -> None:
    CompanyCatalogItem.objects.filter(
        catalog=catalog, master_product_id=master_product_id,
    ).delete()


# ---------- Cart ----------


@transaction.atomic
def get_or_create_active_cart(*, user, organization) -> Cart:
    cart, _ = Cart.objects.get_or_create(
        user=user, organization=organization, status=Cart.Status.ACTIVE,
        defaults={"name": ""},
    )
    return cart


@transaction.atomic
def add_to_cart(
    *, cart: Cart, master_product, pack_type_code: str, quantity: int,
    notes: str = "",
) -> CartItem:
    if cart.status != Cart.Status.ACTIVE:
        raise ShoppingError("Cannot modify a non-active cart; resume it first")
    if quantity <= 0:
        raise ShoppingError("Quantity must be positive")
    item, created = CartItem.objects.get_or_create(
        cart=cart, master_product=master_product, pack_type_code=pack_type_code,
        defaults={"quantity": quantity, "notes": notes},
    )
    if not created:
        item.quantity += quantity
        if notes:
            item.notes = notes
        item.save(update_fields=["quantity", "notes"])
    return item


@transaction.atomic
def remove_from_cart(*, cart: Cart, item_id: int) -> None:
    if cart.status != Cart.Status.ACTIVE:
        raise ShoppingError("Cannot modify a non-active cart")
    cart.items.filter(id=item_id).delete()


@transaction.atomic
def save_cart(*, cart: Cart, name: str) -> Cart:
    """Move ACTIVE cart to SAVED with name + 7-working-day expiry."""
    if cart.status != Cart.Status.ACTIVE:
        raise ShoppingError(f"Cannot save a {cart.status} cart")
    if not name.strip():
        raise ShoppingError("Saved carts must have a name")
    cart.status = Cart.Status.SAVED
    cart.name = name
    cart.expires_at = add_working_days(timezone.now(), 7)
    cart.save(update_fields=["status", "name", "expires_at", "updated_at"])
    return cart


@transaction.atomic
def resume_cart(*, cart: Cart, user, organization) -> Cart:
    """Promote a SAVED cart back to ACTIVE. The previous active cart (if
    any) is marked SAVED with a placeholder name so its items aren't
    silently lost — the spec says users can keep multiple parked baskets.
    """
    if cart.status != Cart.Status.SAVED:
        raise ShoppingError(f"Cannot resume a {cart.status} cart")
    existing_active = Cart.objects.filter(
        user=user, organization=organization, status=Cart.Status.ACTIVE,
    ).first()
    if existing_active is not None and existing_active.id != cart.id:
        existing_active.status = Cart.Status.SAVED
        existing_active.name = existing_active.name or f"Auto-saved {timezone.now():%Y-%m-%d %H:%M}"
        existing_active.expires_at = add_working_days(timezone.now(), 7)
        existing_active.save(update_fields=[
            "status", "name", "expires_at", "updated_at",
        ])
    cart.status = Cart.Status.ACTIVE
    cart.expires_at = None
    cart.save(update_fields=["status", "expires_at", "updated_at"])
    return cart


@transaction.atomic
def submit_cart_as_rfq(
    *, cart: Cart, user, title: str, description: str = "",
    delivery_location: str = "", required_by=None,
):
    """Convert a cart (ACTIVE or SAVED) into a published RFQ. After
    submission the cart is marked SUBMITTED so it stops appearing in saved
    lists, and a fresh ACTIVE cart will be created on next /api/cart hit.
    """
    if cart.status not in (Cart.Status.ACTIVE, Cart.Status.SAVED):
        raise ShoppingError(f"Cannot submit a {cart.status} cart")
    if not cart.items.exists():
        raise ShoppingError("Cart is empty")

    from apps.rfqs.services import add_item, create_rfq, publish

    rfq = create_rfq(
        client_org=cart.organization, by=user,
        title=title, description=description,
        delivery_location=delivery_location, required_by=required_by,
    )
    for ci in cart.items.select_related("master_product").all():
        add_item(
            rfq, master_product=ci.master_product,
            pack_type_code=ci.pack_type_code, quantity=ci.quantity,
            notes=ci.notes,
        )
    publish(rfq)

    cart.status = Cart.Status.SUBMITTED
    cart.submitted_rfq = rfq
    cart.save(update_fields=["status", "submitted_rfq", "updated_at"])

    record_event(
        action="cart.submit", target=cart,
        organization=cart.organization, actor=user,
        payload={"rfq_id": rfq.id, "item_count": rfq.items.count()},
    )
    return rfq


def expire_due_saved_carts() -> int:
    """Beat-task body: flip SAVED carts past their expires_at to EXPIRED.
    Returns the number of carts expired.
    """
    now = timezone.now()
    qs = Cart.objects.filter(
        status=Cart.Status.SAVED, expires_at__lte=now,
    )
    n = qs.update(status=Cart.Status.EXPIRED)
    return n

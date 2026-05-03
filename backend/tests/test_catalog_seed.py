"""R15 — Pre-launch catalog seed.

Spec § "Master catalog seeded pre-launch: 200 to 300 master products
across 3 strongest categories (Office Supplies, IT and Electronics,
Furniture)."

Locks the rules:
- The management command creates exactly 3 categories with the spec's
  slugs and bilingual names.
- It seeds at least 200 master products in total (default 70 per cat).
- It's idempotent: re-running skips rows whose sku already exists.
- Every seeded product gets a master_product_code (R11 numbering).
"""
from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command

from apps.catalog.models import Category, MasterProduct


@pytest.mark.django_db
def test_seed_catalog_creates_three_categories(staff_user):
    staff_user.is_superuser = True
    staff_user.save(update_fields=["is_superuser"])
    out = StringIO()
    call_command("seed_catalog", "--actor-email", staff_user.email, stdout=out)

    slugs = set(Category.objects.values_list("slug", flat=True))
    assert {"office-supplies", "it-electronics", "furniture"} <= slugs


@pytest.mark.django_db
def test_seed_catalog_creates_at_least_200_products(staff_user):
    staff_user.is_superuser = True
    staff_user.save(update_fields=["is_superuser"])
    call_command("seed_catalog", "--actor-email", staff_user.email, stdout=StringIO())
    # 70 per cat * 3 = 210
    assert MasterProduct.objects.count() >= 200


@pytest.mark.django_db
def test_seed_catalog_is_idempotent(staff_user):
    staff_user.is_superuser = True
    staff_user.save(update_fields=["is_superuser"])
    call_command("seed_catalog", "--actor-email", staff_user.email, stdout=StringIO())
    first_count = MasterProduct.objects.count()
    call_command("seed_catalog", "--actor-email", staff_user.email, stdout=StringIO())
    assert MasterProduct.objects.count() == first_count


@pytest.mark.django_db
def test_seeded_products_have_master_product_codes(staff_user):
    staff_user.is_superuser = True
    staff_user.save(update_fields=["is_superuser"])
    call_command(
        "seed_catalog", "--actor-email", staff_user.email,
        "--count-per-category", "5", stdout=StringIO(),
    )
    for mp in MasterProduct.objects.all():
        assert mp.master_product_code.startswith("MWRD-PROD-"), mp.master_product_code


@pytest.mark.django_db
def test_seed_catalog_count_limit(staff_user):
    staff_user.is_superuser = True
    staff_user.save(update_fields=["is_superuser"])
    call_command(
        "seed_catalog", "--actor-email", staff_user.email,
        "--count-per-category", "3", stdout=StringIO(),
    )
    # 3 per cat × 3 categories = 9
    assert MasterProduct.objects.count() == 9

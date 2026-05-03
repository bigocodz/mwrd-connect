import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.organizations.models import Membership, Organization


def login_as(client, user, org=None, role="OWNER", scope="customer"):
    """Helper: set auth cookies on the test client for a given user/org."""
    from django.conf import settings

    refresh = RefreshToken.for_user(user)
    if org is not None:
        refresh["org_id"] = org.id
        refresh["role"] = role
    refresh["scope"] = scope
    client.cookies[settings.JWT_COOKIE_NAME] = str(refresh.access_token)


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def staff_user(db) -> User:
    return User.objects.create_user(
        email="staff@example.com", password="ChangeMe-Test!", is_staff=True
    )


@pytest.fixture
def org_a(db) -> Organization:
    return Organization.objects.create(
        type=Organization.Type.CLIENT,
        status=Organization.Status.ACTIVE,
        name="Org A",
        public_id="ORG-A",
        contact_email="a@example.com",
    )


@pytest.fixture
def org_b(db) -> Organization:
    return Organization.objects.create(
        type=Organization.Type.CLIENT,
        status=Organization.Status.ACTIVE,
        name="Org B",
        public_id="ORG-B",
        contact_email="b@example.com",
    )


@pytest.fixture
def user_in_org_a(db, org_a) -> User:
    user = User.objects.create_user(email="alice@a.example.com", password="ChangeMe-Test!")
    Membership.objects.create(
        user=user, organization=org_a, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def user_in_org_b(db, org_b) -> User:
    user = User.objects.create_user(email="bob@b.example.com", password="ChangeMe-Test!")
    Membership.objects.create(
        user=user, organization=org_b, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


# ---------- Catalog fixtures ----------

@pytest.fixture
def category(db):
    from apps.catalog.models import Category

    return Category.objects.create(
        level=0, slug="cleaning", name_en="Cleaning", name_ar="تنظيف",
    )


@pytest.fixture
def supplier_org_a(db) -> Organization:
    return Organization.objects.create(
        type=Organization.Type.SUPPLIER,
        status=Organization.Status.ACTIVE,
        name="Supplier A",
        public_id="SUP-A",
        contact_email="a@sup.local",
    )


@pytest.fixture
def supplier_org_b(db) -> Organization:
    return Organization.objects.create(
        type=Organization.Type.SUPPLIER,
        status=Organization.Status.ACTIVE,
        name="Supplier B",
        public_id="SUP-B",
        contact_email="b@sup.local",
    )


@pytest.fixture
def master_product(db, category, staff_user):
    from apps.catalog.services import create_master_product

    return create_master_product(
        by=staff_user,
        name_en="Industrial cleaner 5L",
        name_ar="منظف صناعي 5 لتر",
        description_en="Heavy-duty floor cleaner.",
        description_ar="",
        category=category,
        sku="CLN-5L-001",
        brand="Acme",
        image_keys=[],
        specs={"ph": "alkaline"},
        pack_types=[
            {"code": "EACH", "label_en": "Each", "label_ar": "وحدة", "base_qty": 1, "uom": "PCS"},
            {"code": "CASE", "label_en": "Case of 4", "label_ar": "صندوق", "base_qty": 4, "uom": "CASE"},
        ],
    )

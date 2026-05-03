"""R2 — public registration → callback → activation → onboarding."""
from __future__ import annotations

import pytest
from django.conf import settings

from apps.organizations.models import Lead, Organization

from .conftest import login_as


@pytest.mark.django_db
def test_register_creates_pending_lead(api_client):
    resp = api_client.post(
        "/api/auth/register",
        {
            "full_name": "Faisal Demo",
            "email": "faisal@example.sa",
            "phone": "+966500000001",
            "account_type": "CLIENT",
            "company_name": "Faisal Trading Co",
            "signup_intent": "Bulk office supplies for 10 branches.",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["status"] == Lead.Status.PENDING_CALLBACK
    assert "24 hours" in body["message"]

    lead = Lead.objects.get(id=body["lead_id"])
    assert lead.email == "faisal@example.sa"
    assert lead.account_type == "CLIENT"
    # No User / Organization created yet — that happens at activation.
    from apps.accounts.models import User
    assert not User.objects.filter(email="faisal@example.sa").exists()


@pytest.mark.django_db
def test_register_idempotent_on_double_submit(api_client):
    payload = {
        "full_name": "X", "email": "dup@example.sa", "phone": "+966",
        "account_type": "SUPPLIER", "company_name": "Dup Co",
    }
    a = api_client.post("/api/auth/register", payload, format="json")
    b = api_client.post("/api/auth/register", payload, format="json")
    assert a.json()["lead_id"] == b.json()["lead_id"]
    assert Lead.objects.filter(email="dup@example.sa").count() == 1


@pytest.mark.django_db
def test_staff_callback_complete_returns_token(api_client, staff_user):
    # Public registration first
    api_client.post("/api/auth/register", {
        "full_name": "Y", "email": "y@example.sa", "phone": "+966",
        "account_type": "CLIENT", "company_name": "Y Co",
    }, format="json")
    lead_id = Lead.objects.get(email="y@example.sa").id

    login_as(api_client, staff_user, scope="staff")
    resp = api_client.post(
        f"/api/staff/leads/{lead_id}/complete-callback",
        {"notes": "Spoke with Y. Confirmed phone, confirmed company exists."},
        format="json",
    )
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["lead_id"] == lead_id
    assert body["activation_token_DEV_ONLY"]

    lead = Lead.objects.get(id=lead_id)
    assert lead.status == Lead.Status.CALLBACK_COMPLETED
    assert lead.callback_notes.startswith("Spoke with")
    assert lead.activation_token_hash != ""


@pytest.mark.django_db
def test_activation_creates_user_org_membership_and_signs_in(api_client, staff_user):
    api_client.post("/api/auth/register", {
        "full_name": "Mike", "email": "mike@example.sa", "phone": "+966555",
        "account_type": "SUPPLIER", "company_name": "Mike Supplies",
    }, format="json")
    lead = Lead.objects.get(email="mike@example.sa")

    login_as(api_client, staff_user, scope="staff")
    raw_token = api_client.post(
        f"/api/staff/leads/{lead.id}/complete-callback",
        {"notes": "ok"}, format="json",
    ).json()["activation_token_DEV_ONLY"]

    # Public activation — no auth needed
    api_client.cookies.clear()
    resp = api_client.post(
        "/api/auth/activate",
        {"token": raw_token, "password": "long-enough-pw-1!"},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["user"]["email"] == "mike@example.sa"
    assert body["organization"]["type"] == "SUPPLIER"
    assert body["organization"]["status"] == "KYC_PENDING"
    assert body["role"] == "OWNER"

    # Cookies set — user is signed in.
    assert settings.JWT_COOKIE_NAME in resp.cookies

    # Lead marked activated; activation token burned.
    lead.refresh_from_db()
    assert lead.status == Lead.Status.ACTIVATED
    assert lead.activation_token_hash == ""
    assert lead.resulting_organization is not None

    # Org has supplier alias from save() override.
    assert lead.resulting_organization.platform_alias.startswith("Supplier ")


@pytest.mark.django_db
def test_activation_rejects_bad_token(api_client):
    resp = api_client.post(
        "/api/auth/activate",
        {"token": "not-a-real-token", "password": "long-enough-pw-1!"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_activation_rejects_expired_token(api_client, staff_user):
    api_client.post("/api/auth/register", {
        "full_name": "Z", "email": "z@example.sa", "phone": "+966",
        "account_type": "CLIENT", "company_name": "Z Co",
    }, format="json")
    lead = Lead.objects.get(email="z@example.sa")
    login_as(api_client, staff_user, scope="staff")
    raw = api_client.post(
        f"/api/staff/leads/{lead.id}/complete-callback",
        {"notes": "ok"}, format="json",
    ).json()["activation_token_DEV_ONLY"]

    # Force expiry
    from datetime import timedelta

    from django.utils import timezone
    Lead.objects.filter(id=lead.id).update(
        activation_token_expires_at=timezone.now() - timedelta(seconds=1),
    )

    api_client.cookies.clear()
    resp = api_client.post(
        "/api/auth/activate",
        {"token": raw, "password": "long-enough-pw-1!"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_onboarding_marks_org_complete(api_client, staff_user):
    # Activate a lead end-to-end
    api_client.post("/api/auth/register", {
        "full_name": "O", "email": "o@example.sa", "phone": "+966",
        "account_type": "CLIENT", "company_name": "O Co",
    }, format="json")
    lead = Lead.objects.get(email="o@example.sa")
    login_as(api_client, staff_user, scope="staff")
    raw = api_client.post(
        f"/api/staff/leads/{lead.id}/complete-callback",
        {"notes": "ok"}, format="json",
    ).json()["activation_token_DEV_ONLY"]

    api_client.cookies.clear()
    api_client.post(
        "/api/auth/activate",
        {"token": raw, "password": "long-enough-pw-1!"},
        format="json",
    )

    # Now hit onboarding
    resp = api_client.patch(
        "/api/auth/onboarding",
        {
            "cr_number": "1010500500",
            "vat_number": "300012345600003",
            "legal_name": "O Trading Co Ltd",
            "legal_name_ar": "شركة أو للتجارة",
        },
        format="json",
    )
    assert resp.status_code == 200, resp.content

    org = Organization.objects.get(public_id__startswith="O-")
    assert org.cr_number == "1010500500"
    assert org.legal_name == "O Trading Co Ltd"
    assert org.onboarding_completed is True


@pytest.mark.django_db
def test_staff_can_reject_a_bad_lead(api_client, staff_user):
    api_client.post("/api/auth/register", {
        "full_name": "Bad", "email": "bad@example.sa", "phone": "+966",
        "account_type": "CLIENT", "company_name": "Bad Co",
    }, format="json")
    lead = Lead.objects.get(email="bad@example.sa")

    login_as(api_client, staff_user, scope="staff")
    resp = api_client.post(
        f"/api/staff/leads/{lead.id}/reject",
        {"reason": "Phone disconnected, company unverifiable."},
        format="json",
    )
    assert resp.status_code == 200
    lead.refresh_from_db()
    assert lead.status == Lead.Status.REJECTED


@pytest.mark.django_db
def test_register_is_only_for_client_supplier_account_types(api_client):
    """Spec rule: 'public registration NEVER creates admin/ops/finance/cs users'.
    We enforce this by only accepting CLIENT or SUPPLIER as account_type."""
    resp = api_client.post(
        "/api/auth/register",
        {
            "full_name": "Sneaky", "email": "sneaky@example.sa",
            "phone": "+966", "account_type": "ADMIN",
            "company_name": "Sneaky Co",
        },
        format="json",
    )
    assert resp.status_code == 400

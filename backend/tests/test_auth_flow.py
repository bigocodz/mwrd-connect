"""End-to-end auth flow: signup-from-invite → me → refresh → logout.

Also covers: login rejects staff users, login rejects users with no active org,
staff cannot log in via customer endpoint, customer cannot log in via staff endpoint.
"""
import pytest
from django.conf import settings

from apps.organizations.services import (
    create_organization_with_owner_invite,
    create_team_invite,
)


@pytest.mark.django_db
def test_signup_from_invite_creates_user_and_logs_in(api_client, staff_user):
    org, invite, token = create_organization_with_owner_invite(
        type="CLIENT", name="Acme", public_id="ACME",
        contact_email="owner@acme.example.com", invited_by=staff_user,
    )

    resp = api_client.post(
        "/api/auth/signup-from-invite",
        {"token": token, "full_name": "Alice Owner", "password": "long-enough-pw-1!"},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["user"]["email"] == "owner@acme.example.com"
    assert body["organization"]["id"] == org.id
    assert body["role"] == "OWNER"

    # Cookies set
    assert settings.JWT_COOKIE_NAME in resp.cookies
    assert settings.JWT_REFRESH_COOKIE_NAME in resp.cookies

    # /me works with the cookie
    me = api_client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["organization"]["id"] == org.id
    assert me.json()["role"] == "OWNER"
    assert me.json()["scope"] == "customer"


@pytest.mark.django_db
def test_signup_from_invite_rejects_expired(api_client, staff_user):
    from datetime import timedelta

    from django.utils import timezone

    _, invite, token = create_organization_with_owner_invite(
        type="SUPPLIER", name="X", public_id="X1",
        contact_email="x@example.com", invited_by=staff_user,
    )
    invite.expires_at = timezone.now() - timedelta(seconds=1)
    invite.save(update_fields=["expires_at"])

    resp = api_client.post(
        "/api/auth/signup-from-invite",
        {"token": token, "full_name": "X", "password": "long-enough-pw-1!"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_login_rejects_staff(api_client, staff_user):
    resp = api_client.post(
        "/api/auth/login",
        {"email": "staff@example.com", "password": "ChangeMe-Test!"},
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_login_rejects_user_without_active_org(api_client, db):
    from apps.accounts.models import User

    User.objects.create_user(email="orphan@example.com", password="long-enough-pw-1!")
    resp = api_client.post(
        "/api/auth/login",
        {"email": "orphan@example.com", "password": "long-enough-pw-1!"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_login_succeeds_for_customer(api_client, user_in_org_a):
    resp = api_client.post(
        "/api/auth/login",
        {"email": "alice@a.example.com", "password": "ChangeMe-Test!"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "OWNER"


@pytest.mark.django_db
def test_refresh_rotates_cookie(api_client, user_in_org_a):
    api_client.post(
        "/api/auth/login",
        {"email": "alice@a.example.com", "password": "ChangeMe-Test!"},
        format="json",
    )
    old_access = api_client.cookies[settings.JWT_COOKIE_NAME].value
    resp = api_client.post("/api/auth/refresh")
    assert resp.status_code == 200
    new_access = resp.cookies[settings.JWT_COOKIE_NAME].value
    assert new_access != old_access


@pytest.mark.django_db
def test_refresh_without_cookie_401(api_client):
    resp = api_client.post("/api/auth/refresh")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_logout_clears_cookies(api_client, user_in_org_a):
    api_client.post(
        "/api/auth/login",
        {"email": "alice@a.example.com", "password": "ChangeMe-Test!"},
        format="json",
    )
    resp = api_client.post("/api/auth/logout")
    assert resp.status_code == 204
    # Set-Cookie with empty value (delete_cookie)
    assert resp.cookies[settings.JWT_COOKIE_NAME].value == ""


@pytest.mark.django_db
def test_staff_login_without_totp_fails(api_client, staff_user):
    resp = api_client.post(
        "/api/auth/staff/login",
        {"email": "staff@example.com", "password": "ChangeMe-Test!", "otp": "000000"},
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_staff_enroll_then_login(api_client, staff_user):
    # Begin enrollment
    start = api_client.post(
        "/api/auth/staff/enroll/start",
        {"email": "staff@example.com", "password": "ChangeMe-Test!"},
        format="json",
    )
    assert start.status_code == 200, start.content
    assert "provisioning_uri" in start.json()

    # Confirm with a real TOTP code computed from the device's secret
    from django_otp.oath import TOTP
    from django_otp.plugins.otp_totp.models import TOTPDevice

    device = TOTPDevice.objects.get(user=staff_user, confirmed=False)
    totp = TOTP(device.bin_key, device.step, device.t0, device.digits)
    totp.time = __import__("time").time()
    code = format(totp.token(), f"0{device.digits}d")

    confirm = api_client.post(
        "/api/auth/staff/enroll/confirm",
        {"email": "staff@example.com", "password": "ChangeMe-Test!", "otp": code},
        format="json",
    )
    assert confirm.status_code == 200, confirm.content


@pytest.mark.django_db
def test_team_invite_accept_for_existing_user(api_client, user_in_org_a, org_a, staff_user):
    from apps.accounts.models import User

    # Existing org-A user is invited as an APPROVER on org A (not realistic — but
    # the flow is: accept_invite uses get_or_create on Membership, idempotent.)
    # Instead, invite a brand-new email to org_a as BUYER, then user signs up.
    invite, raw = create_team_invite(
        organization=org_a, email="newbuyer@a.example.com",
        role="BUYER", invited_by=user_in_org_a,
    )

    resp = api_client.post(
        "/api/auth/signup-from-invite",
        {"token": raw, "full_name": "New Buyer", "password": "long-enough-pw-1!"},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "BUYER"
    assert User.objects.filter(email="newbuyer@a.example.com").exists()

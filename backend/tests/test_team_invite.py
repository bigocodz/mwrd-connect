"""Phase 2.8: team invites — owner/admin can invite, viewer cannot;
OWNER role cannot be team-invited."""
import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from apps.organizations.models import Membership


def _login_with_role(client, user, org, role):
    """Set the JWT cookie directly so we can fake any membership for the test."""
    refresh = RefreshToken.for_user(user)
    refresh["org_id"] = org.id
    refresh["role"] = role
    refresh["scope"] = "customer"
    from django.conf import settings

    client.cookies[settings.JWT_COOKIE_NAME] = str(refresh.access_token)


@pytest.mark.django_db
def test_owner_can_invite_team(api_client, user_in_org_a, org_a):
    Membership.objects.filter(user=user_in_org_a, organization=org_a).update(
        role=Membership.Role.OWNER
    )
    _login_with_role(api_client, user_in_org_a, org_a, Membership.Role.OWNER)
    resp = api_client.post(
        "/api/orgs/team/invite",
        {"email": "newbuyer@a.example.com", "role": "BUYER"},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    assert "invite_id" in resp.json()


@pytest.mark.django_db
def test_viewer_cannot_invite_team(api_client, user_in_org_a, org_a):
    _login_with_role(api_client, user_in_org_a, org_a, Membership.Role.VIEWER)
    resp = api_client.post(
        "/api/orgs/team/invite",
        {"email": "newbuyer@a.example.com", "role": "BUYER"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_owner_role_cannot_be_team_invited(api_client, user_in_org_a, org_a):
    _login_with_role(api_client, user_in_org_a, org_a, Membership.Role.OWNER)
    resp = api_client.post(
        "/api/orgs/team/invite",
        {"email": "x@a.example.com", "role": "OWNER"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_team_list_returns_org_members(api_client, user_in_org_a, org_a):
    _login_with_role(api_client, user_in_org_a, org_a, Membership.Role.OWNER)
    resp = api_client.get("/api/orgs/team")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["user_email"] == "alice@a.example.com"

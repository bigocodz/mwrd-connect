"""Phase 8: data export + hard-delete (purge)."""
import io
import json
import zipfile

import pytest

from apps.organizations.models import Membership, Organization

from .conftest import login_as


@pytest.mark.django_db
def test_export_zip_owner_can_download(api_client, user_in_org_a, org_a):
    login_as(api_client, user_in_org_a, org_a)
    resp = api_client.get("/api/export")
    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/zip"
    assert resp["Content-Disposition"].startswith("attachment;")

    zf = zipfile.ZipFile(io.BytesIO(b"".join(resp.streaming_content) if resp.streaming else resp.content))
    names = set(zf.namelist())
    assert "organization.json" in names
    assert "memberships.json" in names
    org_json = json.loads(zf.read("organization.json"))
    assert org_json["id"] == org_a.id


@pytest.mark.django_db
def test_export_blocked_for_non_admin(api_client, user_in_org_a, org_a):
    Membership.objects.filter(user=user_in_org_a, organization=org_a).update(
        role=Membership.Role.VIEWER,
    )
    login_as(api_client, user_in_org_a, org_a, role="VIEWER")
    resp = api_client.get("/api/export")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_purge_requires_public_id_confirmation(api_client, staff_user, org_a):
    login_as(api_client, staff_user, scope="staff")
    resp = api_client.post("/api/staff/purge", {
        "organization_id": org_a.id,
        "reason": "User requested account closure under PDPL Article 18.",
        "confirm_public_id": "WRONG-ID",
    }, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_purge_anonymizes_org_and_keeps_id(api_client, staff_user, org_a, user_in_org_a):
    public_id = org_a.public_id
    login_as(api_client, staff_user, scope="staff")
    resp = api_client.post("/api/staff/purge", {
        "organization_id": org_a.id,
        "reason": "User requested account closure under PDPL Article 18.",
        "confirm_public_id": public_id,
    }, format="json")
    assert resp.status_code == 200, resp.content

    org_a.refresh_from_db()
    assert org_a.status == Organization.Status.ARCHIVED
    assert org_a.name.startswith("[redacted org #")
    assert org_a.cr_number == ""
    assert org_a.contact_email.endswith("@invalid.local")
    # Memberships gone, user row still exists (may belong to other orgs).
    assert Membership.objects.filter(organization=org_a).count() == 0
    from apps.accounts.models import User
    assert User.objects.filter(id=user_in_org_a.id).exists()


@pytest.mark.django_db
def test_purge_requires_reason(api_client, staff_user, org_a):
    login_as(api_client, staff_user, scope="staff")
    resp = api_client.post("/api/staff/purge", {
        "organization_id": org_a.id,
        "reason": "",
        "confirm_public_id": org_a.public_id,
    }, format="json")
    assert resp.status_code == 400

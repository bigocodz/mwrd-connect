"""Phase 2.2: owner-invite email is rendered + delivered (locmem in tests)."""
import pytest
from django.core import mail

from apps.notifications.tasks import send_owner_invite_email, send_team_invite_email
from apps.organizations.services import (
    create_organization_with_owner_invite,
    create_team_invite,
)


@pytest.mark.django_db
def test_owner_invite_email_renders_and_sends(staff_user):
    org, invite, raw = create_organization_with_owner_invite(
        type="CLIENT", name="Acme", public_id="ACME",
        contact_email="owner@acme.example.com", invited_by=staff_user,
    )
    mail.outbox.clear()
    send_owner_invite_email.delay(invite.id, raw)
    assert len(mail.outbox) == 1
    msg = mail.outbox[0]
    assert msg.to == ["owner@acme.example.com"]
    assert "Acme" in msg.subject
    assert raw in msg.body  # invite link contains the raw token
    assert msg.alternatives, "html alternative attached"
    html = msg.alternatives[0][0]
    assert "Accept invite" in html


@pytest.mark.django_db
def test_team_invite_email_uses_correct_portal(staff_user, org_a, user_in_org_a):
    org_a.type = "SUPPLIER"
    org_a.save(update_fields=["type"])
    invite, raw = create_team_invite(
        organization=org_a, email="x@a.example.com",
        role="BUYER", invited_by=user_in_org_a,
    )
    mail.outbox.clear()
    send_team_invite_email.delay(invite.id, raw)
    assert len(mail.outbox) == 1
    msg = mail.outbox[0]
    # Supplier portal URL embedded
    from django.conf import settings
    assert settings.FRONTEND_SUPPLIER_URL in msg.body

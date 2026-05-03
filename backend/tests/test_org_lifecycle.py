"""Phase 2.6: org state machine — every transition + every rejection."""
import pytest

from apps.organizations.models import Organization
from apps.organizations.services import (
    InvalidTransition,
    archive_org,
    suspend_org,
    transition_org,
    unsuspend_org,
)


@pytest.mark.django_db
def test_invited_to_kyc_pending(org_a):
    org_a.status = Organization.Status.INVITED
    org_a.save(update_fields=["status"])
    transition_org(org_a, to=Organization.Status.KYC_PENDING)
    org_a.refresh_from_db()
    assert org_a.status == Organization.Status.KYC_PENDING


@pytest.mark.django_db
def test_invited_cannot_skip_to_active(org_a):
    org_a.status = Organization.Status.INVITED
    org_a.save(update_fields=["status"])
    with pytest.raises(InvalidTransition):
        transition_org(org_a, to=Organization.Status.ACTIVE)


@pytest.mark.django_db
def test_active_sets_activated_at(org_a):
    org_a.status = Organization.Status.KYC_REVIEW
    org_a.activated_at = None
    org_a.save(update_fields=["status", "activated_at"])
    transition_org(org_a, to=Organization.Status.ACTIVE)
    org_a.refresh_from_db()
    assert org_a.activated_at is not None


@pytest.mark.django_db
def test_suspend_then_unsuspend(org_a, staff_user):
    suspend_org(org_a, by=staff_user, reason="payment overdue")
    org_a.refresh_from_db()
    assert org_a.status == Organization.Status.SUSPENDED
    assert org_a.suspended_at is not None
    assert org_a.suspension_reason == "payment overdue"

    unsuspend_org(org_a, by=staff_user)
    org_a.refresh_from_db()
    assert org_a.status == Organization.Status.ACTIVE


@pytest.mark.django_db
def test_archived_is_terminal(org_a, staff_user):
    archive_org(org_a, by=staff_user)
    org_a.refresh_from_db()
    assert org_a.status == Organization.Status.ARCHIVED
    with pytest.raises(InvalidTransition):
        transition_org(org_a, to=Organization.Status.ACTIVE)


@pytest.mark.django_db
def test_invalid_transitions_are_rejected(org_a):
    org_a.status = Organization.Status.INVITED
    org_a.save(update_fields=["status"])
    for invalid in [
        Organization.Status.KYC_REVIEW,
        Organization.Status.ACTIVE,
        Organization.Status.SUSPENDED,
    ]:
        with pytest.raises(InvalidTransition):
            transition_org(org_a, to=invalid)

"""Phase 2.3 + 2.5 + 2.6: KYC submission and review flow."""
import pytest

from apps.kyc import services as kyc_services
from apps.kyc.models import KycSubmission
from apps.organizations.models import Organization


@pytest.fixture
def kyc_pending_org(db):
    return Organization.objects.create(
        type=Organization.Type.CLIENT,
        status=Organization.Status.KYC_PENDING,
        name="Pending Org",
        public_id="ORG-KYC",
        contact_email="kyc@example.com",
    )


@pytest.mark.django_db
def test_get_or_create_draft_idempotent(kyc_pending_org):
    a = kyc_services.get_or_create_draft(kyc_pending_org)
    b = kyc_services.get_or_create_draft(kyc_pending_org)
    assert a.id == b.id
    assert a.status == KycSubmission.Status.DRAFT


@pytest.mark.django_db
def test_submit_requires_at_least_one_doc(kyc_pending_org, user_in_org_a):
    sub = kyc_services.get_or_create_draft(kyc_pending_org)
    with pytest.raises(kyc_services.InvalidKycTransition):
        kyc_services.submit_for_review(sub, by=user_in_org_a)


@pytest.mark.django_db
def test_full_approval_flow(kyc_pending_org, user_in_org_a, staff_user):
    sub = kyc_services.get_or_create_draft(kyc_pending_org)
    sub.legal_name = "Pending Org Ltd"
    sub.cr_number = "1234567890"
    sub.save()
    kyc_services.attach_document(
        sub, kind="CR", storage_key="kyc/x.pdf",
        original_filename="cr.pdf", content_type="application/pdf", size_bytes=1024,
    )
    kyc_services.submit_for_review(sub, by=user_in_org_a)
    sub.refresh_from_db()
    kyc_pending_org.refresh_from_db()
    assert sub.status == KycSubmission.Status.SUBMITTED
    assert kyc_pending_org.status == Organization.Status.KYC_REVIEW

    kyc_services.approve(sub, by=staff_user, notes="LGTM")
    sub.refresh_from_db()
    kyc_pending_org.refresh_from_db()
    assert sub.status == KycSubmission.Status.APPROVED
    assert kyc_pending_org.status == Organization.Status.ACTIVE
    assert kyc_pending_org.activated_at is not None
    assert kyc_pending_org.legal_name == "Pending Org Ltd"
    assert kyc_pending_org.cr_number == "1234567890"


@pytest.mark.django_db
def test_request_changes_returns_org_to_pending(kyc_pending_org, user_in_org_a, staff_user):
    sub = kyc_services.get_or_create_draft(kyc_pending_org)
    kyc_services.attach_document(
        sub, kind="CR", storage_key="k", original_filename="x", content_type="application/pdf",
    )
    kyc_services.submit_for_review(sub, by=user_in_org_a)
    kyc_services.request_changes(sub, by=staff_user, notes="Please re-upload CR")
    sub.refresh_from_db()
    kyc_pending_org.refresh_from_db()
    assert sub.status == KycSubmission.Status.CHANGES_REQUESTED
    assert kyc_pending_org.status == Organization.Status.KYC_PENDING

    # The same submission becomes the editable draft again
    again = kyc_services.get_or_create_draft(kyc_pending_org)
    assert again.id == sub.id


@pytest.mark.django_db
def test_reject_keeps_history_and_creates_new_draft(kyc_pending_org, user_in_org_a, staff_user):
    sub = kyc_services.get_or_create_draft(kyc_pending_org)
    kyc_services.attach_document(
        sub, kind="CR", storage_key="k", original_filename="x", content_type="application/pdf",
    )
    kyc_services.submit_for_review(sub, by=user_in_org_a)
    kyc_services.reject(sub, by=staff_user, notes="Forged CR")
    sub.refresh_from_db()
    kyc_pending_org.refresh_from_db()
    assert sub.status == KycSubmission.Status.REJECTED
    assert kyc_pending_org.status == Organization.Status.KYC_PENDING

    # A fresh draft is created on next get_or_create
    fresh = kyc_services.get_or_create_draft(kyc_pending_org)
    assert fresh.id != sub.id
    assert fresh.status == KycSubmission.Status.DRAFT


@pytest.mark.django_db
def test_request_changes_requires_notes(kyc_pending_org, user_in_org_a, staff_user):
    sub = kyc_services.get_or_create_draft(kyc_pending_org)
    kyc_services.attach_document(
        sub, kind="CR", storage_key="k", original_filename="x", content_type="application/pdf",
    )
    kyc_services.submit_for_review(sub, by=user_in_org_a)
    with pytest.raises(kyc_services.InvalidKycTransition):
        kyc_services.request_changes(sub, by=staff_user, notes="")


@pytest.mark.django_db
def test_cannot_approve_a_draft(kyc_pending_org, staff_user):
    sub = kyc_services.get_or_create_draft(kyc_pending_org)
    with pytest.raises(kyc_services.InvalidKycTransition):
        kyc_services.approve(sub, by=staff_user)

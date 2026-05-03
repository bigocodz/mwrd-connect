"""KYC state machine and helpers.

Submission states:
    DRAFT → SUBMITTED → (APPROVED | REJECTED | CHANGES_REQUESTED)

When the submission moves into SUBMITTED, the org transitions
KYC_PENDING → KYC_REVIEW. On APPROVED, the org transitions to ACTIVE.
On CHANGES_REQUESTED or REJECTED, the org returns to KYC_PENDING.
"""
from __future__ import annotations

import secrets
from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

from apps.organizations.services import transition_org

from .models import KycDocument, KycSubmission

if TYPE_CHECKING:
    from apps.organizations.models import Organization


class InvalidKycTransition(Exception):  # noqa: N818
    pass


def get_or_create_draft(org: Organization) -> KycSubmission:
    """Returns the org's open submission (DRAFT or CHANGES_REQUESTED) or
    creates a new DRAFT. Approved/rejected submissions are historical."""
    open_states = (KycSubmission.Status.DRAFT, KycSubmission.Status.CHANGES_REQUESTED)
    submission = (
        KycSubmission.objects.filter(organization=org, status__in=open_states)
        .order_by("-created_at")
        .first()
    )
    if submission is not None:
        return submission
    return KycSubmission.objects.create(
        organization=org,
        legal_name=org.legal_name or org.name,
        legal_name_ar=org.legal_name_ar,
    )


def make_storage_key(*, org_id: int, submission_id: int, kind: str, filename: str) -> str:
    """Predictable but unguessable key. Random suffix prevents collisions
    when the same filename is re-uploaded."""
    suffix = secrets.token_hex(8)
    safe = filename.replace("/", "_")[:120]
    return f"kyc/{org_id}/{submission_id}/{kind}/{suffix}-{safe}"


@transaction.atomic
def submit_for_review(submission: KycSubmission, *, by) -> KycSubmission:
    if submission.status not in (
        KycSubmission.Status.DRAFT,
        KycSubmission.Status.CHANGES_REQUESTED,
    ):
        raise InvalidKycTransition(f"Cannot submit a {submission.status} submission")
    if not submission.documents.exists():
        raise InvalidKycTransition("Attach at least one document before submitting")

    submission.status = KycSubmission.Status.SUBMITTED
    submission.submitted_at = timezone.now()
    submission.submitted_by = by
    submission.save(update_fields=["status", "submitted_at", "submitted_by", "updated_at"])

    from apps.organizations.models import Organization

    transition_org(submission.organization, to=Organization.Status.KYC_REVIEW, by=by)
    return submission


@transaction.atomic
def approve(submission: KycSubmission, *, by, notes: str = "") -> KycSubmission:
    if submission.status != KycSubmission.Status.SUBMITTED:
        raise InvalidKycTransition(f"Cannot approve a {submission.status} submission")

    submission.status = KycSubmission.Status.APPROVED
    submission.reviewed_at = timezone.now()
    submission.reviewed_by = by
    submission.review_notes = notes
    submission.save(update_fields=[
        "status", "reviewed_at", "reviewed_by", "review_notes", "updated_at",
    ])

    org = submission.organization
    # Copy the canonical legal info onto the org for invoicing/contracts.
    org.legal_name = submission.legal_name
    org.legal_name_ar = submission.legal_name_ar
    if submission.cr_number:
        org.cr_number = submission.cr_number
    if submission.vat_number:
        org.vat_number = submission.vat_number
    org.save(update_fields=["legal_name", "legal_name_ar", "cr_number", "vat_number"])

    from apps.organizations.models import Organization
    transition_org(org, to=Organization.Status.ACTIVE, by=by)
    return submission


@transaction.atomic
def request_changes(submission: KycSubmission, *, by, notes: str) -> KycSubmission:
    if submission.status != KycSubmission.Status.SUBMITTED:
        raise InvalidKycTransition(f"Cannot request changes on a {submission.status} submission")
    if not notes:
        raise InvalidKycTransition("Notes are required when requesting changes")

    submission.status = KycSubmission.Status.CHANGES_REQUESTED
    submission.reviewed_at = timezone.now()
    submission.reviewed_by = by
    submission.review_notes = notes
    submission.save(update_fields=[
        "status", "reviewed_at", "reviewed_by", "review_notes", "updated_at",
    ])

    from apps.organizations.models import Organization
    transition_org(submission.organization, to=Organization.Status.KYC_PENDING, by=by)
    return submission


@transaction.atomic
def reject(submission: KycSubmission, *, by, notes: str) -> KycSubmission:
    if submission.status != KycSubmission.Status.SUBMITTED:
        raise InvalidKycTransition(f"Cannot reject a {submission.status} submission")
    if not notes:
        raise InvalidKycTransition("Notes are required when rejecting")

    submission.status = KycSubmission.Status.REJECTED
    submission.reviewed_at = timezone.now()
    submission.reviewed_by = by
    submission.review_notes = notes
    submission.save(update_fields=[
        "status", "reviewed_at", "reviewed_by", "review_notes", "updated_at",
    ])

    # Org goes back to KYC_PENDING — they can start a fresh DRAFT.
    from apps.organizations.models import Organization
    transition_org(submission.organization, to=Organization.Status.KYC_PENDING, by=by)
    return submission


def attach_document(
    submission: KycSubmission,
    *,
    kind: str,
    storage_key: str,
    original_filename: str,
    content_type: str,
    size_bytes: int = 0,
) -> KycDocument:
    return KycDocument.objects.create(
        submission=submission,
        kind=kind,
        storage_key=storage_key,
        original_filename=original_filename,
        content_type=content_type,
        size_bytes=size_bytes,
    )

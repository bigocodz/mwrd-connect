import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.core.aliases import gen_client_alias, gen_supplier_alias

from .models import Invite, Lead, Membership, Organization


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def generate_invite_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(48)
    return raw, hash_token(raw)


def allocate_alias(*, type: str) -> str:
    """Generate a unique platform_alias for a new org. Caller must save the
    returned alias on the Organization row before any other party sees it."""
    if type == Organization.Type.CLIENT:
        # 4-char random suffix; loop until unique. Realistically 0–1 retries.
        for _ in range(20):
            candidate = gen_client_alias()
            if not Organization.objects.filter(platform_alias=candidate).exists():
                return candidate
        raise RuntimeError("Failed to allocate a client alias after 20 attempts")

    used = set(
        Organization.objects.filter(
            platform_alias__startswith="Supplier ",
        ).values_list("platform_alias", flat=True)
    )
    return gen_supplier_alias(used_aliases=used)


@transaction.atomic
def create_organization_with_owner_invite(
    *,
    type: str,
    name: str,
    public_id: str,
    contact_email: str,
    invited_by,
    role: str = Membership.Role.OWNER,
) -> tuple[Organization, Invite, str]:
    """Staff entry-point. Returns (org, invite, raw_token).

    raw_token must be emailed immediately and never persisted or logged.
    """
    org = Organization.objects.create(
        type=type,
        name=name,
        public_id=public_id,
        platform_alias=allocate_alias(type=type),
        contact_email=contact_email,
        status=Organization.Status.INVITED,
    )
    raw, hashed = generate_invite_token()
    invite = Invite.objects.create(
        organization=org,
        email=contact_email,
        role=role,
        kind=Invite.Kind.OWNER,
        token_hash=hashed,
        expires_at=timezone.now() + timedelta(days=settings.INVITE_TOKEN_TTL_DAYS),
        invited_by=invited_by,
    )
    return org, invite, raw


@transaction.atomic
def create_team_invite(
    *,
    organization: Organization,
    email: str,
    role: str,
    invited_by,
) -> tuple[Invite, str]:
    """Org-owner entry-point for inviting teammates."""
    raw, hashed = generate_invite_token()
    invite = Invite.objects.create(
        organization=organization,
        email=email,
        role=role,
        kind=Invite.Kind.TEAM,
        token_hash=hashed,
        expires_at=timezone.now() + timedelta(days=settings.INVITE_TOKEN_TTL_DAYS),
        invited_by=invited_by,
    )
    return invite, raw


class InvalidTransition(Exception):  # noqa: N818
    """Raised when an org state transition isn't allowed."""


_ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    Organization.Status.INVITED: {
        Organization.Status.KYC_PENDING,
        Organization.Status.ARCHIVED,
    },
    Organization.Status.KYC_PENDING: {
        Organization.Status.KYC_REVIEW,
        Organization.Status.SUSPENDED,
        Organization.Status.ARCHIVED,
    },
    Organization.Status.KYC_REVIEW: {
        Organization.Status.ACTIVE,
        Organization.Status.KYC_PENDING,  # rejection / request changes
        Organization.Status.SUSPENDED,
        Organization.Status.ARCHIVED,
    },
    Organization.Status.ACTIVE: {
        Organization.Status.SUSPENDED,
        Organization.Status.ARCHIVED,
    },
    Organization.Status.SUSPENDED: {
        Organization.Status.ACTIVE,
        Organization.Status.ARCHIVED,
    },
    Organization.Status.ARCHIVED: set(),
}


@transaction.atomic
def transition_org(
    org: Organization, *, to: str, by=None, reason: str = "",
) -> Organization:
    """Validates and applies a state transition. Persists side-effects:
    activated_at on ACTIVE entry, suspended_at + reason on SUSPENDED entry.
    """
    org.refresh_from_db()
    if to not in _ALLOWED_TRANSITIONS.get(org.status, set()):
        raise InvalidTransition(f"Cannot transition {org.status} → {to}")

    org.status = to
    update_fields = ["status", "updated_at"]

    if to == Organization.Status.ACTIVE and org.activated_at is None:
        org.activated_at = timezone.now()
        update_fields.append("activated_at")
    if to == Organization.Status.SUSPENDED:
        org.suspended_at = timezone.now()
        org.suspension_reason = reason
        update_fields += ["suspended_at", "suspension_reason"]

    org.save(update_fields=update_fields)
    return org


def suspend_org(org: Organization, *, by, reason: str) -> Organization:
    return transition_org(org, to=Organization.Status.SUSPENDED, by=by, reason=reason)


def unsuspend_org(org: Organization, *, by) -> Organization:
    return transition_org(org, to=Organization.Status.ACTIVE, by=by)


def archive_org(org: Organization, *, by) -> Organization:
    return transition_org(org, to=Organization.Status.ARCHIVED, by=by)


@transaction.atomic
def accept_invite(*, raw_token: str, user) -> Membership:
    invite = Invite.objects.select_for_update().get(
        token_hash=hash_token(raw_token),
        status=Invite.Status.PENDING,
    )
    if invite.is_expired:
        invite.status = Invite.Status.EXPIRED
        invite.save(update_fields=["status"])
        raise ValueError("Invite expired")

    membership, _ = Membership.objects.get_or_create(
        user=user,
        organization=invite.organization,
        defaults={
            "role": invite.role,
            "status": Membership.Status.ACTIVE,
        },
    )
    invite.status = Invite.Status.ACCEPTED
    invite.accepted_at = timezone.now()
    invite.accepted_by = user
    invite.save(update_fields=["status", "accepted_at", "accepted_by"])

    if invite.kind == Invite.Kind.OWNER:
        org = invite.organization
        if org.status == Organization.Status.INVITED:
            transition_org(org, to=Organization.Status.KYC_PENDING, by=user)

    return membership


# ---------- R2: Lead → callback → activation pipeline ----------


@transaction.atomic
def register_lead(
    *,
    full_name: str,
    email: str,
    phone: str,
    account_type: str,
    company_name: str,
    signup_intent: str = "",
    expected_monthly_volume_sar=None,
) -> Lead:
    """Public registration — anyone can call this. Creates a Lead in
    PENDING_CALLBACK status. Idempotent on (email, account_type) for
    PENDING_CALLBACK rows so a refresh doesn't double-create."""
    existing = Lead.objects.filter(
        email__iexact=email,
        account_type=account_type,
        status=Lead.Status.PENDING_CALLBACK,
    ).first()
    if existing is not None:
        return existing
    return Lead.objects.create(
        full_name=full_name,
        email=email.lower(),
        phone=phone,
        account_type=account_type,
        company_name=company_name,
        signup_intent=signup_intent,
        expected_monthly_volume_sar=expected_monthly_volume_sar,
    )


@transaction.atomic
def complete_callback(
    *, lead: Lead, by, notes: str = "",
) -> tuple[Lead, str]:
    """Ops marks the prospect's callback complete. Generates the activation
    token (raw value emailed once, hash stored). Returns (lead, raw_token)."""
    if lead.status != Lead.Status.PENDING_CALLBACK:
        raise ValueError(f"Cannot complete callback on a {lead.status} lead")

    raw, hashed = generate_invite_token()
    lead.status = Lead.Status.CALLBACK_COMPLETED
    lead.callback_notes = notes
    lead.callback_completed_at = timezone.now()
    lead.callback_completed_by = by
    lead.activation_token_hash = hashed
    lead.activation_token_expires_at = (
        timezone.now() + timedelta(days=settings.INVITE_TOKEN_TTL_DAYS)
    )
    lead.save(update_fields=[
        "status", "callback_notes", "callback_completed_at",
        "callback_completed_by", "activation_token_hash",
        "activation_token_expires_at", "updated_at",
    ])
    return lead, raw


def reject_lead(*, lead: Lead, reason: str) -> Lead:
    if lead.status != Lead.Status.PENDING_CALLBACK:
        raise ValueError(f"Cannot reject a {lead.status} lead")
    if not reason:
        raise ValueError("Rejection reason required")
    lead.status = Lead.Status.REJECTED
    lead.rejection_reason = reason
    lead.save(update_fields=["status", "rejection_reason", "updated_at"])
    return lead


@transaction.atomic
def activate_lead(*, raw_token: str, password: str) -> tuple:
    """Atomically: create Org + User + OWNER Membership; mark Lead activated.

    Returns (user, organization, membership). Caller issues JWTs.
    """
    from apps.accounts.models import User

    lead = Lead.objects.select_for_update().get(
        activation_token_hash=hash_token(raw_token),
        status=Lead.Status.CALLBACK_COMPLETED,
    )
    if lead.activation_token_expires_at and timezone.now() >= lead.activation_token_expires_at:
        raise ValueError("Activation token expired")

    if User.objects.filter(email=lead.email).exists():
        raise ValueError("An account with this email already exists")

    public_id_seed = lead.email.split("@")[0][:24].upper().replace(".", "-")
    public_id = f"{public_id_seed}-{lead.id}"
    org = Organization.objects.create(
        type=lead.account_type,
        status=Organization.Status.KYC_PENDING,
        name=lead.company_name,
        public_id=public_id,
        contact_email=lead.email,
        contact_phone=lead.phone,
        signup_source=(
            Organization.SignupSource.CLIENT_FORM
            if lead.account_type == Organization.Type.CLIENT
            else Organization.SignupSource.SUPPLIER_FORM
        ),
        signup_intent=lead.signup_intent,
        expected_monthly_volume_sar=lead.expected_monthly_volume_sar,
    )

    user = User.objects.create_user(email=lead.email, password=password)
    user.full_name = lead.full_name
    user.phone = lead.phone
    user.save(update_fields=["full_name", "phone"])

    membership = Membership.objects.create(
        user=user, organization=org, role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )

    lead.status = Lead.Status.ACTIVATED
    lead.activated_at = timezone.now()
    lead.activation_token_hash = ""        # one-shot — burn it
    lead.resulting_organization = org
    lead.save(update_fields=[
        "status", "activated_at", "activation_token_hash",
        "resulting_organization", "updated_at",
    ])

    return user, org, membership


@transaction.atomic
def complete_onboarding(
    *,
    organization: Organization,
    cr_number: str = "",
    vat_number: str = "",
    legal_name: str = "",
    legal_name_ar: str = "",
) -> Organization:
    """First-login wizard finalization. Sets `onboarding_completed=True` so
    the dashboard wizard doesn't re-appear."""
    if cr_number:
        organization.cr_number = cr_number
    if vat_number:
        organization.vat_number = vat_number
    if legal_name:
        organization.legal_name = legal_name
    if legal_name_ar:
        organization.legal_name_ar = legal_name_ar
    organization.onboarding_completed = True
    organization.save(update_fields=[
        "cr_number", "vat_number", "legal_name", "legal_name_ar",
        "onboarding_completed", "updated_at",
    ])
    return organization

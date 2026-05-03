from django.conf import settings
from django.db import models
from django.utils import timezone


class Organization(models.Model):
    """The tenant. One row per real-world legal entity (client OR supplier)."""

    class Type(models.TextChoices):
        CLIENT = "CLIENT", "Client"
        SUPPLIER = "SUPPLIER", "Supplier"

    class Status(models.TextChoices):
        INVITED = "INVITED", "Invited"
        KYC_PENDING = "KYC_PENDING", "KYC pending"
        KYC_REVIEW = "KYC_REVIEW", "KYC under review"
        ACTIVE = "ACTIVE", "Active"
        SUSPENDED = "SUSPENDED", "Suspended"
        ARCHIVED = "ARCHIVED", "Archived"

    type = models.CharField(max_length=16, choices=Type.choices)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.INVITED
    )

    name = models.CharField(max_length=255)
    legal_name = models.CharField(max_length=255, blank=True)
    legal_name_ar = models.CharField(max_length=255, blank=True)
    public_id = models.CharField(max_length=32, unique=True)
    # Anonymity layer — the only thing the OPPOSITE party sees about this org.
    # Generated once at activation, immutable. `Client-A8B4` for clients,
    # `Supplier Violet` for suppliers. See apps.core.aliases.
    # Nullable so the backfill migration can run on legacy rows safely
    # (Postgres' unique index ignores NULLs).
    platform_alias = models.CharField(
        max_length=64, unique=True, db_index=True, null=True, blank=True,
    )
    cr_number = models.CharField(max_length=64, blank=True)
    vat_number = models.CharField(max_length=64, blank=True)

    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=32, blank=True)

    # Monetization seams. Populated when billing ships (commission for
    # suppliers, subscription for clients, or hybrid).
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=4, null=True, blank=True
    )
    subscription_status = models.CharField(max_length=16, default="none")
    stripe_customer_id = models.CharField(max_length=64, blank=True)

    activated_at = models.DateTimeField(null=True, blank=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    suspension_reason = models.TextField(blank=True)

    # R2 — Lead/callback signup metadata. Captured at registration (Lead),
    # copied onto the Organization when the lead activates.
    class SignupSource(models.TextChoices):
        CLIENT_FORM = "CLIENT_FORM", "Public client form"
        SUPPLIER_FORM = "SUPPLIER_FORM", "Public supplier form"
        ADMIN_INVITED = "ADMIN_INVITED", "Created by MWRD staff"

    signup_source = models.CharField(
        max_length=24, choices=SignupSource.choices,
        default=SignupSource.ADMIN_INVITED,
    )
    signup_intent = models.TextField(blank=True)  # free-text reason
    expected_monthly_volume_sar = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
    )
    onboarding_completed = models.BooleanField(default=False)

    # R5 — per-supplier auto-quote review window. Used by the auto-quote
    # engine to compute `Quote.auto_send_at`. Only meaningful for SUPPLIER
    # orgs but stored on every row so the field doesn't leak across tables.
    class AutoQuoteWindow(models.TextChoices):
        INSTANT = "INSTANT", "Send immediately"
        WINDOW_30M = "WINDOW_30M", "Hold 30 minutes for review"
        WINDOW_2H = "WINDOW_2H", "Hold 2 hours for review"

    auto_quote_review_window = models.CharField(
        max_length=16, choices=AutoQuoteWindow.choices,
        default=AutoQuoteWindow.WINDOW_30M,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["type", "status"]),
            models.Index(fields=["public_id"]),
        ]

    def save(self, *args, **kwargs):
        # Auto-allocate platform_alias on first save. The spec's anonymity
        # rule depends on every org HAVING an alias — fail-safe at the model
        # layer rather than relying on every caller remembering.
        if not self.platform_alias:
            from apps.organizations.services import allocate_alias
            self.platform_alias = allocate_alias(type=self.type)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.type})"


class Membership(models.Model):
    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        ADMIN = "ADMIN", "Admin"
        BUYER = "BUYER", "Buyer"
        APPROVER = "APPROVER", "Approver"
        VIEWER = "VIEWER", "Viewer"

    class Status(models.TextChoices):
        INVITED = "INVITED", "Invited"
        ACTIVE = "ACTIVE", "Active"
        REMOVED = "REMOVED", "Removed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=16, choices=Role.choices)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "organization"], name="uniq_membership_user_org"
            ),
        ]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["organization", "role"]),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}@{self.organization_id} [{self.role}]"


class Invite(models.Model):
    """Invite token. Raw token is emailed once; only its hash is stored."""

    class Kind(models.TextChoices):
        OWNER = "OWNER", "Owner invite (from MWRD staff)"
        TEAM = "TEAM", "Team invite (from org owner)"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        REVOKED = "REVOKED", "Revoked"
        EXPIRED = "EXPIRED", "Expired"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="invites"
    )
    email = models.EmailField()
    role = models.CharField(max_length=16, choices=Membership.Role.choices)
    kind = models.CharField(max_length=8, choices=Kind.choices)

    token_hash = models.CharField(max_length=128, unique=True)
    expires_at = models.DateTimeField()
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING
    )

    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="invites_sent",
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="invites_accepted",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["email", "status"]),
        ]

    def __str__(self) -> str:
        return f"Invite<{self.email} → org={self.organization_id} [{self.status}]>"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at


class Lead(models.Model):
    """Public-registration record. Captures the minimal form data; ops calls
    the prospect within 24 h, marks the callback complete, which generates an
    activation token and emails it. Activation creates the User + Org + OWNER
    Membership in one atomic step.

    A Lead is distinct from an Invite — Invite is staff-initiated, Lead is
    self-service.
    """

    class Status(models.TextChoices):
        PENDING_CALLBACK = "PENDING_CALLBACK", "Pending callback"
        CALLBACK_COMPLETED = "CALLBACK_COMPLETED", "Callback completed"
        ACTIVATED = "ACTIVATED", "Activated"
        REJECTED = "REJECTED", "Rejected"

    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=32)
    account_type = models.CharField(
        max_length=16,
        choices=[
            (Organization.Type.CLIENT, "Client"),
            (Organization.Type.SUPPLIER, "Supplier"),
        ],
    )
    company_name = models.CharField(max_length=255)
    signup_intent = models.TextField(blank=True)
    expected_monthly_volume_sar = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
    )

    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.PENDING_CALLBACK,
    )
    callback_notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)

    # Activation token issued when ops marks the callback complete.
    # Hash stored, raw value emailed once and never persisted.
    activation_token_hash = models.CharField(
        max_length=128, blank=True, db_index=True,
    )
    activation_token_expires_at = models.DateTimeField(null=True, blank=True)

    callback_completed_at = models.DateTimeField(null=True, blank=True)
    callback_completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        null=True, blank=True, related_name="+",
    )
    activated_at = models.DateTimeField(null=True, blank=True)
    # Once activated, point at the resulting org for traceability.
    resulting_organization = models.ForeignKey(
        Organization, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="leads",
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["email", "status"]),
        ]

    def __str__(self) -> str:
        return f"Lead<{self.email} [{self.status}]>"

from django.conf import settings
from django.db import models


class KycSubmission(models.Model):
    """One submission per org (the latest one). On rejection a fresh submission
    is created so we keep historical records."""

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted for review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        CHANGES_REQUESTED = "CHANGES_REQUESTED", "Changes requested"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="kyc_submissions",
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )

    legal_name = models.CharField(max_length=255)
    legal_name_ar = models.CharField(max_length=255, blank=True)
    cr_number = models.CharField(max_length=64, blank=True)
    vat_number = models.CharField(max_length=64, blank=True)
    address_line1 = models.CharField(max_length=255, blank=True)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=128, blank=True)
    country = models.CharField(max_length=64, blank=True, default="SA")

    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="+",
    )
    review_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["organization", "-created_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"KYC<{self.organization_id} [{self.status}]>"


class KycDocument(models.Model):
    """Pointer to a file in S3-compatible storage. The bytes never live on
    the Django server — uploads go directly via signed URL."""

    class Kind(models.TextChoices):
        CR = "CR", "Commercial registration"
        VAT = "VAT", "VAT certificate"
        BANK_LETTER = "BANK_LETTER", "Bank letter"
        ID_CARD = "ID_CARD", "ID card"
        OTHER = "OTHER", "Other"

    submission = models.ForeignKey(
        KycSubmission, on_delete=models.CASCADE, related_name="documents"
    )
    kind = models.CharField(max_length=24, choices=Kind.choices)
    storage_key = models.CharField(max_length=512)  # S3 key
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=128)
    size_bytes = models.BigIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["submission"])]

    def __str__(self) -> str:
        return f"{self.kind}:{self.original_filename}"

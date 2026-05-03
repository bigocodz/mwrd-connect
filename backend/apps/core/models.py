from django.db import models

from .managers import TenantScopedManager

# R11 — re-export DocumentSequence so Django's app loader sees it.
from .numbering_models import DocumentSequence  # noqa: F401


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class TenantScopedModel(TimestampedModel):
    """Base for org-private content (catalog, KYC docs, internal team data)."""

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="+",
    )

    class Meta:
        abstract = True
        indexes = [models.Index(fields=["organization", "-created_at"])]

    objects = TenantScopedManager()
    all_objects = models.Manager()


class SoftDeleteModel(models.Model):
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        abstract = True

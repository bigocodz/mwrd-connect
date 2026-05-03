"""Append-only audit log.

Every meaningful state transition fires `record_event()` — the JSON `payload`
captures the diff in a query-friendly way (Postgres GIN index over JSONB).
Rows are immutable: services never UPDATE or DELETE, only INSERT.
"""
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.contrib.postgres.indexes import GinIndex
from django.db import models


class AuditLog(models.Model):
    # Who acted (nullable for system / Celery-task actions)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        null=True, blank=True, related_name="+",
    )
    # Which org's audit trail this belongs to (a transaction can affect both
    # client and supplier — the writer stamps the more relevant one).
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT,
        null=True, blank=True, related_name="+",
    )

    # What happened
    action = models.CharField(max_length=64, db_index=True)  # e.g. "rfq.publish"

    # Target object (polymorphic) — nullable so generic events can be logged
    target_ct = models.ForeignKey(
        ContentType, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
    )
    target_id = models.PositiveBigIntegerField(null=True, blank=True)
    target = GenericForeignKey("target_ct", "target_id")

    # Free-form structured details
    payload = models.JSONField(default=dict, blank=True)

    request_id = models.CharField(max_length=64, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["organization", "-created_at"]),
            models.Index(fields=["target_ct", "target_id", "-created_at"]),
            models.Index(fields=["action", "-created_at"]),
            GinIndex(fields=["payload"]),
        ]

    def __str__(self) -> str:
        return f"AuditLog<{self.action} target={self.target_ct_id}:{self.target_id}>"

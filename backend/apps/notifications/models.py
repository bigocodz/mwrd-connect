"""In-app notification inbox.

The `notify()` service in services.py writes one Notification per recipient,
and optionally also enqueues an email task. Templates for the email layer
live in apps/notifications/templates/emails/.
"""
from django.conf import settings
from django.db import models


class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications",
    )
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE,
        related_name="notifications", null=True, blank=True,
    )

    kind = models.CharField(max_length=64, db_index=True)  # e.g. "rfq.published"
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    # Free-form object identifying the related entity, e.g. {"target": "rfq:42"}
    payload = models.JSONField(default=dict, blank=True)

    read_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "read_at", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Notification<u={self.user_id} {self.kind}>"

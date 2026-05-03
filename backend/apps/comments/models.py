"""Polymorphic comment thread.

A Comment is attached to any model via GenericForeignKey. Visibility is
gated at the view layer — the rule for v1 is: any user whose active org is
party to the target object can see + post. Concretely: client_org and
supplier_org of an RFQ/Order/Contract see the same thread.
"""
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class Comment(models.Model):
    target_ct = models.ForeignKey(ContentType, on_delete=models.PROTECT, related_name="+")
    target_id = models.PositiveBigIntegerField()
    target = GenericForeignKey("target_ct", "target_id")

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+",
    )
    author_org = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="+",
        null=True, blank=True,
    )
    body = models.TextField()
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["target_ct", "target_id", "created_at"]),
            models.Index(fields=["author", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Comment<by={self.author_id} on={self.target_ct_id}:{self.target_id}>"

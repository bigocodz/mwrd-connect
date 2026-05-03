"""Persistence backing R11 numbering — kept in a separate module so the
service-layer `numbering.py` can import models without `numbering` being
loaded at app-import time (avoids django app-loading order pitfalls).
"""
from django.db import models


class DocumentSequence(models.Model):
    """One row per (kind, date_key). The unique index lets `get_or_create`
    do its single-row upsert atomically."""

    kind = models.CharField(max_length=8)
    # YYYYMMDD for per-day sequences; "ALL" for date-less sequences (PROD).
    date_key = models.CharField(max_length=12)
    value = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["kind", "date_key"], name="uniq_doc_seq_kind_date",
            ),
        ]
        indexes = [models.Index(fields=["kind", "date_key"])]

    def __str__(self) -> str:
        return f"DocSeq<{self.kind} {self.date_key} = {self.value}>"

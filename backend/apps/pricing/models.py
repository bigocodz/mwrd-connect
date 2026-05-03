"""Margin rules.

Spec § "Margin rules — NEVER violate":
- One row per scope. Resolution order: client > category > global.
- `pct` is the markup over supplier cost: final = cost * (1 + pct/100).
- Stored as a percentage (e.g. 15.00 means 15%) for human readability;
  service code converts to a multiplier internally.
- Margin values are SERVER-SIDE ONLY. They never appear in a client-facing
  or supplier-facing API response. Backoffice (staff scope) is the only
  place margin is rendered.
"""
from django.conf import settings
from django.db import models


class Margin(models.Model):
    class Scope(models.TextChoices):
        GLOBAL = "GLOBAL", "Global"
        CATEGORY = "CATEGORY", "Per-category"
        CLIENT = "CLIENT", "Per-client"

    scope = models.CharField(max_length=12, choices=Scope.choices)
    # NULL for GLOBAL; FK id for CATEGORY (catalog.Category) or
    # CLIENT (organizations.Organization, type=CLIENT).
    scope_id = models.PositiveBigIntegerField(null=True, blank=True, db_index=True)
    pct = models.DecimalField(max_digits=6, decimal_places=2)

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+",
        null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # One row per (scope, scope_id). For GLOBAL we enforce a single
            # row via a partial unique on scope='GLOBAL' + scope_id IS NULL.
            models.UniqueConstraint(
                fields=["scope", "scope_id"],
                name="uniq_margin_per_scope",
            ),
        ]
        indexes = [
            models.Index(fields=["scope", "scope_id"]),
        ]

    def __str__(self) -> str:
        if self.scope == self.Scope.GLOBAL:
            return f"Margin<GLOBAL = {self.pct}%>"
        return f"Margin<{self.scope}:{self.scope_id} = {self.pct}%>"

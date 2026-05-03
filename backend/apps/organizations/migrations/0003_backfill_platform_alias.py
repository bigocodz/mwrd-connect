"""Backfill platform_alias for organizations created before R1 (anonymity).

Deterministic per-id values so dev/staging/prod migrate to the same alias.
"""
from __future__ import annotations

import hashlib

from django.db import migrations

SUPPLIER_COLOURS = (
    "Violet", "Indigo", "Teal", "Amber",
    "Coral", "Sage", "Rose", "Slate",
)


def _client_alias_for(pk: int, salt: int = 0) -> str:
    h = hashlib.sha256(f"org:{pk}:{salt}".encode()).hexdigest().upper()
    return f"Client-{h[:4]}"


def _supplier_alias_for(seq: int) -> str:
    round_n, idx = divmod(seq, len(SUPPLIER_COLOURS))
    colour = SUPPLIER_COLOURS[idx]
    return f"Supplier {colour}" if round_n == 0 else f"Supplier {colour} {round_n + 1}"


def forwards(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    used_aliases = set(
        Organization.objects.exclude(platform_alias__isnull=True)
        .values_list("platform_alias", flat=True)
    )
    supplier_seq = 0

    qs = Organization.objects.filter(platform_alias__isnull=True).order_by("id")
    for org in qs:
        if org.type == "CLIENT":
            alias = _client_alias_for(org.id)
            salt = 0
            while alias in used_aliases:
                salt += 1
                alias = _client_alias_for(org.id, salt=salt)
        else:
            alias = _supplier_alias_for(supplier_seq)
            while alias in used_aliases:
                supplier_seq += 1
                alias = _supplier_alias_for(supplier_seq)
            supplier_seq += 1
        org.platform_alias = alias
        org.save(update_fields=["platform_alias"])
        used_aliases.add(alias)


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0002_organization_platform_alias"),
    ]
    operations = [
        migrations.RunPython(forwards, backwards),
    ]

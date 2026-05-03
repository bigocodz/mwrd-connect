"""Platform aliases for the anonymity layer.

Spec: every cross-org API response must show `platform_alias`, never the
real name. Aliases are generated once at registration and never change.

Format:
    Client orgs:    'Client-' + 4 alphanumeric upper, e.g. 'Client-A8B4'
    Supplier orgs:  'Supplier ' + colour from a fixed pool,
                    'Supplier Violet', 'Supplier Indigo', etc.

The colour pool wraps once exhausted with a numeric suffix:
    'Supplier Violet 2', 'Supplier Indigo 2', ... so aliases stay unique.

User aliases mirror their primary organization's alias (with their email's
local part hashed in for ambiguity within the org). The display name shown
across the wire is the org alias unless the receiver is staff.
"""
from __future__ import annotations

import secrets
import string

SUPPLIER_COLOURS = (
    "Violet", "Indigo", "Teal", "Amber",
    "Coral", "Sage", "Rose", "Slate",
)

_CLIENT_ALPHABET = string.ascii_uppercase + string.digits


def gen_client_alias() -> str:
    """Random 4-char [A-Z0-9] suffix. ~1.6M combinations — collision-resistant
    until ~1k orgs (caller still does a uniqueness check)."""
    suffix = "".join(secrets.choice(_CLIENT_ALPHABET) for _ in range(4))
    return f"Client-{suffix}"


def gen_supplier_alias(*, used_aliases: set[str]) -> str:
    """Pick the next colour not yet used. Wraps to '<Colour> 2' / '3' / ... .
    Caller passes the set of already-used aliases (one query, deduped)."""
    for round_n in range(1, 1000):
        for colour in SUPPLIER_COLOURS:
            candidate = f"Supplier {colour}" if round_n == 1 else f"Supplier {colour} {round_n}"
            if candidate not in used_aliases:
                return candidate
    raise RuntimeError("Supplier alias pool exhausted (>8000 suppliers).")

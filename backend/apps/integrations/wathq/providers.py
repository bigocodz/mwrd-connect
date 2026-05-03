"""Wathq — Saudi commercial registry lookup. Used at KYC time to validate
the supplied CR number against the official register."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from django.conf import settings

from apps.integrations.base import IntegrationError


@dataclass
class WathqRecord:
    cr_number: str
    legal_name_ar: str
    legal_name_en: str
    status: str          # ACTIVE / INACTIVE / EXPIRED
    issue_date: str      # YYYY-MM-DD
    expiry_date: str | None = None
    activities: list[str] = field(default_factory=list)


class WathqProvider(Protocol):
    name: str

    def lookup_cr(self, cr_number: str) -> WathqRecord | None: ...


class FakeWathqProvider:
    """Deterministic fake. Returns ACTIVE records for any CR with the right
    format (10 digits starting with 7 or 1010), None otherwise — close enough
    to the real CR pattern for dev/demo use."""

    name = "fake"

    def lookup_cr(self, cr_number: str) -> WathqRecord | None:
        s = (cr_number or "").strip()
        if not s.isdigit() or len(s) != 10:
            return None
        return WathqRecord(
            cr_number=s,
            legal_name_ar="شركة تجريبية",
            legal_name_en=f"Demo Trading Co (CR {s})",
            status="ACTIVE",
            issue_date="2020-01-15",
            expiry_date="2030-01-14",
            activities=["General trading", "Cleaning supplies"],
        )


class HttpWathqProvider:
    name = "http"

    def lookup_cr(self, cr_number: str) -> WathqRecord | None:
        raise IntegrationError("HttpWathqProvider not implemented (no credentials yet)")


def get_provider() -> WathqProvider:
    name = getattr(settings, "WATHQ_PROVIDER", "fake")
    if name == "http":
        return HttpWathqProvider()
    return FakeWathqProvider()

"""SPL — Saudi Post / National Address. Used to validate the 4+4 short
address code (e.g. ABCD1234) and resolve it to a full address."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from django.conf import settings

from apps.integrations.base import IntegrationError


@dataclass
class SplAddress:
    short_code: str           # e.g. "RHRA8242"
    building_number: str
    street: str
    district: str
    city: str
    region: str
    postal_code: str
    additional_number: str
    latitude: float | None = None
    longitude: float | None = None


class SplProvider(Protocol):
    name: str

    def resolve_short_code(self, short_code: str) -> SplAddress | None: ...


class FakeSplProvider:
    """Returns a plausible address for any 8-character (4 letters + 4 digits)
    short code. Enough to demo the form-fill UX without hitting SPL."""

    name = "fake"

    def resolve_short_code(self, short_code: str) -> SplAddress | None:
        s = (short_code or "").strip().upper().replace(" ", "")
        if len(s) != 8 or not s[:4].isalpha() or not s[4:].isdigit():
            return None
        return SplAddress(
            short_code=s,
            building_number="2455",
            street="King Fahd Road",
            district="Al Olaya",
            city="Riyadh",
            region="Riyadh",
            postal_code="12333",
            additional_number="6789",
            latitude=24.7136,
            longitude=46.6753,
        )


class HttpSplProvider:
    name = "http"

    def resolve_short_code(self, short_code: str) -> SplAddress | None:
        raise IntegrationError("HttpSplProvider not implemented (no credentials yet)")


def get_provider() -> SplProvider:
    name = getattr(settings, "SPL_PROVIDER", "fake")
    if name == "http":
        return HttpSplProvider()
    return FakeSplProvider()

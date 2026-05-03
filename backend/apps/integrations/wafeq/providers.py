"""Wafeq providers.

The protocol is what domain code calls; concrete implementations are picked
at runtime via `get_provider()` based on settings.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Protocol

from django.conf import settings

from apps.integrations.base import IntegrationError


@dataclass
class WafeqContact:
    id: str
    name: str


@dataclass
class WafeqInvoice:
    id: str
    number: str
    status: str
    total: str


class WafeqProvider(Protocol):
    name: str

    def upsert_contact(self, *, organization) -> WafeqContact: ...

    def push_invoice(self, *, client_invoice) -> WafeqInvoice: ...

    def mark_paid(self, *, wafeq_invoice_id: str) -> None: ...


class FakeWafeqProvider:
    """Deterministic fake. Used in dev + tests."""

    name = "fake"

    def upsert_contact(self, *, organization) -> WafeqContact:
        digest = hashlib.sha256(f"org:{organization.id}".encode()).hexdigest()[:12]
        return WafeqContact(id=f"wfq_c_{digest}", name=organization.name)

    def push_invoice(self, *, client_invoice) -> WafeqInvoice:
        digest = hashlib.sha256(f"ci:{client_invoice.id}".encode()).hexdigest()[:12]
        return WafeqInvoice(
            id=f"wfq_i_{digest}",
            number=client_invoice.number,
            status="ISSUED",
            total=str(client_invoice.total),
        )

    def mark_paid(self, *, wafeq_invoice_id: str) -> None:
        return None


class HttpWafeqProvider:
    """Real provider. Stub: in prod this would issue HTTP calls to Wafeq's API
    using the bearer token from settings.WAFEQ_API_KEY. We leave the actual
    HTTP wiring as a TODO until we have credentials and a sandbox to test
    against — every call raises so we never accidentally use the real
    provider before that's hooked up."""

    name = "http"

    def upsert_contact(self, *, organization) -> WafeqContact:
        raise IntegrationError("HttpWafeqProvider not implemented (no credentials yet)")

    def push_invoice(self, *, client_invoice) -> WafeqInvoice:
        raise IntegrationError("HttpWafeqProvider not implemented (no credentials yet)")

    def mark_paid(self, *, wafeq_invoice_id: str) -> None:
        raise IntegrationError("HttpWafeqProvider not implemented (no credentials yet)")


def get_provider() -> WafeqProvider:
    name = getattr(settings, "WAFEQ_PROVIDER", "fake")
    if name == "http":
        return HttpWafeqProvider()
    return FakeWafeqProvider()

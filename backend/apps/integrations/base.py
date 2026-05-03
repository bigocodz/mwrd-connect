"""Shared provider pattern.

Each external integration ships two implementations:
- a Real* provider that calls the actual third-party HTTP API
- a Fake* provider returning deterministic data

The factory in each subpackage picks one based on `settings.<KEY>_PROVIDER`.
Tests force the fake provider; dev defaults to fake; prod must explicitly
set the real provider AND credentials.

This keeps integration code testable without network hits, and makes it
trivial to swap a vendor (e.g. if Wafeq is ever replaced).
"""
from __future__ import annotations

from typing import Protocol


class IntegrationError(Exception):  # noqa: N818
    """Raised when an external integration call fails."""


class Provider(Protocol):
    """Marker. Each subpackage defines its own protocol with concrete methods."""

    name: str

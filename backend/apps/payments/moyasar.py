"""R13 — Moyasar Payment provider (stub).

Spec § Moyasar: "stub in MVP (mock payment intent), real implementation in
Phase 3". The provider exposes three operations the order/invoice flow
calls into:

- `create_payment_intent(invoice, ...)` — returns an intent dict with `id`
  and `redirect_url`. The id is what we persist on the Payment row.
- `capture_payment(intent_id, ...)` — confirms the charge. In stub mode
  this just flips the recorded provider_status to 'paid'.
- `refund_payment(intent_id, amount)` — issues a (partial or full) refund.

Switch by `MOYASAR_PROVIDER` setting:
    fake → in-process stub used by tests / dev.
    http → real HTTPS calls to api.moyasar.com (Phase 3).

The stub is deterministic, generates ids like `pi_mock_<uuid4>`, and
records call history in a process-local list so tests can assert which
provider operations fired.
"""
from __future__ import annotations

import abc
import secrets
from dataclasses import dataclass, field
from decimal import Decimal
from typing import ClassVar


@dataclass
class PaymentIntent:
    id: str
    amount_sar: Decimal
    invoice_id: int
    status: str = "pending"
    provider: str = "moyasar"
    redirect_url: str = ""


class MoyasarProvider(abc.ABC):
    """Abstract interface — same surface for stub and real impls."""

    @abc.abstractmethod
    def create_payment_intent(self, *, invoice, callback_url: str = "") -> PaymentIntent: ...

    @abc.abstractmethod
    def capture_payment(self, intent_id: str) -> PaymentIntent: ...

    @abc.abstractmethod
    def refund_payment(self, intent_id: str, amount: Decimal) -> PaymentIntent: ...


@dataclass
class FakeMoyasarProvider(MoyasarProvider):
    """In-process implementation suitable for dev + tests."""

    intents: dict[str, PaymentIntent] = field(default_factory=dict)
    call_log: list[tuple[str, dict]] = field(default_factory=list)

    # Class-level singleton so tests across modules can assert call history.
    _instance: ClassVar[FakeMoyasarProvider | None] = None

    @classmethod
    def shared(cls) -> FakeMoyasarProvider:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def reset(self) -> None:
        self.intents.clear()
        self.call_log.clear()

    def create_payment_intent(self, *, invoice, callback_url: str = "") -> PaymentIntent:
        pid = f"pi_mock_{secrets.token_hex(8)}"
        intent = PaymentIntent(
            id=pid,
            amount_sar=Decimal(invoice.total),
            invoice_id=invoice.id,
            status="pending",
            redirect_url=callback_url or f"/mock-moyasar/{pid}",
        )
        self.intents[pid] = intent
        self.call_log.append((
            "create_payment_intent",
            {"intent_id": pid, "invoice_id": invoice.id},
        ))
        return intent

    def capture_payment(self, intent_id: str) -> PaymentIntent:
        intent = self.intents.get(intent_id)
        if intent is None:
            raise ValueError(f"Unknown intent {intent_id}")
        intent.status = "paid"
        self.call_log.append(("capture_payment", {"intent_id": intent_id}))
        return intent

    def refund_payment(self, intent_id: str, amount: Decimal) -> PaymentIntent:
        intent = self.intents.get(intent_id)
        if intent is None:
            raise ValueError(f"Unknown intent {intent_id}")
        if Decimal(amount) > Decimal(intent.amount_sar):
            raise ValueError("Refund exceeds captured amount")
        intent.status = (
            "refunded" if Decimal(amount) >= Decimal(intent.amount_sar)
            else "partially_refunded"
        )
        self.call_log.append((
            "refund_payment",
            {"intent_id": intent_id, "amount": str(amount)},
        ))
        return intent


def get_provider() -> MoyasarProvider:
    """Look up the configured provider. Currently only `fake` is wired —
    the `http` swap-in lands in Phase 3 per spec."""
    from django.conf import settings

    name = getattr(settings, "MOYASAR_PROVIDER", "fake")
    if name == "fake":
        return FakeMoyasarProvider.shared()
    raise NotImplementedError(
        f"Moyasar provider '{name}' not implemented yet — see R13 spec",
    )

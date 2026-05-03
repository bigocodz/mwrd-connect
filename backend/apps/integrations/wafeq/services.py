"""High-level Wafeq sync service. Domain code calls these; they handle the
provider call + persistence."""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.integrations.base import IntegrationError

from .models import WafeqContactSync, WafeqInvoiceSync
from .providers import get_provider


@transaction.atomic
def sync_contact_for(organization) -> WafeqContactSync:
    """Upsert the Wafeq Contact for an org and persist the mapping."""
    provider = get_provider()
    contact = provider.upsert_contact(organization=organization)
    sync, _ = WafeqContactSync.objects.update_or_create(
        organization=organization,
        defaults={"wafeq_contact_id": contact.id},
    )
    return sync


@transaction.atomic
def push_client_invoice(client_invoice) -> WafeqInvoiceSync:
    """Push a ClientInvoice into Wafeq. Idempotent — re-pushing an already
    PUSHED invoice is a no-op."""
    provider = get_provider()
    sync, created = WafeqInvoiceSync.objects.get_or_create(
        client_invoice=client_invoice,
        defaults={"status": WafeqInvoiceSync.Status.QUEUED},
    )
    if not created and sync.status == WafeqInvoiceSync.Status.PUSHED:
        return sync

    # Make sure the client org has a contact first
    sync_contact_for(client_invoice.client_org)

    try:
        result = provider.push_invoice(client_invoice=client_invoice)
    except IntegrationError as e:
        sync.status = WafeqInvoiceSync.Status.FAILED
        sync.last_error = str(e)
        sync.save(update_fields=["status", "last_error", "updated_at"])
        raise

    sync.wafeq_invoice_id = result.id
    sync.status = WafeqInvoiceSync.Status.PUSHED
    sync.last_error = ""
    sync.pushed_at = timezone.now()
    sync.save(update_fields=[
        "wafeq_invoice_id", "status", "last_error", "pushed_at", "updated_at",
    ])
    return sync

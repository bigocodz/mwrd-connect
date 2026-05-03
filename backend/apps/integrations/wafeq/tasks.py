"""Celery tasks for Wafeq sync."""
from celery import shared_task

from apps.invoicing.models import ClientInvoice

from .services import push_client_invoice


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def push_client_invoice_to_wafeq(self, client_invoice_id: int) -> None:
    ci = ClientInvoice.objects.get(id=client_invoice_id)
    push_client_invoice(ci)

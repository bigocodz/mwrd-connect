"""Celery tasks for the quote auto-send pipeline.

Strategy: rather than scheduling per-quote ETA jobs (which lose state if Redis
restarts and require us to track job IDs), we run a small periodic beat task
that polls for DRAFT_AUTO quotes whose `auto_send_at` has passed. The DB index
on (status, auto_send_at) keeps this O(due-rows).

Spec § auto-quote engine: "If the supplier doesn't intervene within the
review window, the system sends it automatically."
"""
import logging

from celery import shared_task

logger = logging.getLogger("apps.quotes")


@shared_task(name="apps.quotes.process_due_auto_quotes")
def process_due_auto_quotes_task() -> int:
    """Beat task entry point. Wraps services.process_due_auto_quotes so the
    business logic stays in services.py and the task is a thin shim."""
    from apps.quotes.services import process_due_auto_quotes

    n = process_due_auto_quotes()
    if n:
        logger.info(
            "quotes.auto_send.batch", extra={"event": "quotes.auto_send.batch", "count": n},
        )
    return n

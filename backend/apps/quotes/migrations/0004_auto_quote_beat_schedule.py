"""Register the periodic beat schedule for `process_due_auto_quotes`.

Runs every minute. The task itself is cheap when there's nothing due (one
indexed query against `(status, auto_send_at)`).

Idempotent: uses get_or_create on the IntervalSchedule + PeriodicTask. Safe to
re-run; safe to delete the row in admin if you want to pause auto-send.
"""
from django.db import migrations


def add_schedule(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    interval, _ = IntervalSchedule.objects.get_or_create(
        every=1, period="minutes",
    )
    PeriodicTask.objects.get_or_create(
        name="quotes.process_due_auto_quotes",
        defaults={
            "task": "apps.quotes.process_due_auto_quotes",
            "interval": interval,
            "enabled": True,
            "description": "R5 auto-quote engine: send DRAFT_AUTO quotes whose review window expired.",
        },
    )


def remove_schedule(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="quotes.process_due_auto_quotes").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("quotes", "0003_quote_admin_held_reason_quote_applied_margin_pct_and_more"),
        ("django_celery_beat", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(add_schedule, remove_schedule),
    ]

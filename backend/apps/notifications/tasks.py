"""Celery tasks for notification delivery.

Tasks accept primitive args (ids + raw token), look up the live data, render,
and send. Raw tokens are passed as args (not stored on disk anywhere) so the
worker has them just long enough to render the URL into the email body.
"""
import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from apps.organizations.models import Invite, Organization

logger = logging.getLogger("apps.notifications")


def _portal_url_for(org_type: str) -> str:
    return (
        settings.FRONTEND_CLIENT_URL
        if org_type == Organization.Type.CLIENT
        else settings.FRONTEND_SUPPLIER_URL
    )


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def send_owner_invite_email(self, invite_id: int, raw_token: str) -> None:
    invite = Invite.objects.select_related("organization").get(id=invite_id)
    org = invite.organization

    accept_url = f"{_portal_url_for(org.type)}/?invite={raw_token}"

    ctx = {
        "org_name": org.name,
        "org_type": org.type,
        "accept_url": accept_url,
        "expires_at": invite.expires_at,
    }
    subject = f"You're invited to join {org.name} on MWRD"
    text_body = render_to_string("emails/owner_invite.txt", ctx)
    html_body = render_to_string("emails/owner_invite.html", ctx)

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[invite.email],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=False)
    logger.info(
        "email.owner_invite.sent",
        extra={
            "event": "email.owner_invite.sent",
            "invite_id": invite.id,
            "org_id": org.id,
            "to": invite.email,
        },
    )


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def send_team_invite_email(self, invite_id: int, raw_token: str) -> None:
    invite = Invite.objects.select_related("organization").get(id=invite_id)
    org = invite.organization
    accept_url = f"{_portal_url_for(org.type)}/?invite={raw_token}"

    ctx = {
        "org_name": org.name,
        "role": invite.role,
        "accept_url": accept_url,
        "expires_at": invite.expires_at,
    }
    subject = f"Join {org.name} on MWRD"
    text_body = render_to_string("emails/team_invite.txt", ctx)
    html_body = render_to_string("emails/team_invite.html", ctx)

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[invite.email],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=False)
    logger.info(
        "email.team_invite.sent",
        extra={
            "event": "email.team_invite.sent",
            "invite_id": invite.id,
            "org_id": org.id,
            "to": invite.email,
        },
    )

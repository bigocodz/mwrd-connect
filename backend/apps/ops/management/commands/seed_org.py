"""Bootstrap a customer organization + owner invite from the command line.

Usage:
    uv run python manage.py seed_org \
        --type CLIENT --name 'Acme Co' --public-id ACME --email owner@acme.sa
    # → prints the raw invite token; share via the existing email channel.
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create a customer organization and an owner invite."

    def add_arguments(self, parser):
        parser.add_argument("--type", required=True, choices=["CLIENT", "SUPPLIER"])
        parser.add_argument("--name", required=True)
        parser.add_argument("--public-id", required=True)
        parser.add_argument("--email", required=True)
        parser.add_argument(
            "--actor-email", default=None,
            help="Existing staff user to record as the inviter (defaults to first superuser).",
        )

    def handle(self, *args, **opts):
        from apps.accounts.models import User
        from apps.organizations.services import (
            create_organization_with_owner_invite,
        )

        if opts["actor_email"]:
            actor = User.objects.get(email=opts["actor_email"].lower())
        else:
            actor = User.objects.filter(is_superuser=True).first()
            if actor is None:
                self.stderr.write("No superuser found. Run seed_staff first.")
                return

        org, invite, raw_token = create_organization_with_owner_invite(
            type=opts["type"],
            name=opts["name"],
            public_id=opts["public_id"],
            contact_email=opts["email"].lower(),
            invited_by=actor,
        )
        self.stdout.write(self.style.SUCCESS(
            f"Created {org.type} org #{org.id} ({org.public_id}). Invite #{invite.id}.",
        ))
        self.stdout.write(
            f"Raw invite token (DEV ONLY — in prod the email task delivers this):\n"
            f"  {raw_token}",
        )

"""Create a MWRD staff user (or update password). Optional TOTP enrollment.

Usage:
    uv run python manage.py seed_staff --email staff@mwrd.com \
        --password 'rotate-me' --enroll-totp
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create or update a MWRD staff user."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--password", required=True)
        parser.add_argument("--full-name", default="")
        parser.add_argument(
            "--enroll-totp", action="store_true",
            help="Create a confirmed TOTPDevice and print the otpauth URL to stdout.",
        )

    def handle(self, *args, **opts):
        from django_otp.plugins.otp_totp.models import TOTPDevice

        from apps.accounts.models import User

        email = opts["email"].lower()
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "is_staff": True, "is_superuser": True,
                "full_name": opts["full_name"],
            },
        )
        user.is_staff = True
        user.is_superuser = True
        user.set_password(opts["password"])
        if opts["full_name"]:
            user.full_name = opts["full_name"]
        user.save()
        self.stdout.write(self.style.SUCCESS(
            f"{'Created' if created else 'Updated'} staff user {email}",
        ))

        if opts["enroll_totp"]:
            TOTPDevice.objects.filter(user=user).delete()
            device = TOTPDevice.objects.create(user=user, name="default", confirmed=True)
            self.stdout.write(
                f"otpauth URL (scan in Google Authenticator / 1Password):\n  {device.config_url}",
            )

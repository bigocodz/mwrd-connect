from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_REFERRER_POLICY = "same-origin"

ANYMAIL = {
    "AMAZON_SES_REGION_NAME": env("AWS_S3_REGION_NAME", default="me-south-1"),
}

# Sentry — opt-in via SENTRY_DSN. We tag each event with the org_id from
# request context so on-call can filter blast radius by tenant.
SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration

    from apps.core.context import current_org_id, current_user_id

    def _tag_with_context(event, hint):
        org_id = current_org_id.get()
        user_id = current_user_id.get()
        if org_id is not None:
            event.setdefault("tags", {})["org_id"] = str(org_id)
        if user_id is not None:
            event.setdefault("user", {})["id"] = str(user_id)
        return event

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=env("SENTRY_ENVIRONMENT", default="production"),
        release=env("SENTRY_RELEASE", default=None),
        integrations=[DjangoIntegration(), CeleryIntegration()],
        traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.05),
        send_default_pii=False,
        before_send=_tag_with_context,
    )

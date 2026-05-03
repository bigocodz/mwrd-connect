from .base import *  # noqa: F401,F403
from .base import env

DEBUG = True
ALLOWED_HOSTS = ["*"]

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = env("EMAIL_HOST", default="localhost")
EMAIL_PORT = env.int("EMAIL_PORT", default=1025)

JWT_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False

# Run Celery tasks inline in dev so we don't need a worker for demos.
# Spin up a real worker (`uv run celery -A config worker -l info`) when
# you want to test the queueing/retry behaviour.
CELERY_TASK_ALWAYS_EAGER = True

INTERNAL_IPS = ["127.0.0.1"]

# Readable text logs in dev; structured JSON only in prod/test.
LOGGING["handlers"]["console"]["formatter"] = "verbose"  # noqa: F405
LOGGING["formatters"]["verbose"] = {  # noqa: F405
    "format": "{levelname:7s} {asctime} {name}: {message}",
    "style": "{",
}

from .base import *  # noqa: F401,F403

DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CELERY_TASK_ALWAYS_EAGER = True
JWT_COOKIE_SECURE = False

STORAGES["default"] = {  # noqa: F405
    "BACKEND": "django.core.files.storage.InMemoryStorage",
}

# Throttles get in the way of test runs that hit the same endpoint many times.
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = ()  # noqa: F405
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {  # noqa: F405
    # Per-view ScopedRateThrottle still demands rates for known scopes;
    # unrealistically high so tests never trip them.
    "login": "10000/min",
    "anon": "10000/min",
    "user": "10000/min",
    "org": "10000/min",
    "org-write": "10000/min",
}

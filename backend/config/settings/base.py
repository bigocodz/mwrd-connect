from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
env_file = BASE_DIR / ".env"
if env_file.exists():
    env.read_env(env_file)

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "corsheaders",
    "django_otp",
    "django_otp.plugins.otp_totp",
    "django_celery_beat",
    "storages",
    "anymail",
    "apps.core",
    "apps.accounts",
    "apps.organizations",
    "apps.notifications",
    "apps.kyc",
    "apps.catalog",
    "apps.rfqs",
    "apps.quotes",
    "apps.contracts",
    "apps.orders",
    "apps.fulfillment",
    "apps.invoicing",
    "apps.payments",
    "apps.audit",
    "apps.comments",
    "apps.dashboards",
    "apps.integrations.wafeq",
    "apps.integrations.wathq",
    "apps.integrations.spl",
    "apps.dataops",
    "apps.pricing",
    "apps.approvals",
    "apps.shopping",
    "apps.ops",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django_otp.middleware.OTPMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.AuditContextMiddleware",
    "apps.core.middleware.CurrentOrgMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": env.db("DATABASE_URL")}

AUTH_USER_MODEL = "accounts.User"

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Riyadh"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.authentication.JWTCookieAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.CursorPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "1000/min",
        "login": "10/min",
        "org": "600/min",
        "org-write": "120/min",
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "MWRD API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "SIGNING_KEY": env("JWT_SIGNING_KEY"),
    "ALGORITHM": "HS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
}

JWT_COOKIE_NAME = "mwrd_access"
JWT_REFRESH_COOKIE_NAME = "mwrd_refresh"
JWT_COOKIE_DOMAIN = env("COOKIE_DOMAIN", default=None)
JWT_COOKIE_SECURE = env.bool("COOKIE_SECURE", default=True)
JWT_COOKIE_SAMESITE = "Lax"

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

# S3-compatible storage. endpoint_url unset → real AWS S3.
# Set endpoint_url for MinIO (dev) or Cloudflare R2 (alternate prod).
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": env("AWS_STORAGE_BUCKET_NAME"),
            "endpoint_url": env("AWS_S3_ENDPOINT_URL", default=None),
            "region_name": env("AWS_S3_REGION_NAME", default="us-east-1"),
            "addressing_style": env("AWS_S3_ADDRESSING_STYLE", default="virtual"),
            "signature_version": env("AWS_S3_SIGNATURE_VERSION", default="s3v4"),
            "default_acl": None,
            "querystring_auth": True,
            "querystring_expire": 600,
        },
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default=None)
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default=None)

CELERY_BROKER_URL = env("CELERY_BROKER_URL")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND")
CELERY_TASK_ALWAYS_EAGER = False
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_TIMEZONE = TIME_ZONE

EMAIL_BACKEND = env("EMAIL_BACKEND", default="anymail.backends.amazon_ses.EmailBackend")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="no-reply@mwrd.com")

FRONTEND_CLIENT_URL = env("FRONTEND_CLIENT_URL")
FRONTEND_SUPPLIER_URL = env("FRONTEND_SUPPLIER_URL")
FRONTEND_ADMIN_URL = env("FRONTEND_ADMIN_URL")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

INVITE_TOKEN_TTL_DAYS = 7

# R4 — Margin engine defaults. Spec § "Margin rules" says global default is
# 15% and quotes above SAR 25,000 hold for admin Quote Manager review.
DEFAULT_MARGIN_PCT = env("DEFAULT_MARGIN_PCT", default="15.00")
# Read as a string then let Decimal() consume it — django-environ doesn't
# expose a `.decimal()` helper across all versions.
AUTO_QUOTE_ADMIN_HOLD_THRESHOLD_SAR = env(
    "AUTO_QUOTE_ADMIN_HOLD_THRESHOLD_SAR", default="25000.00",
)

# R12 — three-way match (PO × GRN × Invoice). Spec: "within 2% variance".
THREE_WAY_MATCH_VARIANCE_PCT = env("THREE_WAY_MATCH_VARIANCE_PCT", default="2.0")

# R13 — Moyasar payment provider. Spec: stub today (`fake`), real `http`
# implementation lands Phase 3.
MOYASAR_PROVIDER = env("MOYASAR_PROVIDER", default="fake")
MOYASAR_API_KEY = env("MOYASAR_API_KEY", default="")

# Integration providers — `fake` for dev/test, `http` in prod once creds are wired.
WAFEQ_PROVIDER = env("WAFEQ_PROVIDER", default="fake")
WATHQ_PROVIDER = env("WATHQ_PROVIDER", default="fake")
SPL_PROVIDER = env("SPL_PROVIDER", default="fake")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "apps.core.logging.JsonFormatter"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "apps": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}

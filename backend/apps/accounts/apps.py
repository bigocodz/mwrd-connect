from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = "apps.accounts"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        # Register OpenAPI auth extension so drf-spectacular emits a correct
        # security scheme for our cookie-based JWT.
        from . import schema_extensions  # noqa: F401

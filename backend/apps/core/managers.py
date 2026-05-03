from django.db import models
from django.db.models import Q

from .context import current_org_id


class TenantScopedManager(models.Manager):
    """Auto-scopes queries to the current organization from request context.

    Customer-facing views go through CurrentOrgMiddleware which sets the org.
    Staff endpoints, management commands, and Celery tasks should use
    Model.all_objects (an unscoped Manager) explicitly when cross-org access
    is intended.
    """

    def get_queryset(self):
        qs = super().get_queryset()
        org_id = current_org_id.get()
        if org_id is not None:
            return qs.filter(organization_id=org_id)
        return qs


class MultiTenantManager(models.Manager):
    """For models touched by multiple orgs (RFQ, Quote, Order, Invoice).

    Subclasses set `tenancy_fields` to the FK names that may match the
    current org (e.g. ("client_org", "supplier_org")). Returns rows where
    the active org appears in any of those fields.
    """

    tenancy_fields: tuple[str, ...] = ()

    def get_queryset(self):
        qs = super().get_queryset()
        org_id = current_org_id.get()
        if org_id is None or not self.tenancy_fields:
            return qs
        q = Q()
        for field in self.tenancy_fields:
            q |= Q(**{f"{field}_id": org_id})
        return qs.filter(q).distinct()

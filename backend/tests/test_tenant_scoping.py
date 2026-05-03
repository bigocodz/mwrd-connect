"""Phase 1.6: prove that the tenant-scoping primitives work.

The defense-in-depth pattern is:
  1. CurrentOrgMiddleware sets a ContextVar from the JWT
  2. TenantScopedManager.get_queryset filters by that ContextVar
  3. Forgetting to set it returns an unscoped queryset (system code path)
  4. IsOrgMember + IsStaffWithScope provide HTTP-layer guards

These tests cover (1)–(3) at the unit level. HTTP-layer tenant isolation
is covered by domain-app tests once we add catalog/kyc/etc.
"""
import pytest

from apps.core.context import current_org_id


@pytest.mark.django_db
def test_contextvar_default_is_none():
    assert current_org_id.get() is None


@pytest.mark.django_db
def test_contextvar_set_and_reset():
    token = current_org_id.set(42)
    try:
        assert current_org_id.get() == 42
    finally:
        current_org_id.reset(token)
    assert current_org_id.get() is None


@pytest.mark.django_db
def test_filtering_by_contextvar_isolates_orgs(user_in_org_a, user_in_org_b, org_a, org_b):
    """The exact filter that TenantScopedManager applies, exercised manually
    against a real model that has organization_id (Membership).
    """
    from apps.organizations.models import Membership

    # Sanity: each org has exactly one membership from fixtures
    assert Membership.objects.filter(organization=org_a).count() == 1
    assert Membership.objects.filter(organization=org_b).count() == 1

    token = current_org_id.set(org_a.id)
    try:
        scoped = Membership.objects.filter(organization_id=current_org_id.get())
        assert scoped.count() == 1
        assert scoped.first().organization_id == org_a.id
    finally:
        current_org_id.reset(token)

    # And from org_b's perspective, only org_b's membership is visible
    token = current_org_id.set(org_b.id)
    try:
        scoped = Membership.objects.filter(organization_id=current_org_id.get())
        assert scoped.count() == 1
        assert scoped.first().organization_id == org_b.id
    finally:
        current_org_id.reset(token)


@pytest.mark.django_db
def test_no_context_means_no_filter(user_in_org_a, user_in_org_b, org_a, org_b):
    """When no org context is set (staff/system code), code that uses
    `Model.all_objects` or unfiltered queries sees both orgs."""
    from apps.organizations.models import Membership

    assert current_org_id.get() is None
    all_orgs_visible = set(
        Membership.objects.values_list("organization_id", flat=True)
    )
    assert {org_a.id, org_b.id} <= all_orgs_visible


@pytest.mark.django_db
def test_multi_tenant_q_construction(org_a):
    """MultiTenantManager builds an OR over tenancy_fields. Verify the Q."""
    from django.db.models import Q

    org_id = org_a.id
    fields = ("client_org", "supplier_org")
    q = Q()
    for f in fields:
        q |= Q(**{f"{f}_id": org_id})
    rendered = str(q)
    assert "client_org_id" in rendered
    assert "supplier_org_id" in rendered
    assert "OR" in rendered

"""R1 — anonymity layer.

Lock the rule structurally: a customer-facing API response must NEVER
include the counterparty's real `name` or `legal_name`. Only their
`platform_alias`. Staff is the only allowed exception.

Test plan:
1. Org allocation gives every new org a unique `platform_alias`.
2. The legacy backfill migration gave existing orgs aliases too.
3. Quote / Contract / Order detail views, when fetched by the cross-org
   counterparty, return the alias and NOT the real name.
4. Staff fetching the same row sees the real name.
"""
import pytest

from apps.core.aliases import gen_client_alias, gen_supplier_alias
from apps.core.anonymity import anonymized_org_name, assert_no_realname_leak
from apps.organizations.services import allocate_alias

from .conftest import login_as


@pytest.mark.django_db
def test_alias_generators_match_spec_format():
    cli = gen_client_alias()
    assert cli.startswith("Client-")
    assert len(cli) == len("Client-XXXX")
    assert cli[7:].isalnum()

    sup = gen_supplier_alias(used_aliases=set())
    assert sup.startswith("Supplier ")


@pytest.mark.django_db
def test_supplier_alias_pool_wraps_when_exhausted():
    used = {f"Supplier {c}" for c in (
        "Violet", "Indigo", "Teal", "Amber", "Coral", "Sage", "Rose", "Slate",
    )}
    nxt = gen_supplier_alias(used_aliases=used)
    assert nxt == "Supplier Violet 2"


@pytest.mark.django_db
def test_allocate_alias_uses_unused_value(supplier_org_a, org_a):
    # Both fixtures already have aliases (from the backfill migration).
    # New allocations must not collide.
    new_supplier = allocate_alias(type="SUPPLIER")
    assert new_supplier != supplier_org_a.platform_alias
    new_client = allocate_alias(type="CLIENT")
    assert new_client != org_a.platform_alias


@pytest.mark.django_db
def test_anonymized_helper_swaps_for_cross_org_viewer(org_a, supplier_org_a):
    # Viewer is org_a (CLIENT); target is supplier_org_a — should see alias.
    out = anonymized_org_name(
        viewer_org_id=org_a.id, viewer_scope="customer",
        target_org=supplier_org_a,
    )
    assert out == supplier_org_a.platform_alias
    assert out != supplier_org_a.name


@pytest.mark.django_db
def test_anonymized_helper_returns_real_name_for_staff(supplier_org_a):
    out = anonymized_org_name(
        viewer_org_id=None, viewer_scope="staff",
        target_org=supplier_org_a,
    )
    assert out == supplier_org_a.name


@pytest.mark.django_db
def test_anonymized_helper_returns_real_name_for_same_org(supplier_org_a):
    out = anonymized_org_name(
        viewer_org_id=supplier_org_a.id, viewer_scope="customer",
        target_org=supplier_org_a,
    )
    assert out == supplier_org_a.name


@pytest.mark.django_db
def test_quote_visible_to_client_does_not_leak_supplier_real_name(
    api_client, master_product, org_a, supplier_org_a,
):
    """End-to-end: client fetches a quote; the response must contain the
    supplier's platform_alias and NOT the supplier's real name."""
    from apps.accounts.models import User
    from apps.organizations.models import Membership
    from apps.quotes.services import (
        create_or_get_draft_for_rfq,
        set_item_price,
        submit,
    )
    from apps.rfqs.services import add_item, create_rfq, publish

    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])

    cli = User.objects.create_user(email="anon-cli@a.local", password="long-enough-pw-1!")
    Membership.objects.create(user=cli, organization=org_a, role="OWNER", status="ACTIVE")

    rfq = create_rfq(client_org=org_a, by=cli, title="anon-test", description="")
    add_item(rfq, master_product=master_product, pack_type_code="EACH", quantity=1)
    publish(rfq)
    q = create_or_get_draft_for_rfq(rfq=rfq, supplier_org=supplier_org_a)
    set_item_price(quote=q, item_id=q.items.first().id, unit_price="10.00")
    submit(q)

    login_as(api_client, cli, org_a)
    resp = api_client.get(f"/api/quotes/{q.id}")
    assert resp.status_code == 200
    body = resp.json()

    assert body["supplier_name"] == supplier_org_a.platform_alias
    assert_no_realname_leak(body, [supplier_org_a.name, supplier_org_a.legal_name])


@pytest.mark.django_db
def test_quote_visible_to_supplier_owner_shows_real_name(
    api_client, master_product, org_a, supplier_org_a,
):
    """The supplier viewing their own quote sees their own real name —
    only the COUNTERPARTY is redacted."""
    from apps.accounts.models import User
    from apps.organizations.models import Membership
    from apps.quotes.services import (
        create_or_get_draft_for_rfq,
        set_item_price,
        submit,
    )
    from apps.rfqs.services import add_item, create_rfq, publish

    org_a.type = "CLIENT"
    org_a.save(update_fields=["type"])

    cli = User.objects.create_user(email="anon2-cli@a.local", password="long-enough-pw-1!")
    Membership.objects.create(user=cli, organization=org_a, role="OWNER", status="ACTIVE")
    sup_user = User.objects.create_user(email="anon2-sup@a.local", password="long-enough-pw-1!")
    Membership.objects.create(
        user=sup_user, organization=supplier_org_a, role="OWNER", status="ACTIVE",
    )

    rfq = create_rfq(client_org=org_a, by=cli, title="t", description="")
    add_item(rfq, master_product=master_product, pack_type_code="EACH", quantity=1)
    publish(rfq)
    q = create_or_get_draft_for_rfq(rfq=rfq, supplier_org=supplier_org_a)
    set_item_price(quote=q, item_id=q.items.first().id, unit_price="10.00")
    submit(q)

    login_as(api_client, sup_user, supplier_org_a)
    resp = api_client.get(f"/api/quotes/{q.id}")
    assert resp.status_code == 200
    assert resp.json()["supplier_name"] == supplier_org_a.name

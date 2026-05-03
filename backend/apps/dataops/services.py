"""Per-org data export + hard-delete (purge) workflows.

Export = a JSON zip of all the data we hold about a tenant. Used both for
tenant self-service ("send me my data") and for auditor requests.

Purge = anonymizes/deletes everything tied to an org. Cross-org transactional
data (RFQs, contracts, orders, invoices) is kept for the counterparty's
records but the org's own identifiers are scrubbed.
"""
from __future__ import annotations

import io
import json
import zipfile
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_event


def _serialize_qs(qs, fields: list[str]) -> list[dict[str, Any]]:
    out = []
    for obj in qs:
        row = {}
        for f in fields:
            v = getattr(obj, f, None)
            if hasattr(v, "isoformat"):
                v = v.isoformat()
            elif not isinstance(v, (str, int, float, bool, type(None), list, dict)):
                v = str(v)
            row[f] = v
        out.append(row)
    return out


def export_org(organization) -> bytes:
    """Build a zip with one JSON per domain. Returns bytes."""
    from apps.catalog.models import ProductAdditionRequest, SupplierProduct
    from apps.contracts.models import Contract
    from apps.fulfillment.models import DeliveryNote, GoodsReceiptNote
    from apps.invoicing.models import ClientInvoice, SupplierInvoice
    from apps.kyc.models import KycSubmission
    from apps.orders.models import Order
    from apps.organizations.models import Invite, Membership
    from apps.payments.models import Payment, Payout
    from apps.quotes.models import Quote
    from apps.rfqs.models import Rfq

    parts: dict[str, Any] = {
        "organization": _serialize_qs([organization], [
            "id", "type", "status", "name", "legal_name", "legal_name_ar",
            "public_id", "cr_number", "vat_number", "contact_email", "contact_phone",
            "activated_at", "suspended_at", "created_at", "updated_at",
        ])[0],
        "memberships": _serialize_qs(
            Membership.objects.filter(organization=organization).select_related("user"),
            ["id", "user_id", "role", "status", "created_at", "updated_at"],
        ),
        "invites": _serialize_qs(
            Invite.objects.filter(organization=organization),
            ["id", "email", "role", "kind", "status", "expires_at", "accepted_at", "created_at"],
        ),
        "kyc_submissions": _serialize_qs(
            KycSubmission.objects.filter(organization=organization),
            ["id", "status", "legal_name", "legal_name_ar", "cr_number", "vat_number",
             "submitted_at", "reviewed_at", "review_notes", "created_at"],
        ),
        "supplier_products": _serialize_qs(
            SupplierProduct.objects.filter(organization=organization),
            ["id", "master_product_id", "pack_type_code", "sku", "cost_price",
             "moq", "lead_time_days", "approval_status", "created_at"],
        ),
        "addition_requests": _serialize_qs(
            ProductAdditionRequest.objects.filter(organization=organization),
            ["id", "proposed_name_en", "status", "created_at"],
        ),
        "rfqs": _serialize_qs(
            Rfq.objects.filter(client_org=organization),
            ["id", "title", "status", "delivery_location", "created_at"],
        ),
        "quotes": _serialize_qs(
            Quote.objects.filter(supplier_org=organization),
            ["id", "rfq_id", "status", "total", "submitted_at", "created_at"],
        ),
        "contracts": _serialize_qs(
            Contract.objects.filter(client_org=organization)
            | Contract.objects.filter(supplier_org=organization),
            ["id", "rfq_id", "client_org_id", "supplier_org_id", "status", "total", "created_at"],
        ),
        "orders": _serialize_qs(
            Order.objects.filter(client_org=organization)
            | Order.objects.filter(supplier_org=organization),
            ["id", "contract_id", "status", "total", "created_at"],
        ),
        "delivery_notes": _serialize_qs(
            DeliveryNote.objects.filter(client_org=organization)
            | DeliveryNote.objects.filter(supplier_org=organization),
            ["id", "order_id", "status", "dispatched_at", "delivered_at", "created_at"],
        ),
        "grns": _serialize_qs(
            GoodsReceiptNote.objects.filter(client_org=organization),
            ["id", "delivery_note_id", "status", "received_at", "created_at"],
        ),
        "supplier_invoices": _serialize_qs(
            SupplierInvoice.objects.filter(supplier_org=organization),
            ["id", "order_id", "number", "status", "subtotal", "total",
             "issued_at", "paid_at", "created_at"],
        ),
        "client_invoices": _serialize_qs(
            ClientInvoice.objects.filter(client_org=organization),
            ["id", "order_id", "number", "status", "subtotal", "margin_amount",
             "total", "issued_at", "paid_at", "created_at"],
        ),
        "payments": _serialize_qs(
            Payment.objects.filter(client_org=organization),
            ["id", "invoice_id", "amount", "method", "reference", "paid_at"],
        ),
        "payouts": _serialize_qs(
            Payout.objects.filter(supplier_org=organization),
            ["id", "invoice_id", "amount", "method", "reference", "paid_at"],
        ),
        "exported_at": timezone.now().isoformat(),
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, data in parts.items():
            zf.writestr(f"{name}.json", json.dumps(data, indent=2, default=str))
    return buf.getvalue()


@transaction.atomic
def purge_org(organization, *, by, reason: str) -> dict[str, int]:
    """Anonymize the org and remove org-private data.

    Cross-org transactional records (RFQs, quotes, contracts, orders,
    invoices, payments) are kept — the counterparty has a legitimate need
    for them. The org's name/email/CR/VAT/legal names are replaced with a
    redaction marker. Memberships are removed; team users are NOT deleted
    (they may belong to other orgs).
    """
    if not reason:
        raise ValueError("Purge requires a written reason")

    from apps.catalog.models import SupplierProduct
    from apps.kyc.models import KycDocument, KycSubmission
    from apps.organizations.models import Invite, Membership, Organization

    counts = {}

    # Org-private content first
    counts["kyc_documents"] = KycDocument.objects.filter(
        submission__organization=organization,
    ).delete()[0]
    counts["kyc_submissions"] = KycSubmission.objects.filter(
        organization=organization,
    ).delete()[0]
    counts["supplier_products"] = SupplierProduct.objects.filter(
        organization=organization,
    ).delete()[0]
    counts["invites"] = Invite.objects.filter(organization=organization).delete()[0]
    counts["memberships"] = Membership.objects.filter(organization=organization).delete()[0]

    # Anonymize the Organization row (we don't delete it — FKs from
    # cross-org transactions still need it).
    organization.status = Organization.Status.ARCHIVED
    organization.name = f"[redacted org #{organization.id}]"
    organization.legal_name = ""
    organization.legal_name_ar = ""
    organization.cr_number = ""
    organization.vat_number = ""
    organization.contact_email = f"redacted-{organization.id}@invalid.local"
    organization.contact_phone = ""
    organization.suspension_reason = f"PURGED: {reason}"
    organization.suspended_at = timezone.now()
    organization.save()

    record_event(
        action="org.purged", target=organization, actor=by,
        organization=organization,
        payload={"reason": reason, "counts": counts},
    )
    return counts

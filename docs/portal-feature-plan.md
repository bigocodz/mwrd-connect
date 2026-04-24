# MWRD Portal Feature Plan

This plan keeps the public landing page out of scope. The work targets the authenticated client, supplier, and admin portals.

## Product Position

MWRD should stay focused on competitive RFQ-led procurement, verified suppliers, and managed commercial control. Lawazem is stronger as a direct-buy marketplace, so MWRD should close operational gaps while preserving its differentiated quote workflow.

## Phase 1: UI System Migration

- Install and configure Untitled UI React dependencies for the Vite app.
- Move authenticated app surfaces to Untitled-style layout, navigation, buttons, metrics, tables, forms, dialogs, and empty states.
- Keep shadcn components available only during migration.
- Do not edit `/public/landing`, `/public/landing-assets`, or landing-only files.

## Phase 2: RFQ Depth

- Add RFQ attachments for specs, quotations, purchase policies, and supporting documents.
- Add side-by-side quote comparison for clients.
- Add admin-side quote comparison and supplier scoring.
- Add quote revision/negotiation flow before final client approval.
- Add structured RFQ templates by category.

## Phase 3: Order Lifecycle

- Convert accepted quotes into orders or purchase orders.
- Add order status: pending PO, confirmed, preparing, dispatched, delivered, completed, cancelled.
- Add delivery tracking, proof of delivery, return/dispute status, and client confirmation.
- Add supplier fulfillment view with delivery updates.

## Phase 4: Client Controls

- Add cost centers, branches, departments, and requester users.
- Add delegated buying with role-based buyer permissions.
- Add approval workflows by amount, category, branch, and cost center.
- Add scheduled or repeat RFQs/orders.
- Add custom/private catalog per client.

## Phase 5: Commercial Controls

- Add contract pricing and contracted supplier terms.
- Add flexible invoice cycles and VAT document generation.
- Add credit/BNPL rules beyond the current credit limit and balance fields.
- Add payment reminders, statements, and reconciliation workflow.

## Phase 6: Supplier Operations

- Add supplier onboarding document center and KYC evidence.
- Add bulk product upload and catalog import.
- Add inventory quantities, stock alerts, service areas, and delivery capacity.
- Add supplier analytics: response time, win rate, quote conversion, ratings, payout aging.
- Add supplier invoice submission tied to completed orders.

## Phase 7: Admin Intelligence

- Add dashboards for RFQ cycle time, quote coverage, savings, supplier response rate, delivery SLA, margin, and credit risk.
- Add exports for finance and procurement teams.
- Add supplier performance scoring and preferred supplier management.
- Add dispute management and audit-ready lifecycle timeline.

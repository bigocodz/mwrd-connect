import { useEffect, useState } from "react";
import { ApiError, api } from "@mwrd/auth";

interface SummaryResponse {
  role: string;
  counts: Record<string, number>;
}

interface Props {
  /** Defaults to /api/dashboard/summary; pass /api/staff/dashboard/summary in admin. */
  endpoint?: string;
}

const LABELS: Record<string, string> = {
  open_rfqs: "Open RFQs",
  contracts_to_sign: "Contracts to sign",
  orders_in_flight: "Orders in flight",
  invoices_to_pay: "Invoices to pay",
  rfqs_in_inbox: "RFQs in inbox",
  draft_quotes: "Draft quotes",
  orders_to_ship: "Orders to ship",
  invoices_unpaid: "Unpaid invoices",
  kyc_pending_review: "KYC awaiting review",
  supplier_listings_pending: "Supplier listings pending",
  addition_requests_pending: "Product requests pending",
  active_orgs: "Active orgs",
  open_orders: "Open orders",
  issued_client_invoices: "Issued client invoices",
  issued_supplier_invoices: "Issued supplier invoices",
};

export function DashboardSummary({ endpoint = "/api/dashboard/summary" }: Props) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SummaryResponse>(endpoint)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.detail : String(e)));
  }, [endpoint]);

  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (!data) return null;

  const entries = Object.entries(data.counts);
  return (
    <section
      style={{
        display: "grid",
        gap: "0.5rem",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
      }}
    >
      {entries.map(([key, value]) => (
        <div
          key={key}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "0.75rem",
            background: "#fafafa",
          }}
        >
          <div style={{ fontSize: 12, color: "#666" }}>{LABELS[key] ?? key}</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{value}</div>
        </div>
      ))}
    </section>
  );
}

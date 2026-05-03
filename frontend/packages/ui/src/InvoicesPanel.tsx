import { useEffect, useState } from "react";
import { ApiError, api, useAuth } from "@mwrd/auth";
import type {
  ClientInvoiceT,
  OrderT,
  PaymentT,
  PayoutT,
  SupplierInvoiceT,
} from "./portal-types";

export function InvoicesPanel() {
  const { me } = useAuth();
  if (!me?.organization) return null;
  const isSupplier = me.organization.type === "SUPPLIER";
  return isSupplier ? <SupplierInvoices /> : <ClientInvoices />;
}

function SupplierInvoices() {
  const [items, setItems] = useState<SupplierInvoiceT[]>([]);
  const [orders, setOrders] = useState<OrderT[]>([]);
  const [payouts, setPayouts] = useState<PayoutT[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [list, ords, pos] = await Promise.all([
        api<SupplierInvoiceT[]>("/api/supplier-invoices"),
        api<OrderT[]>("/api/orders/"),
        api<PayoutT[]>("/api/payouts"),
      ]);
      setItems(list);
      setOrders(ords);
      setPayouts(pos);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  // Orders that don't yet have an active invoice → candidates to invoice.
  const invoicedOrderIds = new Set(items.map((i) => i.order));
  const invoiceCandidates = orders.filter(
    (o) =>
      !invoicedOrderIds.has(o.id) &&
      (o.status === "IN_FULFILLMENT" || o.status === "CONFIRMED" || o.status === "COMPLETED"),
  );

  async function createInvoice(orderId: number) {
    try {
      await api(`/api/orders/${orderId}/supplier-invoice`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  async function issueInvoice(id: number) {
    try {
      await api(`/api/supplier-invoices/${id}/issue`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Supplier invoices</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {invoiceCandidates.length > 0 && (
        <div style={{ marginBottom: "0.5rem" }}>
          <strong>Ready to invoice:</strong>
          <ul style={{ fontSize: 14 }}>
            {invoiceCandidates.map((o) => (
              <li key={o.id}>
                Order #{o.id} ({o.total} SAR){" "}
                <button onClick={() => void createInvoice(o.id)}>Create invoice</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {items.length === 0 && <p style={{ color: "#666" }}>No invoices yet.</p>}
      {items.map((si) => (
        <div key={si.id} style={{ border: "1px solid #eee", padding: "0.5rem", borderRadius: 6, marginBottom: "0.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{si.number} — order {si.order}</strong>
            <span style={{ color: "#666" }}>{si.status}</span>
          </div>
          <p style={{ margin: "0.25rem 0", fontSize: 13 }}>Total: <strong>{si.total} SAR</strong></p>
          {si.status === "DRAFT" && (
            <button onClick={() => void issueInvoice(si.id)}>Issue</button>
          )}
        </div>
      ))}
      <h3 style={{ margin: "1rem 0 0.25rem" }}>Payouts received</h3>
      {payouts.length === 0 && <p style={{ color: "#666" }}>None yet.</p>}
      <ul>
        {payouts.map((p) => (
          <li key={p.id} style={{ fontSize: 14 }}>
            Invoice {p.invoice}: {p.amount} SAR via {p.method} on {p.paid_at?.slice(0, 10)} ({p.reference || "—"})
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClientInvoices() {
  const [items, setItems] = useState<ClientInvoiceT[]>([]);
  const [payments, setPayments] = useState<PaymentT[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    try {
      const [invs, pays] = await Promise.all([
        api<ClientInvoiceT[]>("/api/client-invoices"),
        api<PaymentT[]>("/api/payments"),
      ]);
      setItems(invs);
      setPayments(pays);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function pay(invoice: ClientInvoiceT) {
    const ref = window.prompt("Bank reference (optional)") ?? "";
    setBusyId(invoice.id);
    try {
      await api("/api/payments/record", {
        method: "POST",
        body: {
          invoice_id: invoice.id,
          amount: invoice.total,
          method: "BANK_TRANSFER",
          reference: ref,
        },
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Invoices to pay</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {items.length === 0 && <p style={{ color: "#666" }}>No invoices yet.</p>}
      {items.map((ci) => (
        <div key={ci.id} style={{ border: "1px solid #eee", padding: "0.5rem", borderRadius: 6, marginBottom: "0.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{ci.number} — order {ci.order}</strong>
            <span style={{ color: "#666" }}>{ci.status}</span>
          </div>
          <p style={{ margin: "0.25rem 0", fontSize: 13 }}>
            Subtotal {ci.subtotal} + margin {ci.margin_amount} = <strong>{ci.total} SAR</strong>
          </p>
          {ci.status === "ISSUED" && (
            <button onClick={() => void pay(ci)} disabled={busyId === ci.id}>
              Mark paid
            </button>
          )}
        </div>
      ))}
      <h3 style={{ margin: "1rem 0 0.25rem" }}>Payments made</h3>
      {payments.length === 0 && <p style={{ color: "#666" }}>None yet.</p>}
      <ul>
        {payments.map((p) => (
          <li key={p.id} style={{ fontSize: 14 }}>
            Invoice {p.invoice}: {p.amount} SAR via {p.method} on {p.paid_at?.slice(0, 10)} ({p.reference || "—"})
          </li>
        ))}
      </ul>
    </section>
  );
}

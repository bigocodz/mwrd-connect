import { useEffect, useState } from "react";
import { ApiError, api } from "@mwrd/auth";
import type { Quote, Rfq } from "./portal-types";

export function SupplierRfqInbox() {
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [openRfqId, setOpenRfqId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setRfqs(await api<Rfq[]>("/api/rfqs/inbox"));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>RFQ inbox</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {rfqs.length === 0 && (
        <p style={{ color: "#666" }}>No RFQs to quote on right now.</p>
      )}
      {rfqs.map((r) => (
        <div
          key={r.id}
          style={{
            border: "1px solid #eee", padding: "0.5rem", borderRadius: 6,
            marginBottom: "0.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>RFQ #{r.id} — {r.title}</strong>
            <span style={{ color: "#666" }}>{r.status}</span>
          </div>
          <p style={{ margin: "0.25rem 0", fontSize: 13, color: "#666" }}>
            {r.items.length} line(s) · delivery: {r.delivery_location || "—"}
          </p>
          <button onClick={() => setOpenRfqId(openRfqId === r.id ? null : r.id)}>
            {openRfqId === r.id ? "Hide" : "Quote"}
          </button>
          {openRfqId === r.id && <QuoteEditor rfq={r} onChanged={load} />}
        </div>
      ))}
    </section>
  );
}

function QuoteEditor({ rfq, onChanged }: { rfq: Rfq; onChanged: () => void }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    try {
      const q = await api<Quote>(`/api/rfqs/${rfq.id}/quotes`, { method: "POST" });
      setQuote(q);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  useEffect(() => {
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setPrice(itemId: number, unitPrice: string, leadTime: string) {
    if (!quote) return;
    try {
      await api(`/api/quotes/${quote.id}/items/${itemId}`, {
        method: "PATCH",
        body: {
          unit_price: unitPrice || "0",
          lead_time_days: leadTime ? Number(leadTime) : null,
        },
      });
      const refreshed = await api<Quote>(`/api/quotes/${quote.id}`);
      setQuote(refreshed);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  async function submit() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const q = await api<Quote>(`/api/quotes/${quote.id}/submit`, { method: "POST" });
      setQuote(q);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!quote) return <p>Loading…</p>;

  const editable = quote.status === "DRAFT";

  return (
    <div style={{ marginTop: "0.5rem", borderTop: "1px solid #eee", paddingTop: "0.5rem" }}>
      <p style={{ margin: 0 }}>
        Quote #{quote.id} — status <strong>{quote.status}</strong> — total{" "}
        <strong>{quote.total}</strong> SAR
      </p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: "0.25rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
            <th>Line</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Lead</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((qi) => (
            <QuoteItemRow
              key={qi.id}
              item={qi}
              editable={editable}
              onSave={(price, lead) => setPrice(qi.id, price, lead)}
            />
          ))}
        </tbody>
      </table>
      {editable && (
        <p>
          <button onClick={() => void submit()} disabled={busy}>
            Submit quote
          </button>
        </p>
      )}
    </div>
  );
}

function QuoteItemRow({
  item, editable, onSave,
}: {
  item: import("./portal-types").QuoteItem;
  editable: boolean;
  onSave: (price: string, leadTime: string) => void;
}) {
  const [price, setPrice] = useState(item.unit_price);
  const [lead, setLead] = useState(item.lead_time_days?.toString() ?? "");
  return (
    <tr style={{ borderBottom: "1px solid #f5f5f5" }}>
      <td>{item.rfq_item_line_no}</td>
      <td>{item.master_product_name}</td>
      <td>{item.quantity} × {item.pack_type_code}</td>
      <td>
        {editable ? (
          <input
            type="number" step="0.01" min="0" style={{ width: 90 }}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => onSave(price, lead)}
          />
        ) : (
          item.unit_price
        )}
      </td>
      <td>
        {editable ? (
          <input
            type="number" min="0" style={{ width: 60 }}
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            onBlur={() => onSave(price, lead)}
          />
        ) : (
          item.lead_time_days ?? "—"
        )}
      </td>
      <td>{item.total_price}</td>
    </tr>
  );
}

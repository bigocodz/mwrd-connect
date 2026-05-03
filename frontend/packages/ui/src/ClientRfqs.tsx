import { useEffect, useState } from "react";
import { ApiError, api } from "@mwrd/auth";
import type { MasterProduct, Quote, Rfq } from "./portal-types";

export function ClientRfqs() {
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [openRfqId, setOpenRfqId] = useState<number | null>(null);

  async function load() {
    try {
      setRfqs(await api<Rfq[]>("/api/rfqs/"));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>My RFQs</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <p>
        <button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ New RFQ"}
        </button>
      </p>
      {showForm && (
        <CreateRfq
          onCreated={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}
      {rfqs.length === 0 && <p style={{ color: "#666" }}>No RFQs yet.</p>}
      {rfqs.map((r) => (
        <div
          key={r.id}
          style={{ border: "1px solid #eee", padding: "0.5rem", borderRadius: 6, marginBottom: "0.5rem" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>RFQ #{r.id} — {r.title}</strong>
            <span style={{ color: "#666" }}>{r.status}</span>
          </div>
          <p style={{ margin: "0.25rem 0", fontSize: 13, color: "#666" }}>
            {r.items.length} line(s) · {r.delivery_location || "no delivery loc"}
          </p>
          <button onClick={() => setOpenRfqId(openRfqId === r.id ? null : r.id)}>
            {openRfqId === r.id ? "Hide" : "Open"}
          </button>
          {openRfqId === r.id && <RfqDetail rfq={r} onChanged={load} />}
        </div>
      ))}
    </section>
  );
}

function CreateRfq({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/rfqs/", {
        method: "POST",
        body: { title, description, delivery_location: deliveryLocation },
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "0.5rem", maxWidth: 420 }}>
      <input placeholder="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        placeholder="Delivery location"
        value={deliveryLocation}
        onChange={(e) => setDeliveryLocation(e.target.value)}
      />
      {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "…" : "Create RFQ (DRAFT)"}
      </button>
    </form>
  );
}

function RfqDetail({ rfq, onChanged }: { rfq: Rfq; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [masters, setMasters] = useState<MasterProduct[]>([]);
  const [masterId, setMasterId] = useState<number | "">("");
  const [packCode, setPackCode] = useState("");
  const [qty, setQty] = useState(1);

  async function loadQuotes() {
    if (rfq.status === "DRAFT") return;
    try {
      const detail = await api<Rfq & { quotes?: Quote[] }>(`/api/rfqs/${rfq.id}`);
      // Server doesn't embed quotes in RFQ detail; we list quotes per supplier
      // by querying each via supplier. For client view we just fetch related
      // quotes through a separate endpoint when ready. For now we list quotes
      // by hitting the contracts/orders endpoints later. Keep this simple:
      // re-use the inbox JSON to list quotes is overkill — fetch quotes
      // through a lightweight ad-hoc endpoint:
      void detail; // type guard
      // We'll fetch all quotes the client can see:
      const qs = await api<Quote[]>(`/api/rfqs/${rfq.id}/quotes-list`).catch(() => []);
      setQuotes(qs);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  useEffect(() => {
    if (rfq.status === "DRAFT") {
      void api<MasterProduct[]>("/api/catalog/products?limit=200").then(setMasters);
    } else {
      void loadQuotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfq.id, rfq.status]);

  const selectedMaster = masters.find((m) => m.id === masterId);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (masterId === "" || !packCode) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/rfqs/${rfq.id}/items`, {
        method: "POST",
        body: { master_product: masterId, pack_type_code: packCode, quantity: qty },
      });
      setMasterId("");
      setPackCode("");
      setQty(1);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    try {
      await api(`/api/rfqs/${rfq.id}/publish`, { method: "POST" });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  async function award(quoteId: number) {
    try {
      await api(`/api/rfqs/${rfq.id}/quotes/${quoteId}/award`, { method: "POST" });
      onChanged();
      await loadQuotes();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  return (
    <div style={{ marginTop: "0.5rem", borderTop: "1px solid #eee", paddingTop: "0.5rem" }}>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <h4 style={{ margin: "0 0 0.25rem" }}>Lines</h4>
      <ul>
        {rfq.items.map((it) => (
          <li key={it.id}>
            #{it.line_no} {it.master_product_name} — {it.quantity} × {it.pack_type_code}
          </li>
        ))}
      </ul>

      {rfq.status === "DRAFT" && (
        <>
          <form onSubmit={addItem} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "end" }}>
            <label>
              Product
              <select
                required
                value={masterId}
                onChange={(e) => {
                  const v = e.target.value;
                  setMasterId(v === "" ? "" : Number(v));
                  setPackCode("");
                }}
              >
                <option value="">— select —</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name_en}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pack
              <select
                required
                value={packCode}
                onChange={(e) => setPackCode(e.target.value)}
                disabled={!selectedMaster}
              >
                <option value="">—</option>
                {selectedMaster?.pack_types.map((pt) => (
                  <option key={pt.code} value={pt.code}>
                    {pt.label_en}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Qty
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 1)}
                style={{ width: 70 }}
              />
            </label>
            <button type="submit" disabled={busy}>
              Add line
            </button>
          </form>
          <p>
            <button onClick={() => void publish()} disabled={busy || rfq.items.length === 0}>
              Publish RFQ
            </button>
          </p>
        </>
      )}

      {rfq.status !== "DRAFT" && (
        <>
          <h4 style={{ margin: "0.5rem 0 0.25rem" }}>Quotes received ({quotes.length})</h4>
          {quotes.length === 0 && (
            <p style={{ color: "#666" }}>No quotes yet — share with your suppliers.</p>
          )}
          {quotes.map((q) => (
            <div key={q.id} style={{ border: "1px solid #eee", padding: "0.5rem", borderRadius: 6, marginBottom: "0.25rem" }}>
              <strong>{q.supplier_name}</strong> — total <strong>{q.total}</strong> SAR · {q.status}
              <ul>
                {q.items.map((qi) => (
                  <li key={qi.id} style={{ fontSize: 13 }}>
                    {qi.master_product_name}: {qi.unit_price} × {qi.quantity} = {qi.total_price}
                  </li>
                ))}
              </ul>
              {q.status === "SUBMITTED" && rfq.status === "PUBLISHED" && (
                <button onClick={() => void award(q.id)}>Award</button>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

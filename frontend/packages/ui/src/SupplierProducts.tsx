import { useEffect, useState } from "react";
import { ApiError, api } from "@mwrd/auth";
import type { MasterProduct, SupplierProduct } from "./portal-types";

export function SupplierProducts() {
  const [items, setItems] = useState<SupplierProduct[]>([]);
  const [masters, setMasters] = useState<MasterProduct[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form fields
  const [masterProductId, setMasterProductId] = useState<number | "">("");
  const [packTypeCode, setPackTypeCode] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [moq, setMoq] = useState(1);
  const [leadTime, setLeadTime] = useState(0);

  async function load() {
    try {
      const [list, mp] = await Promise.all([
        api<SupplierProduct[]>("/api/catalog/supplier/products"),
        api<MasterProduct[]>("/api/catalog/products?limit=200"),
      ]);
      setItems(list);
      setMasters(mp);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedMaster = masters.find((m) => m.id === masterProductId);
  const packOptions = selectedMaster?.pack_types ?? [];

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (masterProductId === "") return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/catalog/supplier/products", {
        method: "POST",
        body: {
          master_product: masterProductId,
          pack_type_code: packTypeCode,
          cost_price: costPrice,
          moq,
          lead_time_days: leadTime,
        },
      });
      setShowForm(false);
      setMasterProductId("");
      setPackTypeCode("");
      setCostPrice("");
      setMoq(1);
      setLeadTime(0);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit(id: number) {
    try {
      await api(`/api/catalog/supplier/products/${id}/submit`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this listing?")) return;
    try {
      await api(`/api/catalog/supplier/products/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>My products</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {items.length === 0 && <p style={{ color: "#666" }}>No listings yet.</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
            <th>Master product</th>
            <th>Pack</th>
            <th>Price</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((sp) => (
            <tr key={sp.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
              <td>{sp.master_name_en}</td>
              <td>{sp.pack_type_code}</td>
              <td>{sp.cost_price}</td>
              <td>
                {sp.approval_status}
                {sp.rejection_reason && (
                  <div style={{ color: "crimson", fontSize: 12 }}>
                    {sp.rejection_reason}
                  </div>
                )}
              </td>
              <td style={{ display: "flex", gap: "0.25rem", padding: "0.25rem 0" }}>
                {(sp.approval_status === "DRAFT" ||
                  sp.approval_status === "REJECTED") && (
                  <button onClick={() => void submit(sp.id)}>Submit</button>
                )}
                {(sp.approval_status === "DRAFT" ||
                  sp.approval_status === "REJECTED") && (
                  <button onClick={() => void remove(sp.id)}>Delete</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        <button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "Add listing"}
        </button>
      </p>

      {showForm && (
        <form onSubmit={create} style={{ display: "grid", gap: "0.5rem", maxWidth: 400 }}>
          <label>
            Master product
            <select
              required
              value={masterProductId}
              onChange={(e) => {
                const v = e.target.value;
                setMasterProductId(v === "" ? "" : Number(v));
                setPackTypeCode("");
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
            Pack type
            <select
              required
              value={packTypeCode}
              onChange={(e) => setPackTypeCode(e.target.value)}
              disabled={!selectedMaster}
            >
              <option value="">— select —</option>
              {packOptions.map((pt) => (
                <option key={pt.code} value={pt.code}>
                  {pt.label_en} ({pt.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Cost price (SAR)
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
            />
          </label>
          <label>
            MOQ
            <input
              type="number"
              min="1"
              value={moq}
              onChange={(e) => setMoq(Number(e.target.value) || 1)}
            />
          </label>
          <label>
            Lead time (days)
            <input
              type="number"
              min="0"
              value={leadTime}
              onChange={(e) => setLeadTime(Number(e.target.value) || 0)}
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "…" : "Create"}
          </button>
        </form>
      )}
    </section>
  );
}

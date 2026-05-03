import { useEffect, useState } from "react";
import { ApiError, api, useAuth } from "@mwrd/auth";
import { CommentsThread } from "./CommentsThread";
import type { OrderT } from "./portal-types";

export function OrdersPanel() {
  const { me } = useAuth();
  const [items, setItems] = useState<OrderT[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await api<OrderT[]>("/api/orders/"));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function confirm(id: number) {
    try {
      await api(`/api/orders/${id}/confirm`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  if (!me?.organization) return null;
  const isSupplier = me.organization.type === "SUPPLIER";

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Orders</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {items.length === 0 && <p style={{ color: "#666" }}>No orders yet.</p>}
      {items.map((o) => (
        <div
          key={o.id}
          style={{
            border: "1px solid #eee", padding: "0.5rem", borderRadius: 6,
            marginBottom: "0.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>Order #{o.id}</strong>
            <span style={{ color: "#666" }}>{o.status}</span>
          </div>
          <p style={{ margin: "0.25rem 0", fontSize: 13, color: "#666" }}>
            {o.client_org_name} ↔ {o.supplier_org_name} · total {o.total} SAR
          </p>
          <ul style={{ fontSize: 13, margin: "0.25rem 0" }}>
            {o.items.map((it) => (
              <li key={it.id}>
                {it.master_product_name} — {it.quantity} × {it.pack_type_code} @ {it.unit_price}
              </li>
            ))}
          </ul>
          {isSupplier && o.status === "DRAFT" && (
            <button onClick={() => void confirm(o.id)}>Confirm order</button>
          )}
          <CommentsThread on={`order:${o.id}`} />
        </div>
      ))}
    </section>
  );
}

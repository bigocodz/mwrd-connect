import { useEffect, useState } from "react";
import { ApiError, api, useAuth } from "@mwrd/auth";
import type { Contract } from "./portal-types";

export function ContractsPanel() {
  const { me } = useAuth();
  const [items, setItems] = useState<Contract[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await api<Contract[]>("/api/contracts/"));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function sign(id: number, side: "client" | "supplier") {
    try {
      await api(`/api/contracts/${id}/sign-${side}`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  if (!me?.organization) return null;
  const orgType = me.organization.type;

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Contracts</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {items.length === 0 && <p style={{ color: "#666" }}>No contracts yet.</p>}
      {items.map((c) => {
        const mySigned =
          orgType === "CLIENT" ? c.client_signed_at : c.supplier_signed_at;
        const otherSigned =
          orgType === "CLIENT" ? c.supplier_signed_at : c.client_signed_at;
        return (
          <div
            key={c.id}
            style={{
              border: "1px solid #eee", padding: "0.5rem", borderRadius: 6,
              marginBottom: "0.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>Contract #{c.id}</strong>
              <span style={{ color: "#666" }}>{c.status}</span>
            </div>
            <p style={{ margin: "0.25rem 0", fontSize: 13, color: "#666" }}>
              {c.client_org_name} ↔ {c.supplier_org_name} · total {c.total} SAR
            </p>
            <p style={{ margin: "0.25rem 0", fontSize: 13 }}>
              You: {mySigned ? "✓ signed" : "— pending"} ·{" "}
              other party: {otherSigned ? "✓ signed" : "— pending"}
            </p>
            <ul style={{ fontSize: 13, margin: "0.25rem 0" }}>
              {c.items.map((it) => (
                <li key={it.id}>
                  {it.master_product_name} — {it.quantity} × {it.pack_type_code} @ {it.unit_price}
                </li>
              ))}
            </ul>
            {c.status === "PENDING_SIGNATURES" && !mySigned && (
              <button onClick={() => void sign(c.id, orgType === "CLIENT" ? "client" : "supplier")}>
                Sign as {orgType === "CLIENT" ? "client" : "supplier"}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

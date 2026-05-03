import { useEffect, useState } from "react";
import { ApiError, api, useAuth } from "@mwrd/auth";
import type { DeliveryNote, Grn, OrderT } from "./portal-types";

export function DeliveriesPanel() {
  const { me } = useAuth();
  const [items, setItems] = useState<DeliveryNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  if (!me?.organization) return null;
  const isSupplier = me.organization.type === "SUPPLIER";

  async function load() {
    try {
      const path = isSupplier
        ? "/api/deliveries/outgoing"
        : "/api/deliveries/incoming";
      setItems(await api<DeliveryNote[]>(path));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupplier]);

  async function dispatchDn(id: number) {
    try {
      await api(`/api/deliveries/${id}/dispatch`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>{isSupplier ? "Deliveries (outbound)" : "Incoming deliveries"}</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {isSupplier && (
        <p>
          <button onClick={() => setShowCreate((s) => !s)}>
            {showCreate ? "Cancel" : "+ New delivery note"}
          </button>
        </p>
      )}
      {showCreate && isSupplier && <CreateDnForm onCreated={() => { setShowCreate(false); void load(); }} />}
      {items.length === 0 && (
        <p style={{ color: "#666" }}>No delivery notes yet.</p>
      )}
      {items.map((dn) => (
        <DnRow key={dn.id} dn={dn} isSupplier={isSupplier} onChanged={load} onDispatch={dispatchDn} />
      ))}
    </section>
  );
}

function DnRow({
  dn, isSupplier, onChanged, onDispatch,
}: {
  dn: DeliveryNote;
  isSupplier: boolean;
  onChanged: () => void;
  onDispatch: (id: number) => void;
}) {
  const [grn, setGrn] = useState<Grn | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openGrn() {
    try {
      const g = await api<Grn>(`/api/deliveries/${dn.id}/grn`, { method: "POST" });
      setGrn(g);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  async function setLine(dnItemId: number, accepted: number, rejected: number) {
    if (!grn) return;
    try {
      const updated = await api<Grn>(`/api/grns/${grn.id}/lines`, {
        method: "PATCH",
        body: { dn_item_id: dnItemId, accepted_qty: accepted, rejected_qty: rejected, notes: "" },
      });
      setGrn(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  async function complete() {
    if (!grn) return;
    try {
      await api<Grn>(`/api/grns/${grn.id}/complete`, { method: "POST" });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  return (
    <div style={{
      border: "1px solid #eee", padding: "0.5rem", borderRadius: 6, marginBottom: "0.5rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>DN #{dn.id} (order {dn.order})</strong>
        <span style={{ color: "#666" }}>{dn.status}</span>
      </div>
      <ul style={{ fontSize: 13, margin: "0.25rem 0" }}>
        {dn.items.map((it) => (
          <li key={it.id}>
            line {it.line_no}: {it.master_product_name} — {it.quantity} × {it.pack_type_code}
          </li>
        ))}
      </ul>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {isSupplier && dn.status === "DRAFT" && (
        <button onClick={() => onDispatch(dn.id)}>Dispatch</button>
      )}
      {!isSupplier && (dn.status === "DISPATCHED" || dn.status === "DELIVERED") && !grn && (
        <button onClick={() => void openGrn()}>Open receipt</button>
      )}
      {grn && (
        <div style={{ marginTop: "0.5rem", borderTop: "1px solid #eee", paddingTop: "0.5rem" }}>
          <strong>GRN #{grn.id} — {grn.status}</strong>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th>Line</th>
                <th>Shipped</th>
                <th>Accepted</th>
                <th>Rejected</th>
              </tr>
            </thead>
            <tbody>
              {grn.items.map((gi) => (
                <GrnRow
                  key={gi.id} item={gi}
                  editable={grn.status === "DRAFT"}
                  onSave={(a, r) => setLine(gi.dn_item, a, r)}
                />
              ))}
            </tbody>
          </table>
          {grn.status === "DRAFT" && (
            <p>
              <button onClick={() => void complete()}>Complete GRN</button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function GrnRow({
  item, editable, onSave,
}: {
  item: import("./portal-types").GrnItem;
  editable: boolean;
  onSave: (accepted: number, rejected: number) => void;
}) {
  const [accepted, setAccepted] = useState(item.accepted_qty);
  const [rejected, setRejected] = useState(item.rejected_qty);
  return (
    <tr style={{ borderBottom: "1px solid #f5f5f5" }}>
      <td>{item.line_no} — {item.master_product_name}</td>
      <td>{item.dn_quantity}</td>
      <td>
        {editable ? (
          <input
            type="number" min={0} max={item.dn_quantity} style={{ width: 60 }}
            value={accepted}
            onChange={(e) => setAccepted(Number(e.target.value) || 0)}
            onBlur={() => onSave(accepted, rejected)}
          />
        ) : item.accepted_qty}
      </td>
      <td>
        {editable ? (
          <input
            type="number" min={0} max={item.dn_quantity} style={{ width: 60 }}
            value={rejected}
            onChange={(e) => setRejected(Number(e.target.value) || 0)}
            onBlur={() => onSave(accepted, rejected)}
          />
        ) : item.rejected_qty}
      </td>
    </tr>
  );
}

function CreateDnForm({ onCreated }: { onCreated: () => void }) {
  const [orders, setOrders] = useState<OrderT[]>([]);
  const [orderId, setOrderId] = useState<number | "">("");
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<OrderT[]>("/api/orders/").then((all) => {
      // Only orders that are CONFIRMED or IN_FULFILLMENT
      setOrders(all.filter((o) => o.status === "CONFIRMED" || o.status === "IN_FULFILLMENT"));
    });
  }, []);

  const order = orders.find((o) => o.id === orderId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      const lines = order.items
        .map((oi) => ({ order_item_id: oi.id, quantity: qtys[oi.id] ?? oi.quantity }))
        .filter((ln) => ln.quantity > 0);
      await api(`/api/orders/${order.id}/deliveries`, {
        method: "POST",
        body: { lines },
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "0.5rem", maxWidth: 480, marginBottom: "0.5rem" }}>
      <label>
        Order
        <select required value={orderId} onChange={(e) => setOrderId(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">— select —</option>
          {orders.map((o) => <option key={o.id} value={o.id}>Order #{o.id} ({o.status})</option>)}
        </select>
      </label>
      {order && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th>Line</th>
              <th>Ordered</th>
              <th>Ship qty</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((oi) => (
              <tr key={oi.id}>
                <td>{oi.master_product_name}</td>
                <td>{oi.quantity}</td>
                <td>
                  <input
                    type="number" min={0} max={oi.quantity} style={{ width: 60 }}
                    value={qtys[oi.id] ?? oi.quantity}
                    onChange={(e) => setQtys({ ...qtys, [oi.id]: Number(e.target.value) || 0 })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit" disabled={busy || !order}>
        {busy ? "…" : "Create DN"}
      </button>
    </form>
  );
}

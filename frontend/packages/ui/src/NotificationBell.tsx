import { useEffect, useState } from "react";
import { ApiError, api } from "@mwrd/auth";

interface NotificationItem {
  id: number;
  kind: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

interface InboxResponse {
  items: NotificationItem[];
  unread: number;
}

export function NotificationBell() {
  const [data, setData] = useState<InboxResponse>({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setData(await api<InboxResponse>("/api/notifications"));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  useEffect(() => {
    void load();
    // Refresh every 20s — polling is fine for v1 (Channels/SSE later).
    const id = setInterval(() => void load(), 20_000);
    return () => clearInterval(id);
  }, []);

  async function markRead(id: number) {
    try {
      await api(`/api/notifications/${id}/read`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  async function markAll() {
    try {
      await api("/api/notifications/mark-all-read", { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        🔔 {data.unread > 0 && <strong>({data.unread})</strong>}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "#fff",
            color: "#111",
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: "0.5rem",
            width: 320,
            maxHeight: 400,
            overflowY: "auto",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <strong>Notifications</strong>
            <button onClick={() => void markAll()} style={{ fontSize: 12 }}>
              Mark all read
            </button>
          </div>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
          {data.items.length === 0 && (
            <p style={{ color: "#666", margin: 0 }}>No notifications yet.</p>
          )}
          {data.items.map((n) => (
            <div
              key={n.id}
              onClick={() => void markRead(n.id)}
              style={{
                padding: "0.4rem 0.25rem",
                borderBottom: "1px solid #eee",
                cursor: "pointer",
                background: n.read_at ? "transparent" : "#f4f7ff",
              }}
            >
              <strong style={{ fontSize: 13 }}>{n.title}</strong>
              {n.body && <p style={{ margin: "0.15rem 0 0", fontSize: 12, color: "#444" }}>{n.body}</p>}
              <p style={{ margin: 0, fontSize: 11, color: "#888" }}>{n.created_at?.slice(0, 16).replace("T", " ")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

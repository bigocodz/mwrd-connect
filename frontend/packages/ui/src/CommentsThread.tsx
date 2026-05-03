import { useEffect, useState } from "react";
import { ApiError, api } from "@mwrd/auth";

interface Comment {
  id: number;
  author_email: string;
  author_full_name: string;
  author_org_name: string;
  author_org_type: string;
  body: string;
  created_at: string;
}

interface Props {
  /** Target slug like `rfq:42` or `order:7`. */
  on: string;
}

export function CommentsThread({ on }: Props) {
  const [items, setItems] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await api<Comment[]>(`/api/comments?on=${encodeURIComponent(on)}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/comments?on=${encodeURIComponent(on)}`, {
        method: "POST",
        body: { body },
      });
      setBody("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: "1px solid #eee", marginTop: "0.5rem", paddingTop: "0.5rem" }}>
      <strong style={{ fontSize: 13 }}>Conversation ({items.length})</strong>
      {error && <p style={{ color: "crimson", fontSize: 12 }}>{error}</p>}
      <div style={{ maxHeight: 220, overflowY: "auto", marginTop: "0.25rem" }}>
        {items.map((c) => (
          <div
            key={c.id}
            style={{
              padding: "0.35rem 0",
              borderBottom: "1px solid #f5f5f5",
              fontSize: 13,
            }}
          >
            <div style={{ color: "#666", fontSize: 11 }}>
              <strong>{c.author_full_name || c.author_email}</strong>
              {" · "}{c.author_org_name} ({c.author_org_type}){" · "}{c.created_at?.slice(0, 16).replace("T", " ")}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem" }}>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={busy || !body.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

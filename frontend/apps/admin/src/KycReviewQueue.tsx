import { useEffect, useState } from "react";
import { ApiError, api } from "@mwrd/auth";
import type { KycSubmission } from "@mwrd/ui";

interface Props {
  reloadKey: number;
  onChanged: () => void;
}

export function KycReviewQueue({ reloadKey, onChanged }: Props) {
  const [items, setItems] = useState<KycSubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await api<KycSubmission[]>("/api/staff/kyc/queue"));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [reloadKey]);

  async function review(
    id: number,
    action: "approve" | "request-changes" | "reject",
    requireNotes: boolean
  ) {
    let notes = "";
    if (requireNotes) {
      const n = window.prompt(`Notes for ${action}:`);
      if (!n) return;
      notes = n;
    }
    try {
      await api(`/api/staff/kyc/${id}/${action}`, {
        method: "POST",
        body: { notes },
      });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  if (items === null) return <p>Loading…</p>;
  return (
    <section>
      <h3>KYC review queue ({items.length})</h3>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {items.length === 0 && <p style={{ color: "#666" }}>Nothing to review.</p>}
      {items.map((s) => (
        <div
          key={s.id}
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem", marginBottom: "0.5rem" }}
        >
          <p style={{ margin: 0 }}>
            <strong>{s.legal_name}</strong> (org id {s.organization})
          </p>
          <p style={{ margin: 0, color: "#666", fontSize: 13 }}>
            CR: {s.cr_number || "—"} | VAT: {s.vat_number || "—"} | Submitted:{" "}
            {s.submitted_at}
          </p>
          <p style={{ margin: "0.25rem 0", fontSize: 13 }}>
            Documents: {s.documents.map((d) => `${d.kind} (${d.original_filename})`).join(", ")}
          </p>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <button onClick={() => void review(s.id, "approve", false)}>Approve</button>
            <button onClick={() => void review(s.id, "request-changes", true)}>
              Request changes
            </button>
            <button onClick={() => void review(s.id, "reject", true)}>Reject</button>
          </div>
        </div>
      ))}
    </section>
  );
}

import { useState } from "react";
import { ApiError, api } from "@mwrd/auth";

interface Props {
  onCreated: () => void;
}

export function CreateOrgForm({ onCreated }: Props) {
  const [type, setType] = useState<"CLIENT" | "SUPPLIER">("CLIENT");
  const [name, setName] = useState("");
  const [publicId, setPublicId] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await api<{ organization_id: number; invite_id: number }>(
        "/api/staff/orgs/create",
        {
          method: "POST",
          body: { type, name, public_id: publicId, contact_email: contactEmail },
        }
      );
      setSuccess(
        `Org #${resp.organization_id} created — invite emailed to ${contactEmail}.`
      );
      setName("");
      setPublicId("");
      setContactEmail("");
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "0.5rem", maxWidth: 420 }}>
      <h3 style={{ margin: 0 }}>Create new organization</h3>
      <label>
        Type
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="CLIENT">CLIENT</option>
          <option value="SUPPLIER">SUPPLIER</option>
        </select>
      </label>
      <label>
        Name
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Public ID
        <input required value={publicId} onChange={(e) => setPublicId(e.target.value)} />
      </label>
      <label>
        Owner email
        <input
          type="email"
          required
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "…" : "Create + send invite"}
      </button>
      {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
      {success && <p style={{ color: "green", margin: 0 }}>{success}</p>}
    </form>
  );
}

import { useEffect, useState } from "react";
import { ApiError, api } from "@mwrd/auth";
import type { DocKind, KycSubmission, SignedUpload } from "./portal-types";

const DOC_KINDS: { kind: DocKind; label: string }[] = [
  { kind: "CR", label: "Commercial registration" },
  { kind: "VAT", label: "VAT certificate" },
  { kind: "BANK_LETTER", label: "Bank letter" },
  { kind: "ID_CARD", label: "ID card" },
  { kind: "OTHER", label: "Other" },
];

export function KycWizard() {
  const [sub, setSub] = useState<KycSubmission | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    try {
      setSub(await api<KycSubmission>("/api/kyc/current"));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (!sub) return <p>Loading KYC…</p>;

  const editable = sub.status === "DRAFT" || sub.status === "CHANGES_REQUESTED";

  async function patch(field: keyof KycSubmission, value: string) {
    if (!sub) return;
    setSub({ ...sub, [field]: value });
  }

  async function save() {
    if (!sub) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api<KycSubmission>("/api/kyc/current", {
        method: "PATCH",
        body: {
          legal_name: sub.legal_name,
          legal_name_ar: sub.legal_name_ar,
          cr_number: sub.cr_number,
          vat_number: sub.vat_number,
          address_line1: sub.address_line1,
          city: sub.city,
          country: sub.country,
        },
      });
      setSub(updated);
      setSuccess("Saved.");
      setTimeout(() => setSuccess(null), 1500);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(kind: DocKind, file: File) {
    setBusy(true);
    setError(null);
    try {
      const signed = await api<SignedUpload>("/api/kyc/current/uploads", {
        method: "POST",
        body: { kind, filename: file.name, content_type: file.type || "application/octet-stream" },
      });
      const put = await fetch(signed.upload.url, {
        method: signed.upload.method,
        headers: signed.upload.headers,
        body: file,
      });
      if (!put.ok) throw new Error(`Storage upload failed (${put.status})`);
      await api("/api/kyc/current/documents", {
        method: "POST",
        body: {
          kind,
          storage_key: signed.storage_key,
          original_filename: file.name,
          content_type: file.type || "application/octet-stream",
          size_bytes: file.size,
        },
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteDoc(id: number) {
    setBusy(true);
    try {
      await api(`/api/kyc/current/documents/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api<KycSubmission>("/api/kyc/current/submit", {
        method: "POST",
      });
      setSub(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function lookupCr() {
    if (!sub) return;
    setError(null);
    try {
      const rec = await api<{
        legal_name_en: string; legal_name_ar: string; status: string;
      }>(`/api/wathq/cr-lookup?cr_number=${encodeURIComponent(sub.cr_number)}`);
      setSub({
        ...sub,
        legal_name: sub.legal_name || rec.legal_name_en,
        legal_name_ar: sub.legal_name_ar || rec.legal_name_ar,
      });
      setSuccess(`CR found (${rec.status}). Legal names pre-filled — review and save.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  async function lookupAddress() {
    if (!sub) return;
    const code = window.prompt("Saudi short address code (4 letters + 4 digits):") ?? "";
    if (!code) return;
    setError(null);
    try {
      const addr = await api<{
        building_number: string; street: string; district: string;
        city: string; postal_code: string;
      }>(`/api/spl/lookup?code=${encodeURIComponent(code)}`);
      setSub({
        ...sub,
        address_line1: `${addr.building_number} ${addr.street}, ${addr.district}`,
        city: addr.city,
      });
      setSuccess("Address resolved — review and save.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>KYC submission</h2>
      <p style={{ color: "#666", margin: 0 }}>
        Status: <strong>{sub.status}</strong>
      </p>
      {sub.review_notes && (
        <p style={{ background: "#fff3cd", padding: "0.5rem", borderRadius: 4 }}>
          Reviewer notes: {sub.review_notes}
        </p>
      )}

      <fieldset disabled={!editable || busy} style={{ display: "grid", gap: "0.5rem", border: "none", padding: 0, marginTop: "1rem" }}>
        <label>
          Legal name (English)
          <input value={sub.legal_name} onChange={(e) => patch("legal_name", e.target.value)} />
        </label>
        <label>
          Legal name (Arabic)
          <input value={sub.legal_name_ar} onChange={(e) => patch("legal_name_ar", e.target.value)} />
        </label>
        <label>
          CR number
          <span style={{ display: "flex", gap: "0.25rem" }}>
            <input
              value={sub.cr_number}
              onChange={(e) => patch("cr_number", e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" onClick={() => void lookupCr()} disabled={!sub.cr_number}>
              Verify (Wathq)
            </button>
          </span>
        </label>
        <label>
          VAT number
          <input value={sub.vat_number} onChange={(e) => patch("vat_number", e.target.value)} />
        </label>
        <label>
          Address
          <span style={{ display: "flex", gap: "0.25rem" }}>
            <input
              value={sub.address_line1}
              onChange={(e) => patch("address_line1", e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" onClick={() => void lookupAddress()}>
              Resolve (SPL)
            </button>
          </span>
        </label>
        <label>
          City
          <input value={sub.city} onChange={(e) => patch("city", e.target.value)} />
        </label>
        <button type="button" onClick={() => void save()}>
          Save
        </button>
      </fieldset>

      <h3>Documents</h3>
      {sub.documents.length === 0 && <p style={{ color: "#666" }}>None uploaded yet.</p>}
      <ul>
        {sub.documents.map((d) => (
          <li key={d.id}>
            <strong>{d.kind}</strong>: {d.original_filename}{" "}
            {editable && (
              <button onClick={() => void deleteDoc(d.id)} disabled={busy}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {editable && (
        <div style={{ display: "grid", gap: "0.5rem", maxWidth: 400 }}>
          {DOC_KINDS.map(({ kind, label }) => (
            <label key={kind}>
              {label}:{" "}
              <input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile(kind, f);
                  e.target.value = "";
                }}
                disabled={busy}
              />
            </label>
          ))}
        </div>
      )}

      {editable && sub.documents.length > 0 && (
        <p>
          <button onClick={() => void submit()} disabled={busy}>
            Submit for review
          </button>
        </p>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}
    </section>
  );
}

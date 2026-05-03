import { useState } from "react";
import { ApiError, api } from "@mwrd/auth";
import type { ClientInvoiceT } from "@mwrd/ui";

interface Props {
  reloadKey: number;
  onChanged: () => void;
}

export function InvoicingPanel({ reloadKey: _reloadKey, onChanged }: Props) {
  const [error, setError] = useState<string | null>(null);

  const [siId, setSiId] = useState("");
  const [ciId, setCiId] = useState("");
  const [payoutSiId, setPayoutSiId] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  async function generateClientInvoice(e: React.FormEvent) {
    e.preventDefault();
    try {
      const ci = await api<ClientInvoiceT>(
        `/api/staff/supplier-invoices/${siId}/generate-client-invoice`,
        { method: "POST" },
      );
      setInfo(`Created CI #${ci.id} (${ci.number}) total ${ci.total} SAR`);
      setSiId("");
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  async function issueClientInvoice(e: React.FormEvent) {
    e.preventDefault();
    try {
      const ci = await api<ClientInvoiceT>(
        `/api/staff/client-invoices/${ciId}/issue`, { method: "POST" },
      );
      setInfo(`Issued CI #${ci.id} (${ci.status})`);
      setCiId("");
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  async function recordPayout(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/staff/payouts/record", {
        method: "POST",
        body: {
          invoice_id: Number(payoutSiId),
          amount: payoutAmount,
          method: "BANK_TRANSFER",
        },
      });
      setInfo(`Recorded payout for SI #${payoutSiId}`);
      setPayoutSiId("");
      setPayoutAmount("");
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>Invoicing & payouts</h3>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {info && <p style={{ color: "green" }}>{info}</p>}
      <p style={{ color: "#666", fontSize: 13, marginTop: 0 }}>
        Phase 5 admin actions. Look up supplier-invoice / client-invoice ids in
        Django admin or via the customer portals; we'll add a staff-side list
        view in a follow-up.
      </p>

      <form onSubmit={generateClientInvoice} style={{ display: "flex", gap: "0.5rem", alignItems: "end", marginBottom: "0.5rem" }}>
        <label>SI id<input value={siId} onChange={(e) => setSiId(e.target.value)} required style={{ width: 80 }} /></label>
        <button type="submit">Generate client invoice</button>
      </form>

      <form onSubmit={issueClientInvoice} style={{ display: "flex", gap: "0.5rem", alignItems: "end", marginBottom: "0.5rem" }}>
        <label>CI id<input value={ciId} onChange={(e) => setCiId(e.target.value)} required style={{ width: 80 }} /></label>
        <button type="submit">Issue client invoice</button>
      </form>

      <form onSubmit={recordPayout} style={{ display: "flex", gap: "0.5rem", alignItems: "end", marginBottom: "0.5rem" }}>
        <label>SI id<input value={payoutSiId} onChange={(e) => setPayoutSiId(e.target.value)} required style={{ width: 80 }} /></label>
        <label>Amount<input value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} required style={{ width: 100 }} /></label>
        <button type="submit">Record payout</button>
      </form>
    </section>
  );
}

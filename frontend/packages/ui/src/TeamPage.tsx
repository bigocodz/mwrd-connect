import { useEffect, useState } from "react";
import { ApiError, api, useAuth } from "@mwrd/auth";
import type { TeamMember } from "./portal-types";

const ASSIGNABLE_ROLES = ["ADMIN", "BUYER", "APPROVER", "VIEWER"] as const;

export function TeamPage() {
  const { me } = useAuth();
  const canManage = me?.role === "OWNER" || me?.role === "ADMIN";

  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ASSIGNABLE_ROLES)[number]>("BUYER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function load() {
    try {
      setTeam(await api<TeamMember[]>("/api/orgs/team"));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api("/api/orgs/team/invite", {
        method: "POST",
        body: { email, role },
      });
      setEmail("");
      setInfo(`Invite sent to ${email}.`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Team</h2>
      {team === null && <p>Loading…</p>}
      {team && team.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id}>
                <td>{m.user_full_name || "—"}</td>
                <td>{m.user_email}</td>
                <td>{m.role}</td>
                <td>{m.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={invite} style={{ display: "grid", gap: "0.5rem", marginTop: "1rem", maxWidth: 400 }}>
          <h3 style={{ margin: 0 }}>Invite teammate</h3>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "…" : "Send invite"}
          </button>
        </form>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {info && <p style={{ color: "green" }}>{info}</p>}
    </section>
  );
}

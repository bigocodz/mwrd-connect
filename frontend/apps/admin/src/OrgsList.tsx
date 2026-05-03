import { useEffect, useState } from "react";
import { ApiError, api } from "@mwrd/auth";
import type { OrgListItem } from "@mwrd/ui";

interface Props {
  reloadKey: number;
  onChanged: () => void;
}

export function OrgsList({ reloadKey, onChanged }: Props) {
  const [orgs, setOrgs] = useState<OrgListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setOrgs(await api<OrgListItem[]>("/api/staff/orgs"));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [reloadKey]);

  async function action(orgId: number, path: string, body: unknown = undefined) {
    setError(null);
    try {
      await api(`/api/staff/orgs/${orgId}/${path}`, {
        method: "POST",
        body,
      });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  if (orgs === null) return <p>Loading…</p>;
  return (
    <section>
      <h3>Organizations ({orgs.length})</h3>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Email</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((o) => (
            <tr key={o.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
              <td>{o.name}</td>
              <td>{o.type}</td>
              <td>{o.status}</td>
              <td>{o.contact_email}</td>
              <td style={{ display: "flex", gap: "0.25rem", padding: "0.25rem 0" }}>
                {o.status !== "SUSPENDED" && o.status !== "ARCHIVED" && (
                  <button
                    onClick={() => {
                      const reason = window.prompt("Suspension reason?");
                      if (reason) void action(o.id, "suspend", { reason });
                    }}
                  >
                    Suspend
                  </button>
                )}
                {o.status === "SUSPENDED" && (
                  <button onClick={() => void action(o.id, "unsuspend", {})}>
                    Unsuspend
                  </button>
                )}
                {o.status !== "ARCHIVED" && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Archive ${o.name}? This is irreversible.`))
                        void action(o.id, "archive", {});
                    }}
                  >
                    Archive
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

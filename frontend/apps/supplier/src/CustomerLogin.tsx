import { useState } from "react";
import { ApiError, useAuth } from "@mwrd/auth";

export function CustomerLogin() {
  const { customerLogin, signupFromInvite } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (inviteToken) {
        await signupFromInvite(inviteToken, fullName, password);
      } else {
        await customerLogin(email, password);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "0.75rem", maxWidth: 360 }}>
      {inviteToken ? (
        <>
          <p style={{ margin: 0, color: "#444" }}>
            Accepting invite — set your password to continue.
          </p>
          <label>
            Full name
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label>
            Password (min 12 chars)
            <input
              type="password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        </>
      ) : (
        <>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        </>
      )}
      {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "…" : inviteToken ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}

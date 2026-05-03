import { useState } from "react";
import { ApiError, useAuth } from "@mwrd/auth";

type Mode = "login" | "enroll";

export function StaffLogin() {
  const { staffLogin, staffEnrollStart, staffEnrollConfirm } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [provisioningUri, setProvisioningUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await staffLogin(email, password, otp);
      } else if (provisioningUri === null) {
        const resp = await staffEnrollStart(email, password);
        setProvisioningUri(resp.provisioning_uri);
        setSecret(resp.secret);
      } else {
        await staffEnrollConfirm(email, password, otp);
      }
    } catch (e) {
      if (e instanceof ApiError) setError(e.detail);
      else setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "0.75rem", maxWidth: 360 }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={() => setMode("login")}
          disabled={mode === "login"}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("enroll")}
          disabled={mode === "enroll"}
        >
          Enroll TOTP
        </button>
      </div>

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

      {(mode === "login" || provisioningUri !== null) && (
        <label>
          6-digit code
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            minLength={6}
            maxLength={6}
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            autoComplete="one-time-code"
          />
        </label>
      )}

      {provisioningUri && (
        <div style={{ background: "#f5f5f5", padding: "0.75rem", fontSize: 12 }}>
          <p style={{ margin: 0 }}>
            <strong>Scan this in your authenticator app, then enter the code below:</strong>
          </p>
          <code style={{ wordBreak: "break-all" }}>{provisioningUri}</code>
          <p style={{ margin: "0.5rem 0 0" }}>
            Manual key: <code>{secret}</code>
          </p>
        </div>
      )}

      {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}

      <button type="submit" disabled={busy}>
        {busy
          ? "…"
          : mode === "login"
            ? "Sign in"
            : provisioningUri
              ? "Confirm enrollment"
              : "Begin enrollment"}
      </button>
    </form>
  );
}

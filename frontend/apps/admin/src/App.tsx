import { RequireAuth, useAuth } from "@mwrd/auth";
import { StaffLogin } from "./StaffLogin";
import { Dashboard } from "./Dashboard";

export default function App() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1>MWRD admin portal</h1>
      <p style={{ color: "#666" }}>Internal use only. Network-restricted in prod.</p>
      <RequireAuth
        scope="staff"
        fallback={<StaffLogin />}
        loading={<p>Loading…</p>}
        forbidden={<ForbiddenWithLogout />}
      >
        <Dashboard />
      </RequireAuth>
    </main>
  );
}

function ForbiddenWithLogout() {
  const { logout } = useAuth();
  return (
    <div>
      <p>This portal is for MWRD staff only.</p>
      <button onClick={() => void logout()}>Sign out</button>
    </div>
  );
}

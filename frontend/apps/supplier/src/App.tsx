import { RequireAuth, useAuth, type OrgType } from "@mwrd/auth";
import { CustomerLogin } from "./CustomerLogin";
import { Dashboard } from "./Dashboard";

const PORTAL_ORG_TYPE: OrgType = "SUPPLIER";

export default function App() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1>MWRD supplier portal</h1>
      <RequireAuth
        scope="customer"
        fallback={<CustomerLogin />}
        loading={<p>Loading…</p>}
      >
        <PortalGate>
          <Dashboard />
        </PortalGate>
      </RequireAuth>
    </main>
  );
}

function PortalGate({ children }: { children: React.ReactNode }) {
  const { me, logout } = useAuth();
  if (me?.organization?.type !== PORTAL_ORG_TYPE) {
    return (
      <div>
        <p>
          This portal is for {PORTAL_ORG_TYPE.toLowerCase()} accounts. Your organization is
          a {me?.organization?.type ?? "unknown"}.
        </p>
        <button onClick={() => void logout()}>Sign out</button>
      </div>
    );
  }
  return <>{children}</>;
}

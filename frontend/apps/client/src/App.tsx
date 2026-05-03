import { RequireAuth, useAuth, type OrgType } from "@mwrd/auth";
import { LocaleToggle, useLocale } from "@mwrd/i18n";
import { CustomerLogin } from "./CustomerLogin";
import { Dashboard } from "./Dashboard";

const PORTAL_ORG_TYPE: OrgType = "CLIENT";

export default function App() {
  const { t, dir } = useLocale();
  return (
    <main
      // R14 — `dir` is also set on <html> by the provider. Setting it on
      // <main> too keeps shadow-DOM-isolated style scopes correct.
      dir={dir}
      style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 600, margin: "0 auto" }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>MWRD client portal</h1>
        <LocaleToggle />
      </header>
      <RequireAuth
        scope="customer"
        fallback={<CustomerLogin />}
        loading={<p>{t("app.loading")}</p>}
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
  const { t } = useLocale();
  if (me?.organization?.type !== PORTAL_ORG_TYPE) {
    return (
      <div>
        <p>
          This portal is for {PORTAL_ORG_TYPE.toLowerCase()} accounts. Your organization is
          a {me?.organization?.type ?? "unknown"}.
        </p>
        <button onClick={() => void logout()}>{t("app.signOut")}</button>
      </div>
    );
  }
  return <>{children}</>;
}

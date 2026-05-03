import { useState } from "react";
import { useAuth } from "@mwrd/auth";
import { DashboardSummary } from "@mwrd/ui";
import { CreateOrgForm } from "./CreateOrgForm";
import { OrgsList } from "./OrgsList";
import { KycReviewQueue } from "./KycReviewQueue";
import { CatalogPanel } from "./CatalogPanel";
import { InvoicingPanel } from "./InvoicingPanel";

export function Dashboard() {
  const { me, logout } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const bump = () => setReloadKey((k) => k + 1);

  if (!me) return null;
  return (
    <section style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <h2>Signed in</h2>
        <ul>
          <li>email: {me.user.email}</li>
          <li>scope: {me.scope}</li>
        </ul>
        <button onClick={() => void logout()}>Sign out</button>
      </div>
      <DashboardSummary endpoint="/api/staff/dashboard/summary" />
      <CreateOrgForm onCreated={bump} />
      <KycReviewQueue reloadKey={reloadKey} onChanged={bump} />
      <CatalogPanel reloadKey={reloadKey} onChanged={bump} />
      <InvoicingPanel reloadKey={reloadKey} onChanged={bump} />
      <OrgsList reloadKey={reloadKey} onChanged={bump} />
    </section>
  );
}

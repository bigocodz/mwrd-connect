import { useAuth } from "@mwrd/auth";
import {
  CatalogBrowse,
  ClientRfqs,
  ContractsPanel,
  DashboardSummary,
  DeliveriesPanel,
  InvoicesPanel,
  KycWizard,
  NotificationBell,
  OrdersPanel,
  TeamPage,
} from "@mwrd/ui";

export function Dashboard() {
  const { me, logout } = useAuth();
  if (!me || !me.organization) return null;

  const showKyc =
    me.organization.status === "KYC_PENDING" ||
    me.organization.status === "KYC_REVIEW" ||
    me.organization.status === "ACTIVE";
  const isActive = me.organization.status === "ACTIVE";

  return (
    <section style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <h2 style={{ marginTop: 0 }}>Welcome, {me.user.full_name || me.user.email}</h2>
          <ul>
            <li>organization: {me.organization.name}</li>
            <li>status: {me.organization.status}</li>
            <li>role: {me.role}</li>
          </ul>
          <button onClick={() => void logout()}>Sign out</button>
        </div>
        <NotificationBell />
      </div>
      {isActive && <DashboardSummary />}
      {showKyc && <KycWizard />}
      {isActive && <ClientRfqs />}
      {isActive && <ContractsPanel />}
      {isActive && <OrdersPanel />}
      {isActive && <DeliveriesPanel />}
      {isActive && <InvoicesPanel />}
      {isActive && <CatalogBrowse />}
      <TeamPage />
    </section>
  );
}

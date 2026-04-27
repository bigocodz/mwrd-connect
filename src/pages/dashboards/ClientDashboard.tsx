import ClientLayout from "@/components/client/ClientLayout";
import { useAuth } from "@/hooks/useAuth";
import { formatSAR } from "@/components/shared/VatBadge";
import { LinkCard, MetricCard, PageHeader, Panel } from "@/components/app/AppSurface";
import { CheckDone01, CreditCard01, FileQuestion02, PackageCheck, Receipt, ShoppingBag03, Wallet02 } from "@untitledui/icons";
import { useLanguage } from "@/contexts/LanguageContext";

const ClientDashboard = () => {
  const { profile } = useAuth();
  const { tr } = useLanguage();
  const creditLimit = Number(profile?.credit_limit ?? 0);
  const currentBalance = Number(profile?.current_balance ?? 0);
  const availableCredit = Math.max(creditLimit - currentBalance, 0);
  const creditHealthPct = creditLimit > 0 ? Math.min(100, Math.max(0, (availableCredit / creditLimit) * 100)) : 100;
  const paymentTerms = tr(profile?.payment_terms?.replace(/_/g, " ") ?? "Prepaid");

  return (
    <ClientLayout>
      <PageHeader
        title={tr("Client Dashboard")}
        description={tr("Track your buying power, open purchasing work, and the next actions in your procurement flow.")}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={tr("Credit Limit")} value={formatSAR(creditLimit)} icon={Wallet02} />
        <MetricCard
          label={tr("Current Balance")}
          value={<span className={currentBalance < 0 ? "text-text-error-primary" : undefined}>{formatSAR(currentBalance)}</span>}
          icon={CreditCard01}
          tone={currentBalance > creditLimit * 0.8 && creditLimit > 0 ? "warning" : "default"}
        />
        <MetricCard label={tr("Available Credit")} value={formatSAR(availableCredit)} icon={Wallet02} tone="success" />
        <MetricCard label={tr("Payment Terms")} value={<span className="capitalize">{paymentTerms}</span>} icon={Receipt} />
      </div>

      <Panel
        className="mt-6"
        title={tr("Buying Workspace")}
        description={tr("A quick read on where your procurement flow stands before you move into a task.")}
        icon={CheckDone01}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border-2 border-white bg-white/70 p-4">
            <p className="text-xs font-semibold text-[#667085]">{tr("Credit health")}</p>
            <p className="mt-2 text-lg font-semibold text-[#1d2939]">
              {creditLimit > 0 ? `${Math.round(creditHealthPct)}% ${tr("available")}` : tr("Prepaid")}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef0f3]">
              <div className="h-full rounded-full bg-[#ff6d43]" style={{ width: `${creditHealthPct}%` }} />
            </div>
          </div>
          <div className="rounded-xl bg-[#eaf8fb] p-4">
            <p className="text-xs font-semibold text-[#667085]">{tr("Next best action")}</p>
            <p className="mt-2 text-lg font-semibold text-[#1d2939]">{tr("Create RFQ")}</p>
            <p className="mt-1 text-sm text-[#667085]">{tr("Convert demand into a controlled supplier request.")}</p>
          </div>
          <div className="rounded-xl bg-[#fff1eb] p-4">
            <p className="text-xs font-semibold text-[#667085]">{tr("Portal status")}</p>
            <p className="mt-2 text-lg font-semibold text-[#1d2939]">{tr(profile?.status ?? "ACTIVE")}</p>
            <p className="mt-1 text-sm text-[#667085]">{tr("Company workspace is ready for procurement activity.")}</p>
          </div>
        </div>
      </Panel>

      <Panel className="mt-6" title={tr("RFQ to PO Flow")} description={tr("The managed path every client request follows through MWRD.")}>
        <div className="grid gap-3 md:grid-cols-5">
          {[
            { label: tr("RFQ"), value: tr("Demand captured"), icon: FileQuestion02 },
            { label: tr("Routing"), value: tr("MWRD shortlists"), icon: CheckDone01 },
            { label: tr("Offers"), value: tr("Anonymized options"), icon: Receipt },
            { label: tr("Approval"), value: tr("PO signed"), icon: PackageCheck },
            { label: tr("Invoice"), value: tr("Wafeq cleared"), icon: Wallet02 },
          ].map((step, index) => (
            <div key={step.label} className="rounded-xl border-2 border-white bg-white/70 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fff1eb] text-[#ff6d43]">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-[#98a2b3]">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <p className="text-sm font-semibold text-[#1d2939]">{step.label}</p>
              <p className="mt-1 text-xs leading-5 text-[#667085]">{step.value}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        className="mt-6"
        title={tr("Procurement Shortcuts")}
        description={tr("Move quickly into the workflows clients use most often.")}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <LinkCard
            title={tr("Browse Catalog")}
            description={tr("Review approved supplier products before creating a request.")}
            href="/client/catalog"
            icon={ShoppingBag03}
          />
          <LinkCard
            title={tr("Create RFQ")}
            description={tr("Start a structured request with product or custom line items.")}
            href="/client/rfq/new"
            icon={FileQuestion02}
          />
          <LinkCard
            title={tr("Review Quotes")}
            description={tr("Accept or reject quotes MWRD has prepared for your requests.")}
            href="/client/quotes"
            icon={Receipt}
          />
        </div>
      </Panel>
    </ClientLayout>
  );
};

export default ClientDashboard;

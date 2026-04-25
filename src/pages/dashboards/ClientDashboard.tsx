import ClientLayout from "@/components/client/ClientLayout";
import { useAuth } from "@/hooks/useAuth";
import { formatSAR } from "@/components/shared/VatBadge";
import { LinkCard, MetricCard, PageHeader, Panel } from "@/components/app/AppSurface";
import { CreditCard01, FileQuestion02, Receipt, ShoppingBag03, Wallet02 } from "@untitledui/icons";
import { useLanguage } from "@/contexts/LanguageContext";

const ClientDashboard = () => {
  const { profile } = useAuth();
  const { tr } = useLanguage();
  const creditLimit = Number(profile?.credit_limit ?? 0);
  const currentBalance = Number(profile?.current_balance ?? 0);
  const availableCredit = Math.max(creditLimit - currentBalance, 0);
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

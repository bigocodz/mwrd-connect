import { Link } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { useAuth } from "@/hooks/useAuth";
import { formatSAR } from "@/components/shared/VatBadge";
import { FlowStepCard, LinkCard, MetricCard, PageHeader, Panel, SignalCard } from "@/components/app/AppSurface";
import { Button } from "@/components/ui/button";
import {
  CheckDone01,
  CreditCard01,
  FileQuestion02,
  PackageCheck,
  Receipt,
  ShoppingBag03,
  Wallet02,
} from "@untitledui/icons";
import { useLanguage } from "@/contexts/LanguageContext";

const ClientDashboard = () => {
  const { profile } = useAuth();
  const { tr } = useLanguage();
  const creditLimit = Number(profile?.credit_limit ?? 0);
  const currentBalance = Number(profile?.current_balance ?? 0);
  const availableCredit = Math.max(creditLimit - currentBalance, 0);
  const creditHealthPct =
    creditLimit > 0 ? Math.min(100, Math.max(0, (availableCredit / creditLimit) * 100)) : 100;
  const paymentTerms = tr(profile?.payment_terms?.replace(/_/g, " ") ?? "Prepaid");
  const utilizationPct = creditLimit > 0 ? Math.round((currentBalance / creditLimit) * 100) : 0;
  const balanceDanger = creditLimit > 0 && currentBalance > creditLimit * 0.8;

  return (
    <ClientLayout>
      <PageHeader
        title={tr("Client Dashboard")}
        description={tr(
          "Track your buying power, open purchasing work, and the next actions in your procurement flow.",
        )}
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link to="/client/catalog">
                <ShoppingBag03 data-icon="inline-start" />
                {tr("Browse Catalog")}
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link to="/client/rfq/new">
                <FileQuestion02 data-icon="inline-start" />
                {tr("Create RFQ")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={tr("Credit Limit")} value={formatSAR(creditLimit)} icon={Wallet02} />
        <MetricCard
          label={tr("Current Balance")}
          value={formatSAR(currentBalance)}
          icon={CreditCard01}
          tone={balanceDanger ? "warning" : "default"}
          helper={creditLimit > 0 ? tr("{pct}% utilized", { pct: utilizationPct }) : undefined}
        />
        <MetricCard
          label={tr("Available Credit")}
          value={formatSAR(availableCredit)}
          icon={Wallet02}
          tone="success"
        />
        <MetricCard
          label={tr("Payment Terms")}
          value={<span className="capitalize">{paymentTerms}</span>}
          icon={Receipt}
        />
      </div>

      <Panel
        className="mt-6"
        title={tr("Buying Workspace")}
        description={tr("A quick read on where your procurement flow stands before you move into a task.")}
        icon={CheckDone01}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <SignalCard
            label={tr("Credit health")}
            value={creditLimit > 0 ? `${Math.round(creditHealthPct)}% ${tr("available")}` : tr("Prepaid")}
            tone={balanceDanger ? "warning" : "success"}
            icon={Wallet02}
            helper={
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-soft-200">
                <div
                  className="h-full rounded-full bg-primary-base transition-[width] duration-500"
                  style={{ width: `${creditHealthPct}%` }}
                />
              </div>
            }
          />
          <SignalCard
            label={tr("Next best action")}
            value={tr("Create RFQ")}
            helper={tr("Convert demand into a controlled supplier request.")}
            tone="info"
            icon={FileQuestion02}
          />
          <SignalCard
            label={tr("Portal status")}
            value={tr(profile?.status ?? "ACTIVE")}
            helper={tr("Company workspace is ready for procurement activity.")}
            tone="brand"
            icon={CheckDone01}
          />
        </div>
      </Panel>

      <Panel
        className="mt-6"
        title={tr("RFQ to PO Flow")}
        description={tr("The managed path every client request follows through MWRD.")}
      >
        <div className="grid gap-3 md:grid-cols-5">
          {[
            { label: tr("RFQ"), value: tr("Demand captured"), icon: FileQuestion02 },
            { label: tr("Routing"), value: tr("MWRD shortlists"), icon: CheckDone01 },
            { label: tr("Offers"), value: tr("Anonymized options"), icon: Receipt },
            { label: tr("Approval"), value: tr("PO signed"), icon: PackageCheck },
            { label: tr("Invoice"), value: tr("Wafeq cleared"), icon: Wallet02 },
          ].map((step, index) => (
            <FlowStepCard
              key={step.label}
              label={step.label}
              value={step.value}
              icon={step.icon}
              index={index}
              tone={index === 0 ? "brand" : index === 1 ? "info" : "neutral"}
            />
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

import { Link } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { useAuth } from "@/hooks/useAuth";
import { formatSAR } from "@/components/shared/VatBadge";
import { LinkCard, MetricCard, PageHeader, Panel } from "@/components/app/AppSurface";
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
                <ShoppingBag03 className="h-4 w-4" />
                {tr("Browse Catalog")}
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link to="/client/rfq/new">
                <FileQuestion02 className="h-4 w-4" />
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
          <div className="rounded-12 border border-stroke-soft-200 bg-bg-weak-50 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-soft-400">
              {tr("Credit health")}
            </p>
            <p className="mt-2 text-lg font-semibold leading-tight tracking-[-0.01em] text-strong-950">
              {creditLimit > 0 ? `${Math.round(creditHealthPct)}% ${tr("available")}` : tr("Prepaid")}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-soft-200">
              <div
                className="h-full rounded-full bg-primary-base transition-[width] duration-500"
                style={{ width: `${creditHealthPct}%` }}
              />
            </div>
          </div>
          <div className="rounded-12 border border-stroke-soft-200 bg-information-lighter p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#2542c2]/70">
              {tr("Next best action")}
            </p>
            <p className="mt-2 text-lg font-semibold leading-tight tracking-[-0.01em] text-strong-950">
              {tr("Create RFQ")}
            </p>
            <p className="mt-1 text-sm leading-5 text-sub-600">
              {tr("Convert demand into a controlled supplier request.")}
            </p>
          </div>
          <div className="rounded-12 border border-stroke-soft-200 bg-primary-light p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-primary-dark/70">
              {tr("Portal status")}
            </p>
            <p className="mt-2 text-lg font-semibold leading-tight tracking-[-0.01em] text-strong-950">
              {tr(profile?.status ?? "ACTIVE")}
            </p>
            <p className="mt-1 text-sm leading-5 text-sub-600">
              {tr("Company workspace is ready for procurement activity.")}
            </p>
          </div>
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
            <div
              key={step.label}
              className="rounded-12 border border-stroke-soft-200 bg-bg-white-0 p-4 transition-shadow hover:shadow-[var(--shadow-regular-sm)]"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-10 bg-primary-light text-primary-dark ring-1 ring-primary-alpha-16">
                  <step.icon className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium text-soft-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <p className="text-sm font-semibold text-strong-950">{step.label}</p>
              <p className="mt-0.5 text-xs leading-5 text-sub-600">{step.value}</p>
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

import SupplierLayout from "@/components/supplier/SupplierLayout";
import { useAuth } from "@/hooks/useAuth";
import { FlowStepCard, LinkCard, MetricCard, PageHeader, Panel, SignalCard } from "@/components/app/AppSurface";
import { BankNote01, CheckCircle, FileCheck02, Package, PackageCheck, Receipt, ShieldTick, Star01 } from "@untitledui/icons";
import { useLanguage } from "@/contexts/LanguageContext";

const SupplierDashboard = () => {
  const { profile } = useAuth();
  const { tr } = useLanguage();
  const welcomeLine = profile?.company_name ? tr("Welcome, {company}.", { company: profile.company_name }) : tr("Welcome.");
  const profileStatus = profile?.status ?? "ACTIVE";
  const statusTone = profileStatus === "ACTIVE" ? "success" : "warning";

  return (
    <SupplierLayout>
      <PageHeader
        title={tr("Supplier Dashboard")}
        description={`${welcomeLine} ${tr("Manage your catalog, RFQs, and commercial activity from one workspace.")}`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={tr("Marketplace Status")}
          value={<span className="capitalize">{tr(profileStatus)}</span>}
          icon={ShieldTick}
          tone={statusTone}
          helper={tr("KYC and commercial profile stay visible to MWRD operations.")}
        />
        <MetricCard
          label={tr("Catalog Readiness")}
          value={tr("Products")}
          icon={Package}
          helper={tr("Keep pricing, lead times, and availability clean.")}
        />
        <MetricCard
          label={tr("RFQ Desk")}
          value={tr("Assigned")}
          icon={FileCheck02}
          tone="warning"
          helper={tr("Respond quickly when client demand reaches your queue.")}
        />
        <MetricCard
          label={tr("Payout Track")}
          value={tr("Finance")}
          icon={BankNote01}
          helper={tr("Follow pending and completed supplier payments.")}
        />
      </div>

      <Panel
        className="mt-6"
        title={tr("Supplier Workspace")}
        description={tr("A practical snapshot of the work that keeps your marketplace presence healthy.")}
        icon={CheckCircle}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <SignalCard
            label={tr("Readiness")}
            value={tr("Profile, products, and payouts")}
            helper={tr("Keep the basics sharp so MWRD can match you faster.")}
            tone="success"
            icon={ShieldTick}
          />
          <SignalCard
            label={tr("Response posture")}
            value={tr("Fast quotes win attention")}
            helper={tr("Open assigned RFQs before price and stock details age out.")}
            tone="info"
            icon={FileCheck02}
          />
          <SignalCard
            label={tr("Service signal")}
            value={tr("Ratings, delivery, and disputes")}
            helper={tr("Use reviews and performance data to protect your supplier score.")}
            tone="brand"
            icon={Star01}
          />
        </div>
      </Panel>

      <Panel className="mt-6" title={tr("Supplier RFQ Flow")} description={tr("How anonymized client demand moves through your supplier workspace.")}>
        <div className="grid gap-3 md:grid-cols-5">
          {[
            { label: tr("Assigned"), value: tr("RFQ arrives"), icon: FileCheck02 },
            { label: tr("Quote"), value: tr("Price and terms"), icon: Receipt },
            { label: tr("PO"), value: tr("MWRD dispatch"), icon: PackageCheck },
            { label: tr("Delivery"), value: tr("Status and GRN"), icon: CheckCircle },
            { label: tr("Payout"), value: tr("Finance queue"), icon: BankNote01 },
          ].map((step, index) => (
            <FlowStepCard
              key={step.label}
              label={step.label}
              value={step.value}
              icon={step.icon}
              index={index}
              tone={index === 0 ? "success" : index === 1 ? "brand" : "neutral"}
            />
          ))}
        </div>
      </Panel>

      <Panel className="mt-6" title={tr("Supplier Actions")} description={tr("Keep your marketplace readiness and RFQ response work moving.")}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <LinkCard
            title={tr("My Products")}
            description={tr("Manage product listings, prices, lead times, and approval submissions.")}
            href="/supplier/products"
            icon={Package}
            meta={tr("Catalog control")}
          />
          <LinkCard
            title={tr("Assigned RFQs")}
            description={tr("Review client requests assigned to your company and submit quotes.")}
            href="/supplier/rfqs"
            icon={FileCheck02}
            meta={tr("Quote response")}
          />
          <LinkCard
            title={tr("Payouts")}
            description={tr("Track pending and completed supplier payments from MWRD.")}
            href="/supplier/payouts"
            icon={BankNote01}
            meta={tr("Finance")}
          />
          <LinkCard
            title={tr("Reviews")}
            description={tr("See client feedback and service ratings for your performance.")}
            href="/supplier/reviews"
            icon={Star01}
            meta={tr("Reputation")}
          />
        </div>
      </Panel>
    </SupplierLayout>
  );
};

export default SupplierDashboard;

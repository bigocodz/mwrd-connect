import SupplierLayout from "@/components/supplier/SupplierLayout";
import { useAuth } from "@/hooks/useAuth";
import { LinkCard, MetricCard, PageHeader, Panel } from "@/components/app/AppSurface";
import { BankNote01, CheckCircle, FileCheck02, Package, ShieldTick, Star01 } from "@untitledui/icons";
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
          <div className="rounded-lg bg-[#f7f8f7] p-4 shadow-[inset_0_0_0_1px_rgba(190,184,174,0.36)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-[#6c6f6c]">{tr("Readiness")}</p>
              <span className="rounded-full bg-[#e7f8f2] px-2 py-1 text-xs font-semibold text-[#246b55]">{tr("LIVE")}</span>
            </div>
            <p className="text-lg font-semibold text-[#1a1a1a]">{tr("Profile, products, and payouts")}</p>
            <p className="mt-1 text-sm leading-relaxed text-[#5f625f]">{tr("Keep the basics sharp so MWRD can match you faster.")}</p>
          </div>
          <div className="rounded-lg bg-[#eef7f8] p-4 shadow-[inset_0_0_0_1px_rgba(117,218,234,0.38)]">
            <p className="text-xs font-semibold text-[#6c6f6c]">{tr("Response posture")}</p>
            <p className="mt-2 text-lg font-semibold text-[#1a1a1a]">{tr("Fast quotes win attention")}</p>
            <p className="mt-1 text-sm leading-relaxed text-[#5f625f]">{tr("Open assigned RFQs before price and stock details age out.")}</p>
          </div>
          <div className="rounded-lg bg-[#fff1eb] p-4 shadow-[inset_0_0_0_1px_rgba(255,109,67,0.2)]">
            <p className="text-xs font-semibold text-[#6c6f6c]">{tr("Service signal")}</p>
            <p className="mt-2 text-lg font-semibold text-[#1a1a1a]">{tr("Ratings, delivery, and disputes")}</p>
            <p className="mt-1 text-sm leading-relaxed text-[#5f625f]">{tr("Use reviews and performance data to protect your supplier score.")}</p>
          </div>
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

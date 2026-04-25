import SupplierLayout from "@/components/supplier/SupplierLayout";
import { useAuth } from "@/hooks/useAuth";
import { LinkCard, PageHeader, Panel } from "@/components/app/AppSurface";
import { BankNote01, FileCheck02, Package, Star01 } from "@untitledui/icons";
import { useLanguage } from "@/contexts/LanguageContext";

const SupplierDashboard = () => {
  const { profile } = useAuth();
  const { tr } = useLanguage();
  const welcomeLine = profile?.company_name ? tr("Welcome, {company}.", { company: profile.company_name }) : tr("Welcome.");

  return (
    <SupplierLayout>
      <PageHeader
        title={tr("Supplier Dashboard")}
        description={`${welcomeLine} ${tr("Manage your catalog, RFQs, and commercial activity from one workspace.")}`}
      />

      <Panel title={tr("Supplier Actions")} description={tr("Keep your marketplace readiness and RFQ response work moving.")}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <LinkCard
            title={tr("My Products")}
            description={tr("Manage product listings, prices, lead times, and approval submissions.")}
            href="/supplier/products"
            icon={Package}
          />
          <LinkCard
            title={tr("Assigned RFQs")}
            description={tr("Review client requests assigned to your company and submit quotes.")}
            href="/supplier/rfqs"
            icon={FileCheck02}
          />
          <LinkCard
            title={tr("Payouts")}
            description={tr("Track pending and completed supplier payments from MWRD.")}
            href="/supplier/payouts"
            icon={BankNote01}
          />
          <LinkCard
            title={tr("Reviews")}
            description={tr("See client feedback and service ratings for your performance.")}
            href="/supplier/reviews"
            icon={Star01}
          />
        </div>
      </Panel>
    </SupplierLayout>
  );
};

export default SupplierDashboard;

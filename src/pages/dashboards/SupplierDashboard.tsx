import SupplierLayout from "@/components/supplier/SupplierLayout";
import { useAuth } from "@/hooks/useAuth";
import { LinkCard, PageHeader, Panel } from "@/components/app/AppSurface";
import { BankNote01, FileCheck02, Package, Star01 } from "@untitledui/icons";

const SupplierDashboard = () => {
  const { profile } = useAuth();

  return (
    <SupplierLayout>
      <PageHeader
        title="Supplier Dashboard"
        description={`Welcome${profile?.company_name ? `, ${profile.company_name}` : ""}. Manage your catalog, RFQs, and commercial activity from one workspace.`}
      />

      <Panel title="Supplier Actions" description="Keep your marketplace readiness and RFQ response work moving.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <LinkCard
            title="My Products"
            description="Manage product listings, prices, lead times, and approval submissions."
            href="/supplier/products"
            icon={Package}
          />
          <LinkCard
            title="Assigned RFQs"
            description="Review client requests assigned to your company and submit quotes."
            href="/supplier/rfqs"
            icon={FileCheck02}
          />
          <LinkCard
            title="Payouts"
            description="Track pending and completed supplier payments from MWRD."
            href="/supplier/payouts"
            icon={BankNote01}
          />
          <LinkCard
            title="Reviews"
            description="See client feedback and service ratings for your performance."
            href="/supplier/reviews"
            icon={Star01}
          />
        </div>
      </Panel>
    </SupplierLayout>
  );
};

export default SupplierDashboard;

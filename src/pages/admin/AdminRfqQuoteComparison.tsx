import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { QuoteComparisonView } from "@/components/rfqs/QuoteComparisonView";
import { useLanguage } from "@/contexts/LanguageContext";

const AdminRfqQuoteComparison = () => {
  const { tr } = useLanguage();
  const { rfqId } = useParams();
  const comparison = useQuery(api.quotes.compareForAdmin, rfqId ? { rfq_id: rfqId as any } : "skip");

  if (comparison === undefined) {
    return <AdminLayout><div className="py-20 text-center text-muted-foreground">{tr("Loading…")}</div></AdminLayout>;
  }

  if (!comparison) {
    return <AdminLayout><div className="py-20 text-center text-muted-foreground">{tr("RFQ comparison not found.")}</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <QuoteComparisonView comparison={comparison} mode="admin" backHref="/admin/rfqs" />
    </AdminLayout>
  );
};

export default AdminRfqQuoteComparison;

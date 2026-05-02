import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Id } from "@cvx/dataModel";
import ClientLayout from "@/components/client/ClientLayout";
import { QuoteComparisonView } from "@/components/rfqs/QuoteComparisonView";
import { AwardPanel } from "@/components/rfqs/AwardPanel";
import { useLanguage } from "@/contexts/LanguageContext";

const ClientQuoteComparison = () => {
  const { tr } = useLanguage();
  const { rfqId } = useParams();
  const comparison = useQuery(api.quotes.compareForClient, rfqId ? { rfq_id: rfqId as any } : "skip");

  if (comparison === undefined) {
    return <ClientLayout><div className="py-20 text-center text-muted-foreground">{tr("Loading…")}</div></ClientLayout>;
  }

  if (!comparison) {
    return <ClientLayout><div className="py-20 text-center text-muted-foreground">{tr("RFQ comparison not found.")}</div></ClientLayout>;
  }

  return (
    <ClientLayout>
      <div className="space-y-6">
        <QuoteComparisonView comparison={comparison} mode="client" backHref={`/client/rfqs/${rfqId}`} />
        <AwardPanel comparison={comparison} rfqId={rfqId as Id<"rfqs">} />
      </div>
    </ClientLayout>
  );
};

export default ClientQuoteComparison;

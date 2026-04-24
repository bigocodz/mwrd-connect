import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import ClientLayout from "@/components/client/ClientLayout";
import { QuoteComparisonView } from "@/components/rfqs/QuoteComparisonView";

const ClientQuoteComparison = () => {
  const { rfqId } = useParams();
  const comparison = useQuery(api.quotes.compareForClient, rfqId ? { rfq_id: rfqId as any } : "skip");

  if (comparison === undefined) {
    return <ClientLayout><div className="py-20 text-center text-muted-foreground">Loading…</div></ClientLayout>;
  }

  if (!comparison) {
    return <ClientLayout><div className="py-20 text-center text-muted-foreground">RFQ comparison not found.</div></ClientLayout>;
  }

  return (
    <ClientLayout>
      <QuoteComparisonView comparison={comparison} mode="client" backHref={`/client/rfqs/${rfqId}`} />
    </ClientLayout>
  );
};

export default ClientQuoteComparison;

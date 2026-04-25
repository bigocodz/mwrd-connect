import { useParams, Link } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { OrderDetailView } from "@/components/orders/OrderDetailView";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const ClientOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { tr, dir } = useLanguage();
  return (
    <ClientLayout>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/client/orders" className="inline-flex items-center gap-2">
            {dir === "rtl" ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            {tr("Back to orders")}
          </Link>
        </Button>
        {orderId && <OrderDetailView orderId={orderId} role="CLIENT" />}
      </div>
    </ClientLayout>
  );
};

export default ClientOrderDetail;

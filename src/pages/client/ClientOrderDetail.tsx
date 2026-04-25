import { useParams, Link } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { OrderDetailView } from "@/components/orders/OrderDetailView";

const ClientOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  return (
    <ClientLayout>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/client/orders">← Back to orders</Link>
        </Button>
        {orderId && <OrderDetailView orderId={orderId} role="CLIENT" />}
      </div>
    </ClientLayout>
  );
};

export default ClientOrderDetail;

import { useParams, Link } from "react-router-dom";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Button } from "@/components/ui/button";
import { OrderDetailView } from "@/components/orders/OrderDetailView";

const SupplierOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  return (
    <SupplierLayout>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/supplier/orders">← Back to orders</Link>
        </Button>
        {orderId && <OrderDetailView orderId={orderId} role="SUPPLIER" />}
      </div>
    </SupplierLayout>
  );
};

export default SupplierOrderDetail;

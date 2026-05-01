import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { OrderDetailView } from "@/components/orders/OrderDetailView";
import { useLanguage } from "@/contexts/LanguageContext";

const AdminOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { tr } = useLanguage();
  return (
    <AdminLayout>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/orders">← {tr("Back to orders")}</Link>
        </Button>
        {orderId && <OrderDetailView orderId={orderId} role="ADMIN" />}
      </div>
    </AdminLayout>
  );
};

export default AdminOrderDetail;

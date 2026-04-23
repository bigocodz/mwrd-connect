import SupplierLayout from "@/components/supplier/SupplierLayout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";

const SupplierDashboard = () => {
  const { profile } = useAuth();

  return (
    <SupplierLayout>
      <h1 className="font-display text-3xl font-bold text-foreground mb-2">Supplier Dashboard</h1>
      <p className="text-muted-foreground mb-6">Welcome, {profile?.company_name}.</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/supplier/products">
          <Card className="hover:border-accent transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3">
              <Package className="w-8 h-8 text-accent" />
              <CardTitle>My Products</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Manage your product listings and submissions</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </SupplierLayout>
  );
};

export default SupplierDashboard;

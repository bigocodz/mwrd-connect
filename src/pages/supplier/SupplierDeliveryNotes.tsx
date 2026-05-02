import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, FileText, Plus } from "lucide-react";

const SupplierDeliveryNotes = () => {
  const { tr } = useLanguage();
  const data = useQuery(api.deliveryNotes.listMineSupplier);
  const rows = data ?? [];
  const loading = data === undefined;

  return (
    <SupplierLayout>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="font-display text-3xl font-bold text-foreground">
          {tr("Delivery Notes")}
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>{tr("No delivery notes yet.")}</p>
            <p className="text-sm mt-1">
              {tr("Issue a delivery note from any confirmed order.")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((d: any) => (
            <Card key={d._id}>
              <CardContent className="pt-6 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <p className="font-mono text-sm font-medium">{d.dn_number}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr("Client")} {d.client_public_id}
                    {d.carrier ? ` · ${d.carrier}` : ""}
                    {d.tracking_number ? ` · ${d.tracking_number}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr("Issued")}{" "}
                    {new Date(d.issued_at).toLocaleString()}
                  </p>
                </div>
                <Badge
                  variant={
                    d.status === "ISSUED"
                      ? "default"
                      : d.status === "CANCELLED"
                      ? "destructive"
                      : "outline"
                  }
                >
                  {d.status}
                </Badge>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/supplier/orders/${d.order_id}`}>
                    {tr("View order")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </SupplierLayout>
  );
};

export default SupplierDeliveryNotes;

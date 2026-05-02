import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, FileText } from "lucide-react";

type Tab = "ALL" | "DRAFT" | "ISSUED" | "CANCELLED";

const AdminDeliveryNotes = () => {
  const { tr } = useLanguage();
  const [tab, setTab] = useState<Tab>("ALL");
  const data = useQuery(
    api.deliveryNotes.adminListAll,
    tab === "ALL" ? {} : { status: tab },
  );
  const rows = data ?? [];
  const loading = data === undefined;

  return (
    <AdminLayout>
      <h1 className="font-display text-3xl font-bold text-foreground mb-6">
        {tr("Delivery Notes")}
      </h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="ALL">{tr("All")}</TabsTrigger>
          <TabsTrigger value="DRAFT">{tr("Draft")}</TabsTrigger>
          <TabsTrigger value="ISSUED">{tr("Issued")}</TabsTrigger>
          <TabsTrigger value="CANCELLED">{tr("Cancelled")}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>{tr("No delivery notes.")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rows.map((d: any) => (
                <Card key={d._id}>
                  <CardContent className="pt-6 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[260px]">
                      <p className="font-mono text-sm font-medium">
                        {d.dn_number}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tr("Supplier")}{" "}
                        <span className="font-mono">
                          {d.supplier_public_id}
                        </span>
                        {" → "}
                        {tr("Client")}{" "}
                        <span className="font-mono">{d.client_public_id}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tr("Issued")}{" "}
                        {new Date(d.issued_at).toLocaleString()}
                        {d.carrier ? ` · ${d.carrier}` : ""}
                        {d.tracking_number ? ` · ${d.tracking_number}` : ""}
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
                      <Link to={`/admin/orders/${d.order_id}`}>
                        {tr("View order")}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminDeliveryNotes;

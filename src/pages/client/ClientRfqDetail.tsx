import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import ClientLayout from "@/components/client/ClientLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

const flexLabel: Record<string, string> = {
  EXACT_MATCH: "Exact Match",
  OPEN_TO_EQUIVALENT: "Open to Equivalent",
  OPEN_TO_ALTERNATIVES: "Open to Alternatives",
};

const ClientRfqDetail = () => {
  const { rfqId } = useParams();
  const rfqData = useQuery(api.rfqs.getById, rfqId ? { id: rfqId as any } : "skip");
  const loading = rfqData === undefined;

  if (loading) {
    return <ClientLayout><div className="text-muted-foreground text-center py-20">Loading…</div></ClientLayout>;
  }

  if (!rfqData) {
    return (
      <ClientLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">RFQ not found.</p>
          <Button variant="link" asChild><Link to="/client/rfqs">Back to RFQs</Link></Button>
        </div>
      </ClientLayout>
    );
  }

  const items = rfqData.items ?? [];

  return (
    <ClientLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/client/rfqs"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              RFQ <span className="font-mono text-base text-muted-foreground">{rfqId?.slice(0, 8)}</span>
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline">{rfqData.status}</Badge>
              <span className="text-sm text-muted-foreground">
                Created {new Date(rfqData._creationTime).toLocaleDateString()}
              </span>
              {rfqData.expiry_date && (
                <span className="text-sm text-muted-foreground">
                  Expires {new Date(rfqData.expiry_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {rfqData.notes && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{rfqData.notes}</p></CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Items ({items.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product / Description</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Flexibility</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium">
                      {item.product
                        ? `${item.product.name} (${item.product.category})`
                        : item.custom_item_description || "—"}
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {flexLabel[item.flexibility] || item.flexibility}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.special_notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientRfqDetail;

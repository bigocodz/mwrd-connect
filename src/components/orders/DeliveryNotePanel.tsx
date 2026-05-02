import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Id } from "@cvx/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Truck01 } from "@untitledui/icons";

type Role = "CLIENT" | "SUPPLIER" | "ADMIN" | "AUDITOR";

interface DeliveryNotePanelProps {
  orderId: Id<"orders">;
  orderStatus: string;
  role: Role;
}

/**
 * Side-by-side with GrnPanel: shows supplier-issued delivery notes for an
 * order. Suppliers get a "New delivery note" CTA when the order is in a
 * shippable state. Read-only for everyone else.
 */
export const DeliveryNotePanel = ({
  orderId,
  orderStatus,
  role,
}: DeliveryNotePanelProps) => {
  const { tr } = useLanguage();
  const dns = useQuery(api.deliveryNotes.listForOrder, { order_id: orderId }) as
    | any[]
    | undefined;

  const canIssue =
    role === "SUPPLIER" &&
    (orderStatus === "CONFIRMED" ||
      orderStatus === "PREPARING" ||
      orderStatus === "DISPATCHED");

  const loading = dns === undefined;
  const rows = dns ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Truck01 className="h-4 w-4" />
          {tr("Delivery notes")}
        </CardTitle>
        {canIssue && (
          <Button size="sm" asChild>
            <Link to={`/supplier/delivery-notes/new?order=${orderId}`}>
              <Plus className="h-4 w-4 me-1.5" />
              {tr("New delivery note")}
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{tr("Loading…")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tr("No delivery notes yet.")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr("Number")}</TableHead>
                <TableHead>{tr("Status")}</TableHead>
                <TableHead>{tr("Issued")}</TableHead>
                <TableHead>{tr("Carrier / Tracking")}</TableHead>
                <TableHead>{tr("Lines")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d._id}>
                  <TableCell className="font-mono">{d.dn_number}</TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    {new Date(d.issued_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {d.carrier || "—"}
                    {d.tracking_number ? ` · ${d.tracking_number}` : ""}
                  </TableCell>
                  <TableCell>{d.lines?.length ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

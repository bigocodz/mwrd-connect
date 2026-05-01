import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const AdminPendingQuotes = () => {
  const { tr } = useLanguage();
  const quotesData = useQuery(api.quotes.listPending);
  const loading = quotesData === undefined;
  const quotes = quotesData ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("Pending Quotes")}</h1>
          <p className="text-muted-foreground mt-1">{tr("Review supplier quotes before sending to clients.")}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : quotes.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{tr("No pending quotes to review.")}</p>
            </CardContent>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr("Quote ID")}</TableHead>
                <TableHead>{tr("Supplier")}</TableHead>
                <TableHead>{tr("Status")}</TableHead>
                <TableHead>{tr("RFQ")}</TableHead>
                <TableHead>{tr("Items")}</TableHead>
                <TableHead>{tr("Submitted")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q._id}>
                  <TableCell className="font-mono text-xs">{q._id.slice(0, 8)}…</TableCell>
                  <TableCell className="font-medium">{(q as any).supplier_public_id}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{q.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{q.rfq_id.slice(0, 8)}…</TableCell>
                  <TableCell>{(q as any).items_count}</TableCell>
                  <TableCell className="text-sm">{new Date(q._creationTime).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="default" size="sm" asChild>
                      <Link to={`/admin/quotes/${q._id}/review`}>{tr("Review")}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPendingQuotes;

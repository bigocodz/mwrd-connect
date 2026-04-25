import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import ClientLayout from "@/components/client/ClientLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowRight, ExternalLink, GitCompare } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const flexLabel: Record<string, string> = {
  EXACT_MATCH: "Exact Match",
  OPEN_TO_EQUIVALENT: "Open to Equivalent",
  OPEN_TO_ALTERNATIVES: "Open to Alternatives",
};

const documentLabel: Record<string, string> = {
  SPECIFICATION: "Specification",
  PURCHASE_POLICY: "Purchase Policy",
  SUPPORTING_DOCUMENT: "Supporting Document",
  SUPPLIER_QUOTATION: "Supplier Quotation",
  COMMERCIAL_TERMS: "Commercial Terms",
  OTHER: "Other",
};

const ClientRfqDetail = () => {
  const { tr, lang, dir } = useLanguage();
  const { rfqId } = useParams();
  const rfqData = useQuery(api.rfqs.getById, rfqId ? { id: rfqId as any } : "skip");
  const loading = rfqData === undefined;

  if (loading) {
    return <ClientLayout><div className="text-muted-foreground text-center py-20">{tr("Loading…")}</div></ClientLayout>;
  }

  if (!rfqData) {
    return (
      <ClientLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">{tr("RFQ not found.")}</p>
          <Button variant="link" asChild><Link to="/client/rfqs">{tr("Back to RFQs")}</Link></Button>
        </div>
      </ClientLayout>
    );
  }

  const items = rfqData.items ?? [];
  const attachments = rfqData.attachments ?? [];

  return (
    <ClientLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/client/rfqs">{dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                RFQ <span className="font-mono text-base text-muted-foreground">{rfqId?.slice(0, 8)}</span>
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <Badge variant="outline">{tr(rfqData.status)}</Badge>
                <span className="text-sm text-muted-foreground">
                  {tr("Created")} {new Date(rfqData._creationTime).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA")}
                </span>
                {rfqData.expiry_date && (
                  <span className="text-sm text-muted-foreground">
                    {tr("Expires")} {new Date(rfqData.expiry_date).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA")}
                  </span>
                )}
              </div>
            </div>
          </div>
          {(rfqData.quotes_count ?? 0) > 0 && (
            <Button asChild>
              <Link to={`/client/rfqs/${rfqId}/compare`}>
                <GitCompare className="me-2 h-4 w-4" />
                {tr("Compare Quotes")}
              </Link>
            </Button>
          )}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">{tr("RFQ controls")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-4">
            <div>
              <p className="text-muted-foreground">{tr("Category")}</p>
              <p className="font-medium">{rfqData.category || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{tr("Required by")}</p>
              <p className="font-medium">{rfqData.required_by ? new Date(rfqData.required_by).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA") : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{tr("Delivery")}</p>
              <p className="font-medium">{rfqData.delivery_location || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{tr("Quote options")}</p>
              <p className="font-medium">{rfqData.quotes_count ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{tr("Cost center")}</p>
              <p className="font-medium">
                {rfqData.cost_center ? `${rfqData.cost_center.code} — ${rfqData.cost_center.name}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{tr("Branch")}</p>
              <p className="font-medium">{rfqData.branch?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{tr("Department")}</p>
              <p className="font-medium">{rfqData.department?.name ?? "—"}</p>
            </div>
          </CardContent>
        </Card>

        {rfqData.notes && (
          <Card>
            <CardHeader><CardTitle className="text-sm">{tr("Notes")}</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{rfqData.notes}</p></CardContent>
          </Card>
        )}

        {attachments.length > 0 && (
          <Card>
            <CardHeader><CardTitle>{tr("Documents ({count})", { count: attachments.length })}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {attachments.map((attachment: any) => (
                <div key={attachment._id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <Badge variant="secondary" className="mb-2">{tr(documentLabel[attachment.document_type] || attachment.document_type)}</Badge>
                    <p className="font-medium">{attachment.name}</p>
                    {attachment.notes && <p className="text-sm text-muted-foreground">{attachment.notes}</p>}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={attachment.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="me-2 h-4 w-4" />
                      {tr("Open")}
                    </a>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>{tr("Items ({count})", { count: items.length })}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Product / Description")}</TableHead>
                  <TableHead>{tr("Quantity")}</TableHead>
                  <TableHead>{tr("Flexibility")}</TableHead>
                  <TableHead>{tr("Notes")}</TableHead>
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
                        {tr(flexLabel[item.flexibility] || item.flexibility)}
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

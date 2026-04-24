import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, FileText, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { VatBadge, formatSAR } from "@/components/shared/VatBadge";

const documentLabel: Record<string, string> = {
  SPECIFICATION: "Specification",
  PURCHASE_POLICY: "Purchase Policy",
  SUPPORTING_DOCUMENT: "Supporting Document",
  SUPPLIER_QUOTATION: "Supplier Quotation",
  COMMERCIAL_TERMS: "Commercial Terms",
  OTHER: "Other",
};

const itemName = (item: any) =>
  item.product ? `${item.product.name} (${item.product.category})` : item.custom_item_description || "Custom item";

const quoteItemName = (item: any) =>
  item.rfq_item?.product?.name || item.rfq_item?.custom_item_description || item.supplier_product?.name || "Item";

interface QuoteComparisonViewProps {
  comparison: any;
  mode: "client" | "admin";
  backHref: string;
}

export const QuoteComparisonView = ({ comparison, mode, backHref }: QuoteComparisonViewProps) => {
  const rfq = comparison.rfq;
  const quotes = comparison.quotes ?? [];
  const items = comparison.items ?? [];
  const attachments = comparison.attachments ?? [];
  const bestQuote = quotes.find((quote: any) => quote._id === comparison.best_quote_id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={backHref}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Quote Comparison</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>RFQ <span className="font-mono">{rfq._id.slice(0, 8)}</span></span>
              <Badge variant="outline">{rfq.status}</Badge>
              <span>{items.length} items</span>
              <span>{quotes.length} quotes</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Client</p>
            <p className="mt-1 font-semibold">{rfq.client_company_name || rfq.client_public_id}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Category</p>
            <p className="mt-1 font-semibold">{rfq.category || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Required by</p>
            <p className="mt-1 font-semibold">{rfq.required_by ? new Date(rfq.required_by).toLocaleDateString() : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Best score</p>
            <p className="mt-1 font-semibold">{bestQuote ? `${bestQuote.score}/100` : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState icon="quotes" title="No comparable quotes yet" description="Quotes will appear here once they are available for comparison." />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {quotes.map((quote: any, index: number) => {
              const total = quote.totalWithVat || quote.totalCost;
              const isBest = quote._id === comparison.best_quote_id;
              return (
                <Card key={quote._id} className={isBest ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary))]" : undefined}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{quote.supplier_company_name || quote.supplier_public_id}</CardTitle>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">{quote._id.slice(0, 8)}…</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {isBest && <Badge><Trophy className="mr-1 h-3 w-3" /> Best</Badge>}
                        <Badge variant="outline">Score {quote.score}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total <VatBadge /></p>
                        <p className="font-semibold">{total > 0 ? formatSAR(total) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Coverage</p>
                        <p className="font-semibold">{quote.coverage}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Lead</p>
                        <p className="font-semibold">{quote.avgLeadTime ? `${quote.avgLeadTime} days` : "—"}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Rank {index + 1}</Badge>
                      <Badge variant="outline">{quote.status.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline">{quote.quotedCount}/{items.length} items</Badge>
                    </div>
                    {quote.supplier_notes && <p className="text-sm text-muted-foreground">{quote.supplier_notes}</p>}
                    {quote.attachments?.length > 0 && (
                      <div className="space-y-2">
                        {quote.attachments.map((attachment: any) => (
                          <Button key={attachment._id} variant="outline" size="sm" asChild>
                            <a href={attachment.url} target="_blank" rel="noreferrer">
                              <FileText className="mr-2 h-4 w-4" />
                              {attachment.name}
                              <ExternalLink className="ml-2 h-3 w-3" />
                            </a>
                          </Button>
                        ))}
                      </div>
                    )}
                    {mode === "admin" && quote.status === "PENDING_ADMIN" && (
                      <Button className="w-full" asChild>
                        <Link to={`/admin/quotes/${quote._id}/review`}>Review Quote</Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Side-by-side item matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-56">Requested item</TableHead>
                    {quotes.map((quote: any) => (
                      <TableHead key={quote._id} className="min-w-48">
                        {quote.supplier_company_name || quote.supplier_public_id}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => (
                    <TableRow key={item._id}>
                      <TableCell>
                        <p className="font-medium">{itemName(item)}</p>
                        <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                      </TableCell>
                      {quotes.map((quote: any) => {
                        const quoteItem = quote.items?.find((candidate: any) => candidate.rfq_item_id === item._id);
                        if (!quoteItem?.is_quoted) {
                          return (
                            <TableCell key={quote._id}>
                              <Badge variant="destructive">Unavailable</Badge>
                            </TableCell>
                          );
                        }
                        const unitPrice = quoteItem.final_price_with_vat ?? quoteItem.cost_price ?? 0;
                        return (
                          <TableCell key={quote._id}>
                            <p className="font-semibold">{formatSAR(unitPrice)}</p>
                            <p className="text-xs text-muted-foreground">
                              {quoteItem.final_price_with_vat ? "Final price" : "Supplier cost"} · {quoteItem.lead_time_days || "—"} days
                            </p>
                            {quoteItem.alternative_product && (
                              <p className="mt-1 text-xs text-primary">Alt: {quoteItem.alternative_product.name}</p>
                            )}
                            <p className="sr-only">{quoteItemName(quoteItem)}</p>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {attachments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>RFQ documents</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {attachments.map((attachment: any) => (
              <Button key={attachment._id} variant="outline" size="sm" asChild>
                <a href={attachment.url} target="_blank" rel="noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  {documentLabel[attachment.document_type] || attachment.document_type}: {attachment.name}
                  <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

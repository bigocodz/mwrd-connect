import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { VatBadge, formatSAR } from "@/components/shared/VatBadge";

const statusColor: Record<string, string> = {
  SENT_TO_CLIENT: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const ClientQuotes = () => {
  const quotesData = useQuery(api.quotes.listMine);
  const loading = quotesData === undefined;
  const quotes = quotesData ?? [];
  const respond = useMutation(api.quotes.respond);

  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const { page, setPage, totalPages, paginated, total } = usePagination(quotes);

  const detailData = useQuery(
    api.quotes.getById,
    selectedQuoteId ? { id: selectedQuoteId as any } : "skip",
  );
  const quoteItems = detailData?.items ?? [];
  const selectedQuote = quotes.find((q: any) => q._id === selectedQuoteId);

  const openDetail = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setDetailOpen(true);
  };

  const handleAction = async (status: "ACCEPTED" | "REJECTED") => {
    if (!selectedQuoteId) return;
    setActing(true);
    try {
      await respond({ id: selectedQuoteId as any, status });
      toast.success(status === "ACCEPTED" ? "Quote accepted!" : "Quote rejected");
      setDetailOpen(false);
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">My Quotes</h1>
          <p className="text-muted-foreground mt-1">Review quotes sent to you by MWRD.</p>
        </div>

        {loading ? <TableSkeleton rows={5} cols={5} /> : quotes.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="quotes" title="No quotes available yet" description="When MWRD prepares a quote for your RFQ, it will appear here." />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((q: any) => (
                  <TableRow key={q._id}>
                    <TableCell className="font-mono text-xs">{q._id.slice(0, 8)}…</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor[q.status] || ""}>{q.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>{q.items_count}</TableCell>
                    <TableCell className="text-sm">
                      {q.reviewed_at ? new Date(q.reviewed_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(q._id)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Quote <span className="font-mono text-muted-foreground">{selectedQuoteId?.slice(0, 8)}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Lead Time</TableHead>
                  <TableHead>Price <VatBadge className="ml-1" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quoteItems.map((item: any) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium">
                      {item.is_quoted ? (
                        item.rfq_item?.product?.name || item.rfq_item?.custom_item_description || "Item"
                      ) : (
                        <span className="text-muted-foreground line-through">
                          {item.rfq_item?.product?.name || item.rfq_item?.custom_item_description || "Item"}
                          <Badge variant="destructive" className="ml-2 text-xs">Unavailable</Badge>
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{item.rfq_item?.quantity}</TableCell>
                    <TableCell>{item.is_quoted ? `${item.lead_time_days} days` : "—"}</TableCell>
                    <TableCell className="font-bold">
                      {item.is_quoted ? formatSAR(item.final_price_with_vat) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {quoteItems.length > 0 && (
            <div className="text-right border-t pt-3">
              <p className="text-sm text-muted-foreground flex items-center justify-end gap-2">Total <VatBadge /></p>
              <p className="text-xl font-bold text-primary">
                {formatSAR(
                  quoteItems
                    .filter((i: any) => i.is_quoted)
                    .reduce((sum: number, i: any) => sum + (i.final_price_with_vat ?? 0) * (i.rfq_item?.quantity || 1), 0)
                )}
              </p>
            </div>
          )}
          {selectedQuote?.status === "SENT_TO_CLIENT" && (
            <DialogFooter className="gap-2">
              <Button variant="destructive" onClick={() => handleAction("REJECTED")} disabled={acting}>
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </Button>
              <Button onClick={() => handleAction("ACCEPTED")} disabled={acting}>
                <CheckCircle className="w-4 h-4 mr-2" /> Accept Quote
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientQuotes;

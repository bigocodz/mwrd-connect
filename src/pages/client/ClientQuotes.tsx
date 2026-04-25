import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, MessageSquare, XCircle } from "lucide-react";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { VatBadge, formatSAR } from "@/components/shared/VatBadge";
import { useLanguage } from "@/contexts/LanguageContext";

const statusColor: Record<string, string> = {
  SENT_TO_CLIENT: "bg-blue-100 text-blue-800",
  CLIENT_REVISION_REQUESTED: "bg-amber-100 text-amber-800",
  SUPPLIER_REVISION_REQUESTED: "bg-amber-100 text-amber-800",
  REVISION_SUBMITTED: "bg-purple-100 text-purple-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const ClientQuotes = () => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";
  const fmtNumber = (n: number) => new Intl.NumberFormat(locale).format(n);
  const fmtCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "SAR" }).format(amount);

  const statusLabel = (status: string) => {
    if (lang === "ar") return tr(status);
    return status
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const quotesData = useQuery(api.quotes.listMine);
  const approvalRequests = useQuery(api.approvals.listMyRequests) ?? [];
  const loading = quotesData === undefined;
  const quotes = quotesData ?? [];
  const pendingApprovals = approvalRequests.filter((r: any) => r.status === "PENDING");
  const respond = useMutation(api.quotes.respond);
  const requestRevision = useMutation(api.quotes.requestClientRevision);

  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [revisionMessage, setRevisionMessage] = useState("");
  const { page, setPage, totalPages, paginated, total } = usePagination(quotes);

  const detailData = useQuery(
    api.quotes.getById,
    selectedQuoteId ? { id: selectedQuoteId as any } : "skip",
  );
  const quoteItems = detailData?.items ?? [];
  const selectedQuote = quotes.find((q: any) => q._id === selectedQuoteId);
  const revisionEvents = detailData?.revision_events ?? [];

  const openDetail = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setRevisionMessage("");
    setDetailOpen(true);
  };

  const handleAction = async (status: "ACCEPTED" | "REJECTED") => {
    if (!selectedQuoteId) return;
    setActing(true);
    try {
      await respond({ id: selectedQuoteId as any, status });
      toast.success(status === "ACCEPTED" ? tr("Quote accepted!") : tr("Quote rejected"));
      setDetailOpen(false);
    } catch (err: any) {
      toast.error(tr("Error: {message}", { message: err.message }));
    } finally {
      setActing(false);
    }
  };

  const handleRevisionRequest = async () => {
    if (!selectedQuoteId || !revisionMessage.trim()) {
      toast.error(tr("Add revision notes for MWRD"));
      return;
    }
    setActing(true);
    try {
      await requestRevision({ id: selectedQuoteId as any, message: revisionMessage.trim() });
      toast.success(tr("Revision request sent to MWRD"));
      setRevisionMessage("");
      setDetailOpen(false);
    } catch (err: any) {
      toast.error(tr("Error: {message}", { message: err.message }));
    } finally {
      setActing(false);
    }
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("My Quotes")}</h1>
          <p className="text-muted-foreground mt-1">{tr("Review quotes sent to you by MWRD.")}</p>
        </div>

        {pendingApprovals.length > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4">
              <p className="font-medium text-amber-900">
                {tr("{count} accepted quotes awaiting approval", { count: fmtNumber(pendingApprovals.length) })}
              </p>
              <p className="text-sm text-amber-800 mt-1">
                {tr("Acceptance triggered an approval rule. Order creation is paused until MWRD approves.")}
              </p>
              <ul className="mt-2 text-sm text-amber-900 space-y-1">
                {pendingApprovals.map((r: any) => (
                  <li key={r._id}>
                    <span className="font-medium">{r.rule_name}</span> — {fmtCurrency(r.quote_total)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {loading ? <TableSkeleton rows={5} cols={5} /> : quotes.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="quotes" title={tr("No quotes available yet")} description={tr("When MWRD prepares a quote for your RFQ, it will appear here.")} />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Quote ID")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                  <TableHead>{tr("Items")}</TableHead>
                  <TableHead>{tr("Received")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((q: any) => (
                  <TableRow key={q._id}>
                    <TableCell className="font-mono text-xs">{q._id.slice(0, 8)}…</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor[q.status] || ""}>{statusLabel(q.status)}</Badge>
                    </TableCell>
                    <TableCell>{q.items_count}</TableCell>
                    <TableCell className="text-sm">
                      {q.reviewed_at ? new Date(q.reviewed_at).toLocaleDateString(locale) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(q._id)}>{tr("View")}</Button>
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
              {tr("Quote")} <span className="font-mono text-muted-foreground">{selectedQuoteId?.slice(0, 8)}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Item")}</TableHead>
                  <TableHead>{tr("Qty")}</TableHead>
                  <TableHead>{tr("Lead Time")}</TableHead>
                  <TableHead>{tr("Price")} <VatBadge className="ms-1" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quoteItems.map((item: any) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium">
                      {item.is_quoted ? (
                        item.rfq_item?.product?.name || item.rfq_item?.custom_item_description || tr("Item")
                      ) : (
                        <span className="text-muted-foreground line-through">
                          {item.rfq_item?.product?.name || item.rfq_item?.custom_item_description || tr("Item")}
                          <Badge variant="destructive" className="ms-2 text-xs">{tr("Unavailable")}</Badge>
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{item.rfq_item?.quantity}</TableCell>
                    <TableCell>{item.is_quoted ? tr("{days} days", { days: fmtNumber(item.lead_time_days) }) : "—"}</TableCell>
                    <TableCell className="font-bold">
                      {item.is_quoted ? formatSAR(item.final_price_with_vat) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {quoteItems.length > 0 && (
            <div className="text-end border-t pt-3">
              <p className="text-sm text-muted-foreground flex items-center justify-end gap-2">{tr("Total")} <VatBadge /></p>
              <p className="text-xl font-bold text-primary">
                {formatSAR(
                  quoteItems
                    .filter((i: any) => i.is_quoted)
                    .reduce((sum: number, i: any) => sum + (i.final_price_with_vat ?? 0) * (i.rfq_item?.quantity || 1), 0)
                )}
              </p>
            </div>
          )}
          {revisionEvents.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">{tr("Revision history")}</p>
              {revisionEvents.map((event: any) => (
                <div key={event._id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="secondary">{statusLabel(event.actor_role)}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString(locale)}</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">{event.message}</p>
                </div>
              ))}
            </div>
          )}
          {selectedQuote?.status === "SENT_TO_CLIENT" && (
            <>
              <div className="space-y-2 border-t pt-3">
                <Label>{tr("Request Revision")}</Label>
                <Textarea
                  value={revisionMessage}
                  onChange={(e) => setRevisionMessage(e.target.value)}
                  placeholder={tr("Tell MWRD what should change: quantities, delivery date, item substitution, pricing, payment terms…")}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="destructive" onClick={() => handleAction("REJECTED")} disabled={acting}>
                  <XCircle className="w-4 h-4 me-2" /> {tr("Reject")}
                </Button>
                <Button variant="outline" onClick={handleRevisionRequest} disabled={acting}>
                  <MessageSquare className="w-4 h-4 me-2" /> {tr("Request Revision")}
                </Button>
                <Button onClick={() => handleAction("ACCEPTED")} disabled={acting}>
                  <CheckCircle className="w-4 h-4 me-2" /> {tr("Accept Quote")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientQuotes;

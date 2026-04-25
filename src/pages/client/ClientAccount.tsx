import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { useAuth } from "@/hooks/useAuth";
import ClientLayout from "@/components/client/ClientLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Wallet, Clock } from "lucide-react";
import { TableSkeleton, CardSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { VatBadge, formatSAR } from "@/components/shared/VatBadge";
import { useLanguage } from "@/contexts/LanguageContext";

const statusColor: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  DISCREPANCY: "bg-red-100 text-red-800",
};

const ClientAccount = () => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";

  const statusLabel = (status: string) => {
    if (lang === "ar") return tr(status);
    return status
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const paymentTermsLabel = (terms?: string | null) => {
    if (!terms) return tr("Prepaid");
    const english = terms.replace(/_/g, " ");
    return tr(english.replace(/\b\w/g, (c) => c.toUpperCase()));
  };

  const { profile } = useAuth();
  const paymentsData = useQuery(api.payments.listMine);
  const loading = paymentsData === undefined;
  const payments = paymentsData ?? [];
  const { page, setPage, totalPages, paginated, total } = usePagination(payments);

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("My Account")}</h1>
          <p className="text-muted-foreground mt-1">{tr("View your credit and payment history.")}</p>
        </div>

        {loading ? <CardSkeleton count={3} /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{tr("Credit Limit")}</p>
                    <p className="text-xl font-bold text-foreground">{formatSAR(Number(profile?.credit_limit || 0))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{tr("Current Balance")}</p>
                    <p className={`text-xl font-bold ${Number(profile?.current_balance || 0) < 0 ? "text-destructive" : "text-foreground"}`}>
                      {formatSAR(Number(profile?.current_balance || 0))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{tr("Payment Terms")}</p>
                    <p className="text-xl font-bold text-foreground capitalize">{paymentTermsLabel(profile?.payment_terms)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>{tr("Payment History")}</CardTitle></CardHeader>
          <CardContent>
            {loading ? <TableSkeleton rows={5} cols={5} /> : payments.length === 0 ? (
              <EmptyState icon="payments" title={tr("No payments yet")} description={tr("Your payment history will appear here.")} />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tr("Date")}</TableHead>
                      <TableHead>{tr("Amount")}</TableHead>
                      <TableHead>{tr("Method")}</TableHead>
                      <TableHead>{tr("Bank Ref.")}</TableHead>
                      <TableHead>{tr("Status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((p: any) => (
                      <TableRow key={p._id}>
                        <TableCell className="text-sm">{new Date(p._creationTime).toLocaleDateString(locale)}</TableCell>
                        <TableCell className="font-medium">
                          {formatSAR(Number(p.amount))} <VatBadge className="ms-1" />
                        </TableCell>
                        <TableCell className="text-xs">{statusLabel(p.payment_method)}</TableCell>
                        <TableCell className="text-xs font-mono">{p.bank_reference || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColor[p.status] || ""}>{statusLabel(p.status)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientAccount;

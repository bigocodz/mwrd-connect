import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Banknote } from "lucide-react";
import { TableSkeleton, CardSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { formatSAR } from "@/components/shared/VatBadge";
import { useLanguage } from "@/contexts/LanguageContext";

const statusColor: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
};

const SupplierPayouts = () => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";
  const fmtNumber = (n: number) => new Intl.NumberFormat(locale).format(n);
  const enumLabel = (value?: string) => {
    if (!value) return "";
    if (lang === "ar") return tr(value);
    return value
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const payoutsData = useQuery(api.payouts.listMine);
  const loading = payoutsData === undefined;
  const payouts = payoutsData ?? [];

  const pending = payouts.filter((p) => p.status === "PENDING");
  const paid = payouts.filter((p) => p.status === "PAID");
  const totalPending = pending.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = paid.reduce((s, p) => s + Number(p.amount), 0);

  const pendingPag = usePagination(pending);
  const paidPag = usePagination(paid);

  const PayoutTable = ({ items, pag, emptyMsg }: { items: any[]; pag: any; emptyMsg: string }) =>
    items.length === 0 ? (
      <EmptyState icon="payouts" title={tr(emptyMsg)} />
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
              <TableHead>{tr("Paid At")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pag.paginated.map((p: any) => (
              <TableRow key={p._id}>
                <TableCell className="text-sm">{new Date(p._creationTime).toLocaleDateString(locale)}</TableCell>
                <TableCell className="font-medium">{formatSAR(Number(p.amount))}</TableCell>
                <TableCell className="text-xs">{enumLabel(p.payment_method)}</TableCell>
                <TableCell className="text-xs font-mono">{p.bank_reference || "—"}</TableCell>
                <TableCell><Badge variant="outline" className={statusColor[p.status] || ""}>{enumLabel(p.status)}</Badge></TableCell>
                <TableCell className="text-sm">{p.paid_at ? new Date(p.paid_at).toLocaleDateString(locale) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls page={pag.page} totalPages={pag.totalPages} total={pag.total} onPageChange={pag.setPage} />
      </>
    );

  return (
    <SupplierLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("My Payouts")}</h1>
          <p className="text-muted-foreground mt-1">{tr("Track your payments from MWRD.")}</p>
        </div>

        {loading ? <CardSkeleton count={2} /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-yellow-700" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{tr("Pending Payouts")}</p>
                    <p className="text-xl font-bold text-foreground">{formatSAR(totalPending)}</p>
                    <p className="text-xs text-muted-foreground">{tr("{count} payouts", { count: fmtNumber(pending.length) })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{tr("Total Paid")}</p>
                    <p className="text-xl font-bold text-foreground">{formatSAR(totalPaid)}</p>
                    <p className="text-xs text-muted-foreground">{tr("{count} payouts", { count: fmtNumber(paid.length) })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>{tr("Pending Payouts")}</CardTitle></CardHeader>
          <CardContent>
            {loading ? <TableSkeleton rows={3} cols={6} /> : <PayoutTable items={pending} pag={pendingPag} emptyMsg="No pending payouts" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{tr("Completed Payouts")}</CardTitle></CardHeader>
          <CardContent>
            {loading ? <TableSkeleton rows={3} cols={6} /> : <PayoutTable items={paid} pag={paidPag} emptyMsg="No completed payouts yet" />}
          </CardContent>
        </Card>
      </div>
    </SupplierLayout>
  );
};

export default SupplierPayouts;

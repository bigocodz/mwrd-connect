import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Upload } from "lucide-react";
import { AlertCircle } from "@untitledui/icons";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { formatSAR } from "@/components/shared/VatBadge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCategoryNames } from "@/components/categories/useCategoryNames";
import { ProposeCategoryDialog } from "@/components/categories/ProposeCategoryDialog";

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  LIMITED_STOCK: "bg-yellow-100 text-yellow-800",
  OUT_OF_STOCK: "bg-red-100 text-red-800",
};

const approvalColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const STOCK_FILTERS = [
  { value: "ALL", label: "All products" },
  { value: "TRACKED", label: "Stock-tracked" },
  { value: "LOW", label: "Low stock" },
  { value: "OUT", label: "Out of stock" },
];

const SupplierProducts = () => {
  const { tr, lang } = useLanguage();
  const { localize } = useCategoryNames();
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

  const navigate = useNavigate();
  const productsData = useQuery(api.products.listMine);
  const alertsData = useQuery(api.products.stockAlerts);
  const myProposals = useQuery(api.categories.myProposals, {}) ?? [];
  const updateStock = useMutation(api.products.updateStock);
  const loading = productsData === undefined;
  const products = productsData ?? [];
  const alerts = alertsData ?? [];
  const [stockFilter, setStockFilter] = useState("ALL");
  const filtered = products.filter((p: any) => {
    if (stockFilter === "ALL") return true;
    if (stockFilter === "TRACKED") return p.stock_quantity != null;
    if (stockFilter === "LOW") return p.stock_quantity != null && p.availability_status === "LIMITED_STOCK";
    if (stockFilter === "OUT") return p.availability_status === "OUT_OF_STOCK";
    return true;
  });
  const { page, setPage, totalPages, paginated, total } = usePagination(filtered);

  const [stockDialog, setStockDialog] = useState<any | null>(null);
  const [stockValue, setStockValue] = useState("");
  const [thresholdValue, setThresholdValue] = useState("");
  const [busy, setBusy] = useState(false);

  const openStockDialog = (product: any) => {
    setStockDialog(product);
    setStockValue(product.stock_quantity != null ? String(product.stock_quantity) : "");
    setThresholdValue(
      product.low_stock_threshold != null ? String(product.low_stock_threshold) : "",
    );
  };

  const submitStock = async () => {
    if (!stockDialog) return;
    const qty = Number(stockValue);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error(tr("Stock must be a non-negative number"));
      return;
    }
    const threshold =
      thresholdValue.trim() === "" ? undefined : Math.max(0, Math.floor(Number(thresholdValue)));
    setBusy(true);
    try {
      await updateStock({
        id: stockDialog._id,
        stock_quantity: Math.floor(qty),
        low_stock_threshold: threshold,
      });
      toast.success(tr("Stock updated"));
      setStockDialog(null);
    } catch (err: any) {
      toast.error(err.message || tr("Update failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SupplierLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-display text-3xl font-bold text-foreground">{tr("My Products")}</h1>
        <div className="flex gap-2 items-center">
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STOCK_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{tr(f.label)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" asChild>
            <Link to="/supplier/products/bulk"><Upload className="w-4 h-4 me-1.5" /> {tr("Bulk Import")}</Link>
          </Button>
          <Button asChild>
            <Link to="/supplier/products/add"><Plus className="w-4 h-4 me-1.5" /> {tr("Add Product")}</Link>
          </Button>
        </div>
      </div>

      {alerts.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-amber-900">
                {tr("{count} products need stock attention", { count: fmtNumber(alerts.length) })}
              </p>
              <p className="text-sm text-amber-800">
                {tr("{out} out of stock, {low} low.", {
                  out: fmtNumber(alerts.filter((a: any) => a.availability_status === "OUT_OF_STOCK").length),
                  low: fmtNumber(alerts.filter((a: any) => a.availability_status === "LIMITED_STOCK").length),
                })}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setStockFilter("LOW")}>{tr("View low")}</Button>
            <Button size="sm" variant="outline" onClick={() => setStockFilter("OUT")}>{tr("View out")}</Button>
          </CardContent>
        </Card>
      )}

      {myProposals.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{tr("My category proposals")}</p>
                <p className="text-xs text-muted-foreground">
                  {tr("Categories you suggested to admin. Status updates here when reviewed.")}
                </p>
              </div>
              <ProposeCategoryDialog />
            </div>
            <ul className="space-y-2">
              {myProposals.slice(0, 5).map((p: any) => {
                const proposalStatusClass =
                  p.status === "ACTIVE"
                    ? "bg-green-100 text-green-800"
                    : p.status === "REJECTED"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800";
                const statusLabel =
                  p.status === "ACTIVE"
                    ? tr("Approved")
                    : p.status === "REJECTED"
                      ? tr("Rejected")
                      : tr("Pending review");
                const parentLabel = p.parent_id
                  ? lang === "ar"
                    ? p.parent_name_ar
                    : p.parent_name_en
                  : tr("(Top-level — no parent)");
                return (
                  <li key={p._id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {lang === "ar" ? p.name_ar : p.name_en}
                        <span className="ms-2 text-xs text-muted-foreground">
                          {lang === "ar" ? p.name_en : p.name_ar}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {tr("Under")}: {parentLabel}
                      </p>
                      {p.status === "REJECTED" && p.decision_note && (
                        <p className="mt-1 rounded bg-red-50 p-2 text-xs text-red-900">
                          {tr("Reason")}: {p.decision_note}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${proposalStatusClass}`}>
                      {statusLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {loading ? <TableSkeleton rows={5} cols={6} /> : products.length === 0 ? (
        <EmptyState icon="products" title={tr("No products yet")} description={tr("Add your first product to get started.")} action={
          <Button asChild><Link to="/supplier/products/add">{tr("Add Product")}</Link></Button>
        } />
      ) : filtered.length === 0 ? (
        <EmptyState icon="products" title={tr("No products match this filter")} />
      ) : (
        <>
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Name")}</TableHead>
                  <TableHead>{tr("Category")}</TableHead>
                  <TableHead>{tr("Approval")}</TableHead>
                  <TableHead>{tr("Availability")}</TableHead>
                  <TableHead className="text-end">{tr("Stock")}</TableHead>
                  <TableHead className="text-end">{tr("Your Price (SAR)")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p: any) => (
                  <TableRow key={p._id}>
                    <TableCell className="font-medium cursor-pointer" onClick={() => navigate(`/supplier/products/${p._id}`)}>{p.name}</TableCell>
                    <TableCell className="text-muted-foreground cursor-pointer" onClick={() => navigate(`/supplier/products/${p._id}`)}>{localize((p as any).category_id, p.category)}{p.subcategory ? ` / ${localize((p as any).subcategory_id, p.subcategory)}` : ""}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${approvalColors[p.approval_status]}`}>{enumLabel(p.approval_status)}</span>
                      {p.approval_status === "REJECTED" && p.rejection_reason && <p className="text-xs text-destructive mt-0.5">{p.rejection_reason}</p>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${statusColors[p.availability_status]}`}>{enumLabel(p.availability_status)}</span>
                    </TableCell>
                    <TableCell className="text-end">
                      {p.stock_quantity != null ? (
                        <button type="button" className="font-mono text-sm hover:underline" onClick={() => openStockDialog(p)}>
                          {fmtNumber(p.stock_quantity)}
                          {p.low_stock_threshold != null && (
                            <span className="text-xs text-muted-foreground"> / {fmtNumber(p.low_stock_threshold)}</span>
                          )}
                        </button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => openStockDialog(p)}>{tr("Set stock")}</Button>
                      )}
                    </TableCell>
                    <TableCell className="text-end font-mono cursor-pointer" onClick={() => navigate(`/supplier/products/${p._id}`)}>{formatSAR(Number(p.cost_price))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}

      <Dialog open={stockDialog !== null} onOpenChange={(open) => !open && setStockDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("Update stock — {name}", { name: stockDialog?.name ?? "" })}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="stock-input">{tr("Stock quantity")}</Label>
              <Input
                id="stock-input"
                type="number"
                min="0"
                step="1"
                value={stockValue}
                onChange={(e) => setStockValue(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="threshold-input">{tr("Low-stock threshold (optional)")}</Label>
              <Input
                id="threshold-input"
                type="number"
                min="0"
                step="1"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
                placeholder={tr("When to flag as Limited")}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {tr("Stock changes update availability immediately and don't trigger re-approval.")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialog(null)}>{tr("Cancel")}</Button>
            <Button onClick={submitStock} disabled={busy}>{tr("Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SupplierLayout>
  );
};

export default SupplierProducts;

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
  const navigate = useNavigate();
  const productsData = useQuery(api.products.listMine);
  const alertsData = useQuery(api.products.stockAlerts);
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
      toast.error("Stock must be a non-negative number");
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
      toast.success("Stock updated");
      setStockDialog(null);
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SupplierLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-display text-3xl font-bold text-foreground">My Products</h1>
        <div className="flex gap-2 items-center">
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STOCK_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" asChild>
            <Link to="/supplier/products/bulk"><Upload className="w-4 h-4 me-1.5" /> Bulk Import</Link>
          </Button>
          <Button asChild>
            <Link to="/supplier/products/add"><Plus className="w-4 h-4 me-1.5" /> Add Product</Link>
          </Button>
        </div>
      </div>

      {alerts.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-amber-900">
                {alerts.length} product{alerts.length === 1 ? "" : "s"} need{alerts.length === 1 ? "s" : ""} stock attention
              </p>
              <p className="text-sm text-amber-800">
                {alerts.filter((a: any) => a.availability_status === "OUT_OF_STOCK").length} out of stock,{" "}
                {alerts.filter((a: any) => a.availability_status === "LIMITED_STOCK").length} low.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setStockFilter("LOW")}>View low</Button>
            <Button size="sm" variant="outline" onClick={() => setStockFilter("OUT")}>View out</Button>
          </CardContent>
        </Card>
      )}

      {loading ? <TableSkeleton rows={5} cols={6} /> : products.length === 0 ? (
        <EmptyState icon="products" title="No products yet" description="Add your first product to get started." action={
          <Button asChild><Link to="/supplier/products/add">Add Product</Link></Button>
        } />
      ) : filtered.length === 0 ? (
        <EmptyState icon="products" title="No products match this filter" />
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead className="text-end">Stock</TableHead>
                  <TableHead className="text-end">Your Price (SAR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p: any) => (
                  <TableRow key={p._id} className="hover:bg-muted/50">
                    <TableCell className="font-medium cursor-pointer" onClick={() => navigate(`/supplier/products/${p._id}`)}>{p.name}</TableCell>
                    <TableCell className="text-muted-foreground cursor-pointer" onClick={() => navigate(`/supplier/products/${p._id}`)}>{p.category}{p.subcategory ? ` / ${p.subcategory}` : ""}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${approvalColors[p.approval_status]}`}>{p.approval_status}</span>
                      {p.approval_status === "REJECTED" && p.rejection_reason && <p className="text-xs text-destructive mt-0.5">{p.rejection_reason}</p>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.availability_status]}`}>{p.availability_status.replace("_", " ")}</span>
                    </TableCell>
                    <TableCell className="text-end">
                      {p.stock_quantity != null ? (
                        <button type="button" className="font-mono text-sm hover:underline" onClick={() => openStockDialog(p)}>
                          {p.stock_quantity}
                          {p.low_stock_threshold != null && (
                            <span className="text-xs text-muted-foreground"> / {p.low_stock_threshold}</span>
                          )}
                        </button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => openStockDialog(p)}>Set stock</Button>
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
          <DialogHeader><DialogTitle>Update stock — {stockDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="stock-input">Stock quantity</Label>
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
              <Label htmlFor="threshold-input">Low-stock threshold (optional)</Label>
              <Input
                id="threshold-input"
                type="number"
                min="0"
                step="1"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
                placeholder="When to flag as Limited"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Stock changes update availability immediately and don't trigger re-approval.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialog(null)}>Cancel</Button>
            <Button onClick={submitStock} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SupplierLayout>
  );
};

export default SupplierProducts;

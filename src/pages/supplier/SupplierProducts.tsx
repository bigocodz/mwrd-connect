import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
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

const SupplierProducts = () => {
  const navigate = useNavigate();
  const productsData = useQuery(api.products.listMine);
  const loading = productsData === undefined;
  const products = productsData ?? [];
  const { page, setPage, totalPages, paginated, total } = usePagination(products);

  return (
    <SupplierLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground">My Products</h1>
        <Button asChild><Link to="/supplier/products/add"><Plus className="w-4 h-4 mr-1.5" /> Add Product</Link></Button>
      </div>

      {loading ? <TableSkeleton rows={5} cols={5} /> : products.length === 0 ? (
        <EmptyState icon="products" title="No products yet" description="Add your first product to get started." action={
          <Button asChild><Link to="/supplier/products/add">Add Product</Link></Button>
        } />
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
                  <TableHead className="text-right">Your Price (SAR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p) => (
                  <TableRow key={p._id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/supplier/products/${p._id}`)}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.category}{p.subcategory ? ` / ${p.subcategory}` : ""}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${approvalColors[p.approval_status]}`}>{p.approval_status}</span>
                      {p.approval_status === "REJECTED" && p.rejection_reason && <p className="text-xs text-destructive mt-0.5">{p.rejection_reason}</p>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.availability_status]}`}>{p.availability_status.replace("_", " ")}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatSAR(Number(p.cost_price))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}
    </SupplierLayout>
  );
};

export default SupplierProducts;

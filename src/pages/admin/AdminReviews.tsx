import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star } from "lucide-react";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";

const StarDisplay = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`w-4 h-4 ${i <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
    ))}
  </div>
);

const AdminReviews = () => {
  const reviewsData = useQuery(api.reviews.listAll);
  const loading = reviewsData === undefined;
  const reviews = reviewsData ?? [];
  const { page, setPage, totalPages, paginated, total } = usePagination(reviews);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">All Reviews</h1>
          <p className="text-muted-foreground mt-1">Full review list with real identities.</p>
        </div>

        {loading ? <TableSkeleton rows={5} cols={5} /> : reviews.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState icon="reviews" title="No reviews yet" description="Reviews will appear here when clients rate suppliers." />
          </CardContent></Card>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((r: any) => (
                  <TableRow key={r._id}>
                    <TableCell>
                      <div className="font-medium">{r.client_public_id}</div>
                      <div className="text-xs text-muted-foreground">{r.client_company_name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.supplier_public_id}</div>
                      <div className="text-xs text-muted-foreground">{r.supplier_company_name}</div>
                    </TableCell>
                    <TableCell><StarDisplay rating={r.rating} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.comment || "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(r._creationTime).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminReviews;

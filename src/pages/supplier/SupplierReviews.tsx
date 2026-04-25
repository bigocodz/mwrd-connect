import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star } from "lucide-react";
import { TableSkeleton, CardSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { useLanguage } from "@/contexts/LanguageContext";

const StarDisplay = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`w-4 h-4 ${i <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
    ))}
  </div>
);

const SupplierReviews = () => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";
  const fmtNumber = (n: number) => new Intl.NumberFormat(locale).format(n);
  const reviewsData = useQuery(api.reviews.listForSupplier);
  const loading = reviewsData === undefined;
  const reviews = reviewsData ?? [];
  const { page, setPage, totalPages, paginated, total } = usePagination(reviews);

  const avgRating =
    reviews.length > 0
      ? new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
          reviews.reduce((s, r) => s + r.rating, 0) / reviews.length,
        )
      : "—";

  return (
    <SupplierLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("My Reviews")}</h1>
          <p className="text-muted-foreground mt-1">{tr("See how clients rate your service.")}</p>
        </div>

        {loading ? <CardSkeleton count={2} /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Star className="w-7 h-7 text-primary fill-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tr("Average Rating")}</p>
                  <p className="text-3xl font-bold text-foreground">{avgRating}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">{fmtNumber(reviews.length)}</span>
                </div>
                <div><p className="text-sm text-muted-foreground">{tr("Total Reviews")}</p></div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>{tr("Review History")}</CardTitle></CardHeader>
          <CardContent>
            {loading ? <TableSkeleton rows={5} cols={4} /> : reviews.length === 0 ? (
              <EmptyState icon="reviews" title={tr("No reviews yet")} description={tr("Reviews from clients will appear here.")} />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tr("Client")}</TableHead>
                      <TableHead>{tr("Rating")}</TableHead>
                      <TableHead>{tr("Comment")}</TableHead>
                      <TableHead>{tr("Date")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((r: any) => (
                      <TableRow key={r._id}>
                        <TableCell className="font-medium">{r.client_public_id || "—"}</TableCell>
                        <TableCell><StarDisplay rating={r.rating} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.comment || "—"}</TableCell>
                        <TableCell className="text-sm">{new Date(r._creationTime).toLocaleDateString(locale)}</TableCell>
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
    </SupplierLayout>
  );
};

export default SupplierReviews;

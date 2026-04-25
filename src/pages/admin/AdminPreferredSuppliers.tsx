import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { Star01 } from "@untitledui/icons";
import { toast } from "sonner";

const AdminPreferredSuppliers = () => {
  const data = useQuery(api.users.listPreferredSuppliers);
  const setPreferred = useMutation(api.users.setPreferredSupplier);
  const loading = data === undefined;
  const suppliers = data ?? [];

  const removePreferred = async (id: string) => {
    try {
      await setPreferred({ id: id as any, is_preferred: false });
      toast.success("Removed from preferred");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Star01 className="w-6 h-6 text-amber-600" /> Preferred Suppliers
          </h1>
          <p className="text-muted-foreground mt-1">
            Curated suppliers prioritized for new RFQs and surfaced in client suggestions.
          </p>
        </div>

        {loading ? <TableSkeleton rows={4} cols={5} /> : suppliers.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState
              icon="users"
              title="No preferred suppliers yet"
              description="Open a supplier profile and toggle Preferred to add them here."
            />
          </CardContent></Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Marked</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s: any) => (
                <TableRow key={s._id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" to={`/admin/users/${s._id}`}>
                      {s.public_id}
                    </Link>
                    {s.company_name && (
                      <div className="text-xs text-muted-foreground">{s.company_name}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{s.status?.toLowerCase().replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-md">
                    <p className="truncate" title={s.preferred_note}>{s.preferred_note ?? "—"}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.preferred_at ? new Date(s.preferred_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => removePreferred(s._id)}>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPreferredSuppliers;

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Star } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  FROZEN: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  DEACTIVATED: "bg-muted text-muted-foreground",
  REQUIRES_ATTENTION: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const kycColors: Record<string, string> = {
  INCOMPLETE: "bg-muted text-muted-foreground",
  IN_REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  VERIFIED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const AdminUsers = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [kycFilter, setKycFilter] = useState("ALL");

  const usersData = useQuery(api.users.listAll, {
    role: roleFilter === "ALL" ? undefined : roleFilter,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    kyc_status: kycFilter === "ALL" ? undefined : kycFilter,
  });
  const loading = usersData === undefined;
  const users = usersData ?? [];

  const filtered = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      u.public_id?.toLowerCase().includes(s) ||
      u.company_name?.toLowerCase().includes(s)
    );
  });

  const { page, setPage, totalPages, paginated, total } = usePagination(filtered);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground">User Management</h1>
        <Button asChild>
          <Link to="/admin/users/create"><Plus className="w-4 h-4 me-1.5" /> Create User</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="CLIENT">Client</SelectItem>
            <SelectItem value="SUPPLIER">Supplier</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="FROZEN">Frozen</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
            <SelectItem value="REQUIRES_ATTENTION">Requires Attention</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kycFilter} onValueChange={setKycFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="KYC" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All KYC</SelectItem>
            <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
            <SelectItem value="IN_REVIEW">In Review</SelectItem>
            <SelectItem value="VERIFIED">Verified</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="users" title="No users found" />
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Public ID</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((u) => (
                  <TableRow key={u._id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/users/${u._id}`)}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-1.5">
                        {u.public_id || "—"}
                        {u.is_preferred && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" aria-label="Preferred supplier" />}
                      </div>
                    </TableCell>
                    <TableCell>{u.company_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{u.role.toLowerCase()}</Badge></TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[u.status] || ""}`}>{u.status}</span></TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${kycColors[u.kyc_status] || ""}`}>{u.kyc_status}</span></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(u._creationTime), "MMM d, yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}
    </AdminLayout>
  );
};

export default AdminUsers;

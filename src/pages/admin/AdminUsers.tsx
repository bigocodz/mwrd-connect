import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Star, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";
import { useLanguage } from "@/contexts/LanguageContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import CreateUserDialog from "@/components/admin/CreateUserDialog";

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
  const { tr } = useLanguage();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [kycFilter, setKycFilter] = useState("ALL");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const deleteUser = useMutation(api.users.deleteUser);

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

  const handleDeleteClick = (e: React.MouseEvent, user: any) => {
    e.stopPropagation();
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await deleteUser({ id: userToDelete._id });
      toast.success(tr("User deleted successfully"));
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      toast.error(err.message || tr("Failed to delete user"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground">{tr("User Management")}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 me-1.5" /> {tr("Create User")}
        </Button>
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={tr("Search by ID or company...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder={tr("Role")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr("All Roles")}</SelectItem>
            <SelectItem value="CLIENT">{tr("Client")}</SelectItem>
            <SelectItem value="SUPPLIER">{tr("Supplier")}</SelectItem>
            <SelectItem value="ADMIN">{tr("Admin")}</SelectItem>
            <SelectItem value="AUDITOR">{tr("Auditor")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={tr("Status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr("All Statuses")}</SelectItem>
            <SelectItem value="ACTIVE">{tr("Active")}</SelectItem>
            <SelectItem value="PENDING">{tr("Pending")}</SelectItem>
            <SelectItem value="FROZEN">{tr("Frozen")}</SelectItem>
            <SelectItem value="REJECTED">{tr("Rejected")}</SelectItem>
            <SelectItem value="DEACTIVATED">{tr("Deactivated")}</SelectItem>
            <SelectItem value="REQUIRES_ATTENTION">{tr("Requires Attention")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kycFilter} onValueChange={setKycFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={tr("KYC")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr("All KYC")}</SelectItem>
            <SelectItem value="INCOMPLETE">{tr("Incomplete")}</SelectItem>
            <SelectItem value="IN_REVIEW">{tr("In Review")}</SelectItem>
            <SelectItem value="VERIFIED">{tr("Verified")}</SelectItem>
            <SelectItem value="REJECTED">{tr("Rejected")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="users" title={tr("No users found")} />
      ) : (
        <>
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Public ID")}</TableHead>
                  <TableHead>{tr("Company")}</TableHead>
                  <TableHead>{tr("Role")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                  <TableHead>{tr("KYC")}</TableHead>
                  <TableHead>{tr("Created")}</TableHead>
                  <TableHead className="w-[60px]">{tr("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((u) => (
                  <TableRow key={u._id} className="cursor-pointer" onClick={() => navigate(`/admin/users/${u._id}`)}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-1.5">
                        {u.public_id || "—"}
                        {u.is_preferred && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" aria-label={tr("Preferred supplier")} />}
                      </div>
                    </TableCell>
                    <TableCell>{u.company_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{u.role.toLowerCase()}</Badge></TableCell>
                    <TableCell><span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${statusColors[u.status] || ""}`}>{u.status}</span></TableCell>
                    <TableCell><span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${kycColors[u.kyc_status] || ""}`}>{u.kyc_status}</span></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(u._creationTime), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteClick(e, u)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Delete User")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr("Are you sure you want to delete {name}? This action cannot be undone.", {
                name: userToDelete?.company_name || userToDelete?.public_id || "this user",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>{tr("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? tr("Deleting...") : tr("Delete")}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminUsers;

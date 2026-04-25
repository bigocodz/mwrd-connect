import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Mail, Phone, Building2, Inbox, UserPlus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePagination, PaginationControls } from "@/components/shared/Pagination";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  REVIEWED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const accountTypeColors: Record<string, string> = {
  CLIENT: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  SUPPLIER: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

const AdminLeads = () => {
  const leadsData = useQuery(api.leads.listAll);
  const updateStatus = useMutation(api.leads.updateStatus);
  const approveAndCreateAccount = useAction(api.leads.approveAndCreateAccount);

  const loading = leadsData === undefined;
  const leads = leadsData ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selected, setSelected] = useState<any>(null);
  const [approveRole, setApproveRole] = useState<"CLIENT" | "SUPPLIER">("CLIENT");
  const [approving, setApproving] = useState(false);

  const handleUpdateStatus = async (id: string, status: "PENDING" | "REVIEWED" | "APPROVED" | "REJECTED") => {
    try {
      await updateStatus({ id: id as any, status });
      toast.success("Lead status updated");
      if (selected?._id === id) setSelected((prev: any) => prev ? { ...prev, status } : prev);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openLead = (lead: any) => {
    setSelected(lead);
    setApproveRole(lead.account_type === "SUPPLIER" ? "SUPPLIER" : "CLIENT");
  };

  const handleApproveAndCreate = async () => {
    if (!selected) return;
    setApproving(true);
    try {
      const result = await approveAndCreateAccount({ id: selected._id, role: approveRole });
      toast.success(`Account created (${result.public_id ?? "—"}). Credentials emailed to ${result.email}.`);
      setSelected((prev: any) => (prev ? { ...prev, status: "APPROVED" } : prev));
    } catch (err: any) {
      toast.error(err.message || "Failed to approve lead");
    } finally {
      setApproving(false);
    }
  };

  const filtered = leads.filter((l) => {
    if (statusFilter !== "ALL" && l.status !== statusFilter) return false;
    if (typeFilter !== "ALL" && l.account_type !== typeFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.full_name.toLowerCase().includes(s) ||
      (l.company_name || "").toLowerCase().includes(s) ||
      l.email.toLowerCase().includes(s) ||
      (l.phone || "").toLowerCase().includes(s)
    );
  });

  const { page, setPage, totalPages, paginated, total } = usePagination(filtered);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Interest Leads</h1>
          <p className="text-muted-foreground mt-1">New visitors who registered interest from the landing page.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, company, email or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              <SelectItem value="CLIENT">Client</SelectItem>
              <SelectItem value="SUPPLIER">Supplier</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="REVIEWED">Reviewed</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Inbox} title="No leads yet" description="When someone registers interest from the landing page, they will appear here." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-end">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((l: any) => (
                    <TableRow key={l._id} className="cursor-pointer" onClick={() => openLead(l)}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(l._creationTime), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">{l.full_name}</TableCell>
                      <TableCell>{l.company_name || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        {l.account_type ? (
                          <Badge variant="secondary" className={accountTypeColors[l.account_type]}>{l.account_type}</Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="truncate max-w-[200px]">{l.email}</span>
                          {l.phone && <span className="text-muted-foreground">{l.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[l.status]}>{l.status}</Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openLead(l); }}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-4 py-3 border-t border-border">
                <PaginationControls page={page} onPageChange={setPage} totalPages={totalPages} total={total} />
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {selected.company_name || selected.full_name}
                </DialogTitle>
                <DialogDescription>Submitted {format(new Date(selected._creationTime), "PPpp")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Contact</p>
                    <p className="font-medium">{selected.full_name}</p>
                  </div>
                  {selected.account_type && (
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Account type</p>
                      <Badge variant="secondary" className={accountTypeColors[selected.account_type]}>{selected.account_type}</Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${selected.email}`} className="text-accent hover:underline">{selected.email}</a>
                  </div>
                  {selected.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${selected.phone}`} className="text-accent hover:underline">{selected.phone}</a>
                    </div>
                  )}
                  {selected.cr_number && (
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">CR Number</p>
                      <p className="font-mono">{selected.cr_number}</p>
                    </div>
                  )}
                  {selected.vat_number && (
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">VAT Number</p>
                      <p className="font-mono">{selected.vat_number}</p>
                    </div>
                  )}
                </div>
                {selected.notes && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm bg-muted rounded-md p-3 whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                )}
                <div className="border-t border-border pt-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Status</p>
                  <div className="flex flex-wrap gap-2">
                    {(["PENDING", "REVIEWED", "APPROVED", "REJECTED"] as const).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={selected.status === s ? "default" : "outline"}
                        onClick={() => handleUpdateStatus(selected._id, s)}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>

                {selected.status !== "APPROVED" && (
                  <div className="border-t border-border pt-4">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Approve & create account</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      This creates a user with an auto-generated temporary password and emails the credentials to <span className="font-medium text-foreground">{selected.email}</span>.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={approveRole} onValueChange={(v) => setApproveRole(v as "CLIENT" | "SUPPLIER")}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CLIENT">Client</SelectItem>
                          <SelectItem value="SUPPLIER">Supplier</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleApproveAndCreate} disabled={approving}>
                        {approving ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : <UserPlus className="w-4 h-4 me-1.5" />}
                        Approve & email credentials
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminLeads;

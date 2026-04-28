import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "@untitledui/icons";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatSAR } from "@/components/shared/VatBadge";
import { useLanguage } from "@/contexts/LanguageContext";

const statusColor: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const AdminApprovals = () => {
  const { tr } = useLanguage();
  const allData = useQuery(api.approvals.listAll);
  const myStepsData = useQuery(api.approvals.listMyPendingSteps);
  const approve = useMutation(api.approvals.approve);
  const reject = useMutation(api.approvals.reject);
  const approveStep = useMutation(api.approvals.approveStep);
  const rejectStep = useMutation(api.approvals.rejectStep);
  const requests = allData ?? [];
  const myPendingSteps = myStepsData ?? [];
  const loading = allData === undefined;
  // Hide requests that already have an active step queue from the legacy list
  // — they're surfaced in the Pending Steps panel above instead.
  const stepRequestIds = new Set(myPendingSteps.map((s: any) => String(s.request_id)));
  const pending = requests.filter(
    (r: any) => r.status === "PENDING" && !stepRequestIds.has(String(r._id)),
  );
  const decided = requests.filter((r: any) => r.status !== "PENDING");

  const [activeReject, setActiveReject] = useState<any | null>(null);
  const [activeStepReject, setActiveStepReject] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const handleApproveStep = async (decision_id: string) => {
    setBusy(true);
    try {
      await approveStep({ decision_id: decision_id as any });
      toast.success(tr("Step approved"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleRejectStep = async () => {
    if (!activeStepReject || !note.trim()) return;
    setBusy(true);
    try {
      await rejectStep({ decision_id: activeStepReject._id, note: note.trim() });
      toast.success(tr("Step rejected"));
      setActiveStepReject(null);
      setNote("");
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (id: string) => {
    setBusy(true);
    try {
      await approve({ id: id as any });
      toast.success(tr("Approved — order created"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!activeReject || !note.trim()) return;
    setBusy(true);
    try {
      await reject({ id: activeReject._id, note: note.trim() });
      toast.success(tr("Rejected"));
      setActiveReject(null);
      setNote("");
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (r: any) => (
    <TableRow key={r._id}>
      <TableCell className="font-medium">{r.rule_name}</TableCell>
      <TableCell>
        {r.client_public_id}
        {r.client_company_name && (
          <div className="text-xs text-muted-foreground">{r.client_company_name}</div>
        )}
      </TableCell>
      <TableCell className="font-medium">{formatSAR(r.quote_total)}</TableCell>
      <TableCell className="text-sm">{new Date(r.requested_at).toLocaleDateString()}</TableCell>
      <TableCell>
        <Badge variant="outline" className={statusColor[r.status] || ""}>{r.status}</Badge>
        {r.decision_note && <p className="text-xs text-muted-foreground mt-1 max-w-xs truncate" title={r.decision_note}>{r.decision_note}</p>}
      </TableCell>
      <TableCell>
        <Button size="sm" variant="ghost" asChild>
          <Link to={`/admin/quotes/${r.quote_id}/review`}>{tr("Quote")}</Link>
        </Button>
        {r.status === "PENDING" && (
          <>
            <Button size="sm" onClick={() => handleApprove(r._id)} disabled={busy}>
              <CheckCircle className="w-3 h-3 me-1" /> {tr("Approve")}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { setActiveReject(r); setNote(""); }} disabled={busy}>
              <XCircle className="w-3 h-3 me-1" /> {tr("Reject")}
            </Button>
          </>
        )}
      </TableCell>
    </TableRow>
  );

  const renderTable = (rows: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{tr("Rule")}</TableHead>
          <TableHead>{tr("Client")}</TableHead>
          <TableHead>{tr("Total")}</TableHead>
          <TableHead>{tr("Requested")}</TableHead>
          <TableHead>{tr("Status")}</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{rows.map(renderRow)}</TableBody>
    </Table>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("Approval Queue")}</h1>
          <p className="text-muted-foreground mt-1">{tr("Client-defined approval rules gate quote acceptance until MWRD reviews.")}</p>
        </div>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium">
            {tr("Pending steps")} ({myPendingSteps.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            {tr("Steps from multi-step workflows that are currently active and assigned to you (or unassigned).")}
          </p>
          {myPendingSteps.length === 0 ? (
            <Card><CardContent className="p-0">
              <EmptyState
                icon="audit"
                title={tr("No active steps")}
                description={tr("Steps will appear here when a workflow advances to a stage you can decide.")}
              />
            </CardContent></Card>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("Step")}</TableHead>
                    <TableHead>{tr("Rule")}</TableHead>
                    <TableHead>{tr("Client")}</TableHead>
                    <TableHead>{tr("Total")}</TableHead>
                    <TableHead>{tr("Group")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myPendingSteps.map((s: any) => (
                    <TableRow key={s._id}>
                      <TableCell className="font-medium">
                        {s.label}
                        {s.escalated_at && (
                          <Badge variant="outline" className="ms-2 bg-red-100 text-red-800 text-[10px]">
                            {tr("Escalated")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{s.rule_name}</TableCell>
                      <TableCell>
                        {s.client_public_id}
                        {s.client_company_name && (
                          <div className="text-xs text-muted-foreground">{s.client_company_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{formatSAR(s.quote_total)}</TableCell>
                      <TableCell><Badge variant="outline">G{s.parallel_group}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/admin/quotes/${s.quote_id}/review`}>{tr("Quote")}</Link>
                          </Button>
                          <Button size="sm" onClick={() => handleApproveStep(s._id)} disabled={busy}>
                            <CheckCircle className="w-3 h-3 me-1" /> {tr("Approve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { setActiveStepReject(s); setNote(""); }}
                            disabled={busy}
                          >
                            <XCircle className="w-3 h-3 me-1" /> {tr("Reject")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium">{tr("Pending")} ({pending.length})</h2>
          {loading ? <TableSkeleton rows={3} cols={6} /> : pending.length === 0 ? (
            <Card><CardContent className="p-0">
              <EmptyState icon="audit" title={tr("Nothing pending")} description={tr("No quote acceptances are waiting on approval.")} />
            </CardContent></Card>
          ) : (
            renderTable(pending)
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium">{tr("Decided")} ({decided.length})</h2>
          {loading ? null : decided.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr("No decisions yet.")}</p>
          ) : (
            renderTable(decided)
          )}
        </section>
      </div>

      <Dialog open={activeReject !== null} onOpenChange={(o) => !o && setActiveReject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("Reject approval request")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>{tr("Reason")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Tell the client why.")} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveReject(null)}>{tr("Close")}</Button>
            <Button variant="destructive" disabled={busy || !note.trim()} onClick={handleReject}>{tr("Reject")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeStepReject !== null}
        onOpenChange={(o) => !o && setActiveStepReject(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Reject step")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {tr("Rejecting any step fails the entire workflow and notifies the client.")}
            </p>
            <Label>{tr("Reason")}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tr("Tell the client why.")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveStepReject(null)}>
              {tr("Close")}
            </Button>
            <Button variant="destructive" disabled={busy || !note.trim()} onClick={handleRejectStep}>
              {tr("Reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminApprovals;

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "@untitledui/icons";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { KYC_STATUS_COLOR, KYC_STATUS_LABEL, KYC_TYPE_LABEL } from "./kycLabels";

export const AdminKycPanel = ({ profileId }: { profileId: string }) => {
  const docsData = useQuery(api.kyc.listForProfile, { profile_id: profileId as any });
  const approve = useMutation(api.kyc.approve);
  const reject = useMutation(api.kyc.reject);

  const loading = docsData === undefined;
  const docs = docsData ?? [];
  const [busy, setBusy] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const wrap = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>KYC Documents</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No KYC documents uploaded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>File</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc: any) => (
                <TableRow key={doc._id}>
                  <TableCell>
                    <div className="font-medium">{doc.name}</div>
                    {doc.notes && <p className="text-xs text-muted-foreground">{doc.notes}</p>}
                  </TableCell>
                  <TableCell className="text-sm">{KYC_TYPE_LABEL[doc.document_type] ?? doc.document_type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={KYC_STATUS_COLOR[doc.status] || ""}>
                      {KYC_STATUS_LABEL[doc.status] ?? doc.status}
                    </Badge>
                    {doc.status === "REJECTED" && doc.rejection_reason && (
                      <p className="text-xs text-muted-foreground mt-1">{doc.rejection_reason}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{doc.expiry_date ?? "—"}</TableCell>
                  <TableCell>
                    {doc.url ? (
                      <a className="underline text-sm" href={doc.url} target="_blank" rel="noreferrer">View</a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {doc.status !== "APPROVED" && (
                        <Button size="sm" onClick={() => wrap("Approved", () => approve({ id: doc._id }))} disabled={busy}>
                          <CheckCircle className="w-3 h-3 me-1" /> Approve
                        </Button>
                      )}
                      {doc.status !== "REJECTED" && (
                        <Button size="sm" variant="destructive" onClick={() => { setRejectId(doc._id); setReason(""); }} disabled={busy}>
                          <XCircle className="w-3 h-3 me-1" /> Reject
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={rejectId !== null} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject document</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell the supplier what to fix." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Close</Button>
            <Button
              variant="destructive"
              disabled={busy || !reason.trim()}
              onClick={async () => {
                if (!rejectId) return;
                await wrap("Rejected", () => reject({ id: rejectId as any, reason: reason.trim() }));
                setRejectId(null);
                setReason("");
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

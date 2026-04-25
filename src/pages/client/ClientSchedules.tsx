import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import ClientLayout from "@/components/client/ClientLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { Trash01 } from "@untitledui/icons";

const cadenceLabel: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
};

const ClientSchedules = () => {
  const data = useQuery(api.schedules.listMine);
  const setActive = useMutation(api.schedules.setActive);
  const remove = useMutation(api.schedules.remove);
  const runNow = useMutation(api.schedules.runNow);
  const loading = data === undefined;
  const schedules = data ?? [];
  const [busy, setBusy] = useState<string | null>(null);

  const handleToggle = async (id: string, next: boolean) => {
    setBusy(id);
    try {
      await setActive({ id: id as any, active: next });
      toast.success(next ? "Resumed" : "Paused");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this schedule? It won't generate any more RFQs.")) return;
    setBusy(id);
    try {
      await remove({ id: id as any });
      toast.success("Deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(null);
    }
  };

  const handleRunNow = async (id: string) => {
    setBusy(id);
    try {
      await runNow({ id: id as any });
      toast.success("RFQ generated");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Repeat RFQs</h1>
          <p className="text-muted-foreground mt-1">
            Schedule recurring RFQs for items you procure on a fixed cadence.
          </p>
        </div>

        {loading ? <TableSkeleton rows={4} cols={6} /> : schedules.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState
              icon="rfqs"
              title="No schedules yet"
              description="From the create-RFQ page you can save the current RFQ as a schedule."
            />
          </CardContent></Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s: any) => (
                <TableRow key={s._id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><Badge variant="outline">{cadenceLabel[s.cadence] ?? s.cadence}</Badge></TableCell>
                  <TableCell>{s.template.items.length}</TableCell>
                  <TableCell className="text-sm">
                    {s.active ? new Date(s.next_run_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.last_run_at ? new Date(s.last_run_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={s.active}
                      onCheckedChange={(v) => handleToggle(s._id, v)}
                      disabled={busy === s._id}
                    />
                  </TableCell>
                  <TableCell className="text-end">
                    <Button size="sm" variant="ghost" onClick={() => handleRunNow(s._id)} disabled={busy === s._id}>
                      Run now
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(s._id)} disabled={busy === s._id}>
                      <Trash01 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientSchedules;

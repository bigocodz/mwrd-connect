import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download01 } from "@untitledui/icons";
import { downloadCsv } from "@/lib/csv";
import { formatSAR } from "@/components/shared/VatBadge";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";

type Mode = "MY" | "ADMIN";

const offsetISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const StatementPanel = ({
  mode,
  clientId,
}: {
  mode: Mode;
  clientId?: string;
}) => {
  const [from, setFrom] = useState(offsetISO(-90));
  const [to, setTo] = useState(offsetISO(0));

  const data = useQuery(
    mode === "MY" ? api.statements.myStatement : api.statements.adminClientStatement,
    mode === "MY"
      ? { from, to }
      : clientId
      ? ({ client_id: clientId as any, from, to } as any)
      : "skip",
  );

  const loading = data === undefined;

  const handleExport = () => {
    if (!data) return;
    const summary: string[][] = [
      ["Statement of Account"],
      ["Client", `${data.client.public_id} ${data.client.company_name ?? ""}`.trim()],
      ["Period", `${from} → ${to}`],
      [""],
      ["metric", "value"],
      ["issued_total", String(data.totals.issued)],
      ["paid_invoice_total", String(data.totals.paid_invoices)],
      ["outstanding_invoice_total", String(data.totals.outstanding_invoices)],
      ["payments_received", String(data.totals.payments_received)],
      ["net_balance", String(data.totals.net_balance)],
      [""],
      ["date", "type", "reference", "description", "debit", "credit", "status"],
    ];
    const lines = data.lines.map((l: any) => [
      new Date(l.timestamp).toISOString().slice(0, 10),
      l.type,
      l.reference,
      l.description,
      String(l.debit ?? 0),
      String(l.credit ?? 0),
      l.status,
    ]);
    const filename = `mwrd-statement-${data.client.public_id}-${from}_to_${to}.csv`;
    downloadCsv(filename, [...summary, ...lines]);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>Statement of account</CardTitle>
          <Button onClick={handleExport} disabled={!data || loading} variant="outline">
            <Download01 className="w-4 h-4 me-2" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">No data.</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Issued</p>
                <p className="text-lg font-medium">{formatSAR(data.totals.issued)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Outstanding</p>
                <p className="text-lg font-medium">{formatSAR(data.totals.outstanding_invoices)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Payments received</p>
                <p className="text-lg font-medium">{formatSAR(data.totals.payments_received)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Net balance</p>
                <p className="text-lg font-medium">{formatSAR(data.totals.net_balance)}</p>
              </div>
            </div>

            {data.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-end">Debit</TableHead>
                    <TableHead className="text-end">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lines.map((line: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">{new Date(line.timestamp).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs uppercase">{line.type}</TableCell>
                      <TableCell className="font-mono text-xs">{line.reference}</TableCell>
                      <TableCell className="text-sm">{line.description}</TableCell>
                      <TableCell className="text-end font-medium">
                        {line.debit ? formatSAR(line.debit) : "—"}
                      </TableCell>
                      <TableCell className="text-end font-medium">
                        {line.credit ? formatSAR(line.credit) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

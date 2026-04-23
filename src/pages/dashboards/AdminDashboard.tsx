import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Users, DollarSign, TrendingUp, Percent, ArrowRight, Star, Clock } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const AdminDashboard = () => {
  const stats = useQuery(api.dashboard.adminStats);
  const loading = stats === undefined;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);

  return (
    <AdminLayout>
      <h1 className="font-display text-3xl font-bold text-foreground mb-6">Admin Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <SummaryCard icon={DollarSign} label="GMV This Month" value={loading ? null : fmt(stats.monthlyRevenue)} />
        <SummaryCard icon={TrendingUp} label="Margin Collected" value={loading ? null : fmt(stats.monthlyRevenue - stats.monthlyPayouts)} />
        <SummaryCard icon={Users} label="Active Clients" value={loading ? null : String(stats.activeClients)} />
        <SummaryCard icon={Users} label="Active Suppliers" value={loading ? null : String(stats.activeSuppliers)} />
      </div>

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="w-4 h-4" /> Top 5 Suppliers by Rating</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-40 w-full" /> : !stats.topSuppliers.length ? (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Avg Rating</TableHead>
                    <TableHead className="text-right">Reviews</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topSuppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.company_name}</TableCell>
                      <TableCell className="text-right">{s.avg_rating.toFixed(1)} ⭐</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">{s.review_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Percent className="w-4 h-4" /> Highest Credit Utilization</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-40 w-full" /> : !stats.creditAlerts.length ? (
              <p className="text-sm text-muted-foreground">No clients above 80% utilization.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Limit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Utilization</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.creditAlerts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.company_name}</TableCell>
                      <TableCell className="text-right">{fmt(c.credit_limit)}</TableCell>
                      <TableCell className="text-right">{fmt(c.current_balance)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={c.utilization > 90 ? "destructive" : "secondary"}>
                          {c.utilization.toFixed(0)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Pending Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <PendingAction label="Product Approvals" count={stats?.pendingProducts ?? 0} href="/admin/products" loading={loading} />
            <PendingAction label="Quote Reviews" count={stats?.pendingQuotes ?? 0} href="/admin/quotes" loading={loading} />
            <PendingAction label="Pending Payouts" count={stats?.pendingPayouts ?? 0} href="/admin/payouts" loading={loading} />
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

const SummaryCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      <Icon className="w-5 h-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {value === null ? <Skeleton className="h-8 w-24" /> : (
        <p className="text-2xl font-bold text-foreground">{value}</p>
      )}
    </CardContent>
  </Card>
);

const PendingAction = ({ label, count, href, loading }: { label: string; count: number; href: string; loading: boolean }) => (
  <Link to={href} className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="h-6 w-8 mt-1" /> : (
        <p className="text-xl font-bold text-foreground">{count}</p>
      )}
    </div>
    <ArrowRight className="w-4 h-4 text-muted-foreground" />
  </Link>
);

export default AdminDashboard;

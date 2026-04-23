import ClientLayout from "@/components/client/ClientLayout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VatBadge, formatSAR } from "@/components/shared/VatBadge";
import { Wallet, CreditCard, Clock } from "lucide-react";

const ClientDashboard = () => {
  const { profile } = useAuth();

  return (
    <ClientLayout>
      <h1 className="font-display text-3xl font-bold text-foreground mb-6">Client Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Wallet className="w-4 h-4" /> Credit Limit</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatSAR(Number(profile?.credit_limit ?? 0))}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><CreditCard className="w-4 h-4" /> Current Balance</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${Number(profile?.current_balance ?? 0) < 0 ? "text-destructive" : ""}`}>{formatSAR(Number(profile?.current_balance ?? 0))}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4" /> Payment Terms</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold capitalize">{profile?.payment_terms?.replace("_", " ") ?? "—"}</p></CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;

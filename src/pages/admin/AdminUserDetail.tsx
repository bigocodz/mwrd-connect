import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Snowflake, Sun, Save } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AdminKycPanel } from "@/components/kyc/AdminKycPanel";
import { PreferredSupplierCard } from "@/components/users/PreferredSupplierCard";
import { SupplierScorecardPanel } from "@/components/admin/SupplierScorecardPanel";
import { StatementPanel } from "@/components/invoices/StatementPanel";
import { LegalEntityPanel } from "@/components/admin/LegalEntityPanel";
import { useLanguage } from "@/contexts/LanguageContext";

const AdminUserDetail = () => {
  const { tr } = useLanguage();
  const { userId } = useParams<{ userId: string }>();

  const profileData = useQuery(api.users.getById, userId ? { id: userId as any } : "skip");
  const updateProfile = useMutation(api.users.updateProfile);
  const freezeAccount = useMutation(api.users.freezeAccount);
  const unfreezeAccount = useMutation(api.users.unfreezeAccount);
  const logAudit = useMutation(api.auditLog.insert);

  const loading = profileData === undefined;
  const profile = profileData ?? null;

  const [status, setStatus] = useState("");
  const [kycStatus, setKycStatus] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [clientMargin, setClientMargin] = useState("");
  const [saving, setSaving] = useState(false);

  const [freezeOpen, setFreezeOpen] = useState(false);
  const [freezeReason, setFreezeReason] = useState("");
  const [freezing, setFreezing] = useState(false);

  useEffect(() => {
    if (profile) {
      setStatus(profile.status);
      setKycStatus(profile.kyc_status);
      setCreditLimit(String(profile.credit_limit ?? 0));
      setPaymentTerms(profile.payment_terms ?? "prepaid");
      setClientMargin(profile.client_margin != null ? String(profile.client_margin) : "");
    }
  }, [profile?._id]);

  const handleSave = async () => {
    if (!userId || !profile) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = { id: userId as any, status, kyc_status: kycStatus };
      if (profile.role === "CLIENT") {
        updates.credit_limit = parseFloat(creditLimit) || 0;
        updates.payment_terms = paymentTerms;
        updates.client_margin = clientMargin ? parseFloat(clientMargin) : null;
      }
      if (profile.status === "FROZEN" && status !== "FROZEN") {
        updates.frozen_at = null;
        updates.freeze_reason = null;
        updates.frozen_by = null;
      }
      await updateProfile(updates as any);
      await logAudit({ action: "UPDATE_PROFILE", target_user_id: userId as any, details: { status, kyc_status: kycStatus } });
      toast.success(tr("Profile updated"));
    } catch (err: any) {
      toast.error(tr("Failed to save:") + " " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFreeze = async () => {
    if (!userId) return;
    setFreezing(true);
    try {
      await freezeAccount({ id: userId as any, freeze_reason: freezeReason });
      await logAudit({ action: "FREEZE_ACCOUNT", target_user_id: userId as any, details: { reason: freezeReason } });
      toast.success(tr("Account frozen"));
      setFreezeOpen(false);
      setFreezeReason("");
    } catch (err: any) {
      toast.error(tr("Failed to freeze:") + " " + err.message);
    } finally {
      setFreezing(false);
    }
  };

  const handleUnfreeze = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await unfreezeAccount({ id: userId as any });
      await logAudit({ action: "UNFREEZE_ACCOUNT", target_user_id: userId as any, details: {} });
      toast.success(tr("Account unfrozen"));
    } catch (err: any) {
      toast.error(tr("Failed to unfreeze:") + " " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!profile) {
    return (
      <AdminLayout>
        <p className="text-muted-foreground">{tr("User not found.")}</p>
      </AdminLayout>
    );
  }

  const isClient = profile.role === "CLIENT";

  return (
    <AdminLayout>
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-6">
        <ArrowLeft className="w-4 h-4" /> {tr("Back to Users")}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">{profile.company_name || tr("Unknown")}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground font-mono">{profile.public_id}</span>
            <Badge variant="outline" className="capitalize">{profile.role.toLowerCase()}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {profile.status === "FROZEN" ? (
            <Button variant="outline" onClick={handleUnfreeze} disabled={saving}>
              <Sun className="w-4 h-4 me-1.5" /> {tr("Unfreeze")}
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setFreezeOpen(true)}>
              <Snowflake className="w-4 h-4 me-1.5" /> {tr("Freeze Account")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{tr("Account Settings")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{tr("Status")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">{tr("Active")}</SelectItem>
                  <SelectItem value="DEACTIVATED">{tr("Deactivated")}</SelectItem>
                  <SelectItem value="FROZEN">{tr("Frozen")}</SelectItem>
                  <SelectItem value="REQUIRES_ATTENTION">{tr("Requires Attention")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tr("KYC Status")}</Label>
              <Select value={kycStatus} onValueChange={setKycStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOMPLETE">{tr("Incomplete")}</SelectItem>
                  <SelectItem value="IN_REVIEW">{tr("In Review")}</SelectItem>
                  <SelectItem value="VERIFIED">{tr("Verified")}</SelectItem>
                  <SelectItem value="REJECTED">{tr("Rejected")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{tr("Created")}: {format(new Date(profile._creationTime), "PPpp")}</p>
              {profile.frozen_at && (
                <>
                  <p>{tr("Frozen at")}: {format(new Date(profile.frozen_at), "PPpp")}</p>
                  {profile.freeze_reason && <p>{tr("Reason")}: {profile.freeze_reason}</p>}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {isClient ? (
          <Card>
            <CardHeader><CardTitle>{tr("Financial Settings")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{tr("Credit Limit")}</Label>
                <Input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{tr("Current Balance")}</Label>
                <Input type="number" value={profile.current_balance ?? 0} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>{tr("Payment Terms")}</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="net_30">{tr("Net 30")}</SelectItem>
                    <SelectItem value="prepaid">{tr("Prepaid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tr("Client Margin Override (%)")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={tr("Leave empty for default")}
                  value={clientMargin}
                  onChange={(e) => setClientMargin(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>{tr("Profile Info")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">{tr("ID")}:</span> <span className="font-mono">{profile._id}</span></p>
              <p><span className="text-muted-foreground">{tr("Public ID")}:</span> {profile.public_id}</p>
              <p><span className="text-muted-foreground">{tr("Company")}:</span> {profile.company_name || "—"}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : <Save className="w-4 h-4 me-1.5" />}
          {tr("Save Changes")}
        </Button>
      </div>

      <div className="mt-6">
        <LegalEntityPanel profile={profile} />
      </div>

      {profile.role === "SUPPLIER" && (
        <>
          <div className="mt-6">
            <SupplierScorecardPanel profileId={profile._id} />
          </div>
          <div className="mt-6">
            <PreferredSupplierCard profile={profile} />
          </div>
        </>
      )}

      {profile.role === "CLIENT" && (
        <div className="mt-6">
          <StatementPanel mode="ADMIN" clientId={profile._id} />
        </div>
      )}

      <div className="mt-6">
        <AdminKycPanel profileId={profile._id} />
      </div>

      <Dialog open={freezeOpen} onOpenChange={setFreezeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Freeze Account")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {tr("This will freeze {company}'s account. They won't be able to access the portal.", { company: profile.company_name ?? "" })}
            </p>
            <div className="space-y-2">
              <Label>{tr("Reason")}</Label>
              <Textarea
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
                placeholder={tr("Explain why this account is being frozen...")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreezeOpen(false)}>{tr("Cancel")}</Button>
            <Button variant="destructive" onClick={handleFreeze} disabled={freezing || !freezeReason.trim()}>
              {freezing ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : <Snowflake className="w-4 h-4 me-1.5" />}
              {tr("Freeze Account")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUserDetail;

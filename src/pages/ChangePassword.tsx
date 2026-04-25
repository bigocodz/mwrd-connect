import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "@cvx/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

const ChangePassword = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const changePassword = useAction(api.users.changePassword);
  const { tr } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f4ed]">
        <Loader2 className="h-8 w-8 animate-spin text-[#c96442]" />
      </div>
    );
  }

  if (!profile) return <Navigate to="/login" replace />;

  // Already changed — bounce to role dashboard
  if (!profile.must_change_password) {
    const target =
      profile.role === "ADMIN"
        ? "/admin/dashboard"
        : profile.role === "SUPPLIER"
          ? "/supplier/dashboard"
          : "/client/dashboard";
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(tr("Password must be at least 8 characters"));
      return;
    }
    if (password !== confirm) {
      toast.error(tr("Passwords do not match"));
      return;
    }
    setSubmitting(true);
    try {
      await changePassword({ newPassword: password });
      toast.success(tr("Password updated"));
      const target =
        profile.role === "ADMIN"
          ? "/admin/dashboard"
          : profile.role === "SUPPLIER"
            ? "/supplier/dashboard"
            : "/client/dashboard";
      navigate(target, { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tr("Failed to update password"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4ed] px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f7e9e1] text-[#c96442] shadow-[0_0_0_1px_#eed1c5]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle>{tr("Set your password")}</CardTitle>
          <CardDescription>
            {tr("For security, please replace the temporary password from your welcome email before continuing.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{tr("New password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{tr("Confirm password")}</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : null}
              {tr("Update password")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePassword;

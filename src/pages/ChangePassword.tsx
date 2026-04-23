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

const ChangePassword = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const changePassword = useAction(api.users.changePassword);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword({ newPassword: password });
      toast.success("Password updated");
      const target =
        profile.role === "ADMIN"
          ? "/admin/dashboard"
          : profile.role === "SUPPLIER"
            ? "/supplier/dashboard"
            : "/client/dashboard";
      navigate(target, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6 text-accent" />
          </div>
          <CardTitle className="font-display text-2xl">Set your password</CardTitle>
          <CardDescription>
            For security, please replace the temporary password from your welcome email before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
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
              <Label htmlFor="confirm">Confirm password</Label>
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
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePassword;

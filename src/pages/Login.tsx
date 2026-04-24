import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useAuthActions } from "@convex-dev/auth/react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const { profile, loading: authLoading } = useAuth();
  const { signIn } = useAuthActions();

  if (!authLoading && profile) {
    const dest =
      profile.status !== "ACTIVE"
        ? "/account-status"
        : profile.role === "ADMIN"
          ? "/admin/dashboard"
          : profile.role === "SUPPLIER"
            ? "/supplier/dashboard"
            : "/client/dashboard";
    return <Navigate to={dest} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn("password", { email, password, flow: "signIn" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4ed] px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-[#5e5d59] hover:text-[#141413]">
          <ArrowLeft className="w-4 h-4" /> {t.getStarted.backHome}
        </Link>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#141413] text-[#faf9f5] shadow-[0_0_0_1px_#30302e]">
              <span className="font-display text-xl font-medium">M</span>
            </div>
            <CardTitle>{t.nav.login}</CardTitle>
            <CardDescription>Sign in to your MWRD portal</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t.getStarted.email}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-accent hover:underline">Forgot password?</Link>
                </div>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.nav.login}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;

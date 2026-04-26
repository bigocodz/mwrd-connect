import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthActions } from "@convex-dev/auth/react";
import { useLanguage } from "@/contexts/LanguageContext";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const emailFromUrl = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { signIn } = useAuthActions();
  const { tr } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(tr("Password must be at least 6 characters"));
      return;
    }
    setLoading(true);
    try {
      await signIn("password", { email, code, newPassword: password, flow: "reset-verification" });
      setDone(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tr("Invalid or expired code"));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f7] px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-10 pb-8">
            <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-[#ff6d43]" />
            <h2 className="mb-2 font-display text-[1.6rem] font-medium text-[#1a1a1a]">{tr("Password Updated")}</h2>
            <p className="mb-6 leading-relaxed text-[#5f625f]">{tr("Your password has been reset successfully.")}</p>
            <Button asChild><Link to="/login">{tr("Sign In")}</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8f7] px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle>{tr("Set New Password")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!emailFromUrl && (
              <div className="space-y-2">
                <Label htmlFor="email">{tr("Email")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">{tr("Verification Code")}</Label>
              <Input id="code" type="text" value={code} onChange={(e) => setCode(e.target.value)} required placeholder={tr("Code from email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{tr("New Password")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : tr("Update Password")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;

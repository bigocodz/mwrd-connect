import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthActions } from "@convex-dev/auth/react";
import { useLanguage } from "@/contexts/LanguageContext";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const { tr, dir } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn("password", { email, flow: "reset" });
      setSent(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tr("Failed to send reset email"));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f7] px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-10 pb-8">
            <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-[#ff6d43]" />
            <h2 className="mb-2 font-display text-[1.6rem] font-medium text-[#1a1a1a]">{tr("Check your email")}</h2>
            <p className="mb-6 leading-relaxed text-[#5f625f]">
              {tr("We sent a verification code to")} <strong>{email}</strong>. {tr("Enter it on the next page.")}
            </p>
            <Button onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)}>
              {tr("Enter Verification Code")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8f7] px-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="mb-6 inline-flex items-center gap-1 text-sm text-[#5f625f] hover:text-[#1a1a1a]">
          {dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />} {tr("Back to Login")}
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{tr("Reset Password")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{tr("Email")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : tr("Send Reset Code")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;

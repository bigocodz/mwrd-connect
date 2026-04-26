import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Languages } from "lucide-react";
import { toast } from "sonner";
import { useAuthActions } from "@convex-dev/auth/react";
import { useLanguage } from "@/contexts/LanguageContext";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const { tr, dir, lang, setLang } = useLanguage();

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

  const toggleLang = () => setLang(lang === "ar" ? "en" : "ar");

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f7] px-4" dir={dir}>
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f8f7] px-4" dir={dir}>
      {/* Language toggle bar */}
      <div className={`mb-6 flex w-full max-w-md ${dir === "rtl" ? "justify-start" : "justify-end"}`}>
        <button
          type="button"
          onClick={toggleLang}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#5f625f] transition-colors hover:bg-white hover:shadow-sm"
          aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        >
          <Languages className="h-4 w-4" />
          {lang === "ar" ? "EN" : "ع"}
        </button>
      </div>

      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1 text-sm text-[#5f625f] hover:text-[#1a1a1a]"
        >
          {dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          {tr("Back to Login")}
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{tr("Reset Password")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{tr("Email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={tr("Email")}
                  dir="ltr"
                />
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

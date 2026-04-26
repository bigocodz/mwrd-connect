import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, User, Languages } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useAuthActions } from "@convex-dev/auth/react";

type AuthPanelMode = "signIn" | "forgot" | "reset" | "updated";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [panelMode, setPanelMode] = useState<AuthPanelMode>("signIn");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const { tr, dir, lang, setLang } = useLanguage();
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
      toast.error(err instanceof Error ? err.message : tr("Invalid email or password"));
    } finally {
      setLoading(false);
    }
  };

  const openResetPanel = () => {
    setResetEmail(email);
    setResetCode("");
    setResetPassword("");
    setPanelMode("forgot");
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      await signIn("password", { email: resetEmail, flow: "reset" });
      setPanelMode("reset");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tr("Failed to send reset email"));
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPassword.length < 6) {
      toast.error(tr("Password must be at least 6 characters"));
      return;
    }
    setResetLoading(true);
    try {
      await signIn("password", {
        email: resetEmail,
        code: resetCode,
        newPassword: resetPassword,
        flow: "reset-verification",
      });
      setPanelMode("updated");
      setPassword("");
      setResetCode("");
      setResetPassword("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tr("Invalid or expired code"));
    } finally {
      setResetLoading(false);
    }
  };

  const returnToSignIn = () => {
    setPanelMode("signIn");
    setResetCode("");
    setResetPassword("");
  };

  const toggleLang = () => setLang(lang === "ar" ? "en" : "ar");

  return (
    <div className="min-h-screen bg-[#f7f8f7] px-4 py-6 sm:px-6 lg:px-8" dir={dir}>
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[24px] bg-white shadow-[0_34px_90px_rgba(26,26,26,0.12),0_0_0_1px_rgba(190,184,174,0.36)] lg:grid-cols-[1.05fr_0.95fr]">
        {/* ── Dark marketing panel ── */}
        <section
          className="relative hidden min-h-full flex-col justify-between overflow-hidden bg-[#1a1a1a] p-10 text-white lg:flex"
          dir={dir}
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(198,228,238,0.18)_0%,rgba(190,184,174,0.10)_42%,rgba(255,109,67,0.24)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,rgba(26,26,26,0.96),rgba(26,26,26,0))]" />
          <img src="/logos/asset-2.svg" alt="" className="pointer-events-none absolute -end-28 top-20 w-[520px] opacity-[0.08] invert" />

          <div className="relative z-10">
            <span className="inline-flex rounded-lg bg-white px-3 py-2.5 shadow-[0_14px_30px_rgba(0,0,0,0.22),inset_0_0_0_1px_rgba(190,184,174,0.45)]">
              <img src="/logos/asset-2.svg" alt="MWRD" className="h-9 w-auto max-w-[150px]" />
            </span>
            <p className="mt-3 text-xs text-white/60">{tr("Procurement workspace")}</p>
          </div>

          <div className="relative z-10 max-w-[460px]">
            <p className="mb-5 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#c6e4ee] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
              {tr("Managed B2B Marketplace")}
            </p>
            <h2 className="font-display text-[56px] font-semibold leading-[1.02] tracking-normal">
              {tr("Procurement control that stays human.")}
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/70">
              {tr("Managed RFQs, verified suppliers, and commercial control across every order.")}
            </p>
          </div>

          <div className="relative z-10 grid gap-3 xl:grid-cols-3">
            {[
              { label: tr("RFQs"), value: "18" },
              { label: tr("Savings"), value: "12%" },
              { label: tr("Weekly spend"), value: "897 SAR" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-white/[0.08] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
                <p className="text-xs font-semibold text-white/60">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Login form panel ── */}
        <section className="flex flex-col bg-white px-6 py-8 sm:px-10 sm:py-10 lg:px-14" dir={dir}>
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3">
              <img src="/logos/asset-2.svg" alt="MWRD" className="h-9 w-auto max-w-[128px]" />
            </Link>

            <div className="flex items-center gap-2">
              {/* Language toggle */}
              <button
                type="button"
                onClick={toggleLang}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#5f625f] transition-colors hover:bg-[#eef7f8] hover:text-[#1a1a1a]"
                aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
              >
                <Languages className="h-4 w-4" />
                {lang === "ar" ? "EN" : "ع"}
              </button>

              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#5f625f] transition-colors hover:bg-[#eef7f8] hover:text-[#1a1a1a]"
              >
                <User className="h-4 w-4" />
                {tr("Sign Up")}
              </Link>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
            <div key={panelMode} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {panelMode === "signIn" && (
                <>
                  <div className="mb-8 h-1 w-11 rounded-full bg-[#ff6d43]" />
                  <h1 className="font-display text-4xl font-semibold tracking-normal text-[#1a1a1a] sm:text-5xl">
                    {tr("Sign In")}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-[#5f625f]">
                    {tr("Secure access for clients, suppliers, and admins with portal-level controls.")}
                  </p>

                  <form onSubmit={handleLogin} className="mt-10 space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="sr-only">{tr("Email or Username")}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder={tr("Email or Username")}
                        className="h-12 px-4 text-base"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="sr-only">{tr("Password")}</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          placeholder={tr("Password")}
                          className="h-12 ps-4 pe-12 text-base"
                        />
                        <button
                          type="button"
                          className="absolute end-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8a8a85] transition-colors hover:bg-[#eef7f8] hover:text-[#1a1a1a]"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? tr("Hide password") : tr("Show password")}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className={`flex ${dir === "rtl" ? "justify-end" : "justify-start"}`}>
                        <button
                          type="button"
                          onClick={openResetPanel}
                          className="text-sm font-semibold text-[#ff6d43] hover:underline"
                        >
                          {tr("Forgot password?")}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" disabled={loading} className="h-12 w-full">
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {tr("Sign In")}
                          {dir === "rtl" ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                        </>
                      )}
                    </Button>

                    <div className="pt-2">
                      <Link
                        to="/"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[#5f625f] hover:text-[#1a1a1a]"
                      >
                        {dir === "rtl" ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                        {tr("Back to Home")}
                      </Link>
                    </div>
                  </form>
                </>
              )}

              {panelMode === "forgot" && (
                <>
                  <div className="mb-8 h-1 w-11 rounded-full bg-[#ff6d43]" />
                  <h1 className="font-display text-4xl font-semibold tracking-normal text-[#1a1a1a] sm:text-5xl">
                    {tr("Reset Password")}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-[#5f625f]">
                    {tr("Enter your email and we will send a verification code.")}
                  </p>

                  <form onSubmit={handleResetRequest} className="mt-10 space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email" className="sr-only">{tr("Email")}</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        placeholder={tr("Email")}
                        className="h-12 px-4 text-base"
                      />
                    </div>

                    <Button type="submit" disabled={resetLoading} className="h-12 w-full">
                      {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Send Reset Code")}
                    </Button>

                    <button
                      type="button"
                      onClick={returnToSignIn}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[#5f625f] hover:text-[#1a1a1a]"
                    >
                      {dir === "rtl" ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                      {tr("Back to Sign In")}
                    </button>
                  </form>
                </>
              )}

              {panelMode === "reset" && (
                <>
                  <div className="mb-8 h-1 w-11 rounded-full bg-[#ff6d43]" />
                  <h1 className="font-display text-4xl font-semibold tracking-normal text-[#1a1a1a] sm:text-5xl">
                    {tr("Check your email")}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-[#5f625f]">
                    {tr("We sent a verification code to")} <strong>{resetEmail}</strong>.
                  </p>

                  <form onSubmit={handleResetPassword} className="mt-10 space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="reset-code" className="sr-only">{tr("Verification Code")}</Label>
                      <Input
                        id="reset-code"
                        type="text"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        required
                        placeholder={tr("Verification Code")}
                        className="h-12 px-4 text-base"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reset-password" className="sr-only">{tr("New Password")}</Label>
                      <Input
                        id="reset-password"
                        type="password"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder={tr("New Password")}
                        className="h-12 px-4 text-base"
                      />
                    </div>

                    <Button type="submit" disabled={resetLoading} className="h-12 w-full">
                      {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Update Password")}
                    </Button>

                    <button
                      type="button"
                      onClick={() => setPanelMode("forgot")}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[#5f625f] hover:text-[#1a1a1a]"
                    >
                      {dir === "rtl" ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                      {tr("Use another email")}
                    </button>
                  </form>
                </>
              )}

              {panelMode === "updated" && (
                <>
                  <CheckCircle2 className="mb-5 h-14 w-14 text-[#ff6d43]" />
                  <h1 className="font-display text-4xl font-semibold tracking-normal text-[#1a1a1a] sm:text-5xl">
                    {tr("Password Updated")}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-[#5f625f]">
                    {tr("Your password has been reset successfully.")}
                  </p>
                  <Button type="button" onClick={returnToSignIn} className="mt-10 h-12 w-full">
                    {tr("Sign In")}
                    {dir === "rtl" ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;

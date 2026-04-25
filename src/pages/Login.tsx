import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useAuthActions } from "@convex-dev/auth/react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const { profile, loading: authLoading } = useAuth();
  const { signIn } = useAuthActions();

  const signInHeadline = useMemo(() => {
    const value = t.nav.login || "Sign In";
    return value.toLowerCase() === "login" ? "Sign In" : value;
  }, [t.nav.login]);

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
    <div className="min-h-screen bg-[#f5f4ed] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center">
        <div className="w-full overflow-hidden rounded-[28px] bg-[#1f1e1c] shadow-[0_30px_120px_rgba(0,0,0,0.18)]">
          <div className="grid lg:grid-cols-2">
            <div className="relative hidden flex-col justify-between p-12 text-[#faf9f5] lg:flex">
              <div className="relative z-10">
                <p className="max-w-sm text-sm text-[#c9c7be]">
                  Managed RFQs, verified suppliers, and commercial control across every order.
                </p>
              </div>

              <div className="relative z-10">
                <div className="pointer-events-none absolute -left-14 -top-12 h-[420px] w-[420px] rounded-full border border-[#faf9f5]/10" />
                <div className="pointer-events-none absolute -left-4 -top-2 h-[280px] w-[280px] rounded-full border border-[#faf9f5]/10" />
                <h2 className="font-display text-[68px] font-semibold leading-[0.95] tracking-tight">
                  Manage
                  <br />
                  your spend
                </h2>
              </div>

              <div className="relative z-10 mt-12 flex items-end justify-between gap-8">
                <div className="relative h-[340px] w-[220px] rotate-[-11deg] overflow-hidden rounded-[34px] bg-[#0f0f0e] shadow-[0_40px_100px_rgba(0,0,0,0.55)]">
                  <div className="absolute left-1/2 top-4 h-3 w-16 -translate-x-1/2 rounded-full bg-[#1a1a19]" />
                  <div className="px-6 pb-6 pt-12">
                    <p className="text-xs text-[#c9c7be]">Weekly spend</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">897.00</p>
                    <p className="text-xs text-[#87867f]">SAR</p>

                    <div className="mt-7 grid grid-cols-7 items-end gap-1">
                      {[9, 12, 10, 18, 16, 20, 14].map((value, index) => (
                        <div
                          key={index}
                          className="rounded-full bg-gradient-to-t from-[#ff4d2d] to-[#ff3d7f]"
                          style={{ height: `${value * 6}px` }}
                        />
                      ))}
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-[#171716] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-[#87867f]">RFQs</p>
                        <p className="mt-1 text-sm font-medium">18</p>
                      </div>
                      <div className="rounded-2xl bg-[#171716] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-[#87867f]">Savings</p>
                        <p className="mt-1 text-sm font-medium">12%</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hidden max-w-[180px] pb-4 text-xs text-[#c9c7be] xl:block">
                  Secure access for clients, suppliers, and admins with portal-level controls.
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 opacity-70">
                <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#faf9f5]/5 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#faf9f5]/5 blur-3xl" />
              </div>
            </div>

            <div className="bg-white px-6 py-10 sm:px-10 sm:py-12 lg:rounded-l-[84px] lg:px-14 lg:py-14">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#141413] text-[#faf9f5] shadow-[0_0_0_1px_#30302e]">
                    <span className="font-display text-lg font-medium">M</span>
                  </div>
                  <span className="font-display text-lg font-semibold text-[#141413]">MWRD</span>
                </div>

                <div className="flex items-center gap-4">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-sm text-[#5e5d59] hover:text-[#141413]"
                  >
                    <User className="h-4 w-4" />
                    Sign Up
                  </Link>
                </div>
              </div>

              <div className="mx-auto mt-14 w-full max-w-md">
                <h1 className="font-display text-5xl font-semibold tracking-tight text-[#141413] sm:text-6xl">
                  {signInHeadline}
                </h1>

                <form onSubmit={handleLogin} className="mt-12 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="sr-only">{t.getStarted.email}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Email or Username"
                      className="h-14 rounded-full border-[#d1cfc5] bg-white px-6 text-base shadow-none focus-visible:ring-[#ff4d2d]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="sr-only">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Password"
                        className="h-14 rounded-full border-[#d1cfc5] bg-white px-6 pr-14 text-base shadow-none focus-visible:ring-[#ff4d2d]"
                      />
                      <button
                        type="button"
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-[#87867f] transition-colors hover:text-[#141413]"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex justify-start">
                      <Link to="/forgot-password" className="text-sm text-[#c96442] hover:underline">
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-14 w-full rounded-full bg-gradient-to-r from-[#ff4d2d] to-[#ff3d7f] text-[#faf9f5] shadow-[0_18px_50px_rgba(255,61,127,0.25)] hover:from-[#ff3f22] hover:to-[#ff2f73]"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                          <ArrowRight className="h-4 w-4" />
                        </span>
                        {t.nav.login}
                      </>
                    )}
                  </Button>

                  <div className="pt-2">
                    <Link
                      to="/"
                      className="inline-flex items-center gap-1 text-sm text-[#5e5d59] hover:text-[#141413]"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      {t.getStarted.backHome}
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

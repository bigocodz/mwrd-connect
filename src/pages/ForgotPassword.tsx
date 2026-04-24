import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthActions } from "@convex-dev/auth/react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { signIn } = useAuthActions();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn("password", { email, flow: "reset" });
      setSent(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f4ed] px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-10 pb-8">
            <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-[#c96442]" />
            <h2 className="mb-2 font-display text-[1.6rem] font-medium text-[#141413]">Check your email</h2>
            <p className="mb-6 leading-relaxed text-[#5e5d59]">
              We sent a verification code to <strong>{email}</strong>. Enter it on the next page.
            </p>
            <Button onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)}>
              Enter Verification Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4ed] px-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="mb-6 inline-flex items-center gap-1 text-sm text-[#5e5d59] hover:text-[#141413]">
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Reset Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Code"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;

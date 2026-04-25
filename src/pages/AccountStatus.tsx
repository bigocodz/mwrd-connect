import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, XCircle, Snowflake, AlertTriangle, ShieldOff } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const statusConfig: Record<string, { icon: React.ReactNode; title: string; desc: string; color: string }> = {
  PENDING: {
    icon: <Clock className="w-16 h-16" />,
    title: "Account Under Review",
    desc: "Your account is being reviewed by our team. You'll receive an email once approved. This usually takes 1–2 business days.",
    color: "text-[#9d5f2b]",
  },
  REJECTED: {
    icon: <XCircle className="w-16 h-16" />,
    title: "Account Rejected",
    desc: "Unfortunately, your account application was not approved. Please contact support@mwrd.com for more information.",
    color: "text-[#b53333]",
  },
  FROZEN: {
    icon: <Snowflake className="w-16 h-16" />,
    title: "Account Frozen",
    desc: "Your account has been temporarily frozen. Please contact support@mwrd.com to resolve this.",
    color: "text-[#5e5d59]",
  },
  DEACTIVATED: {
    icon: <ShieldOff className="w-16 h-16" />,
    title: "Account Deactivated",
    desc: "Your account has been deactivated. Please contact support@mwrd.com if you'd like to reactivate it.",
    color: "text-[#87867f]",
  },
  REQUIRES_ATTENTION: {
    icon: <AlertTriangle className="w-16 h-16" />,
    title: "Action Required",
    desc: "Your account needs attention. Please contact support@mwrd.com or check your email for instructions.",
    color: "text-[#c96442]",
  },
};

const AccountStatus = () => {
  const { profile, loading, signOut } = useAuth();
  const { tr } = useLanguage();

  if (loading) return null;

  if (!profile || profile.status === "ACTIVE") {
    return <Navigate to="/" replace />;
  }

  const config = statusConfig[profile.status] || statusConfig.PENDING;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4ed] px-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8">
          <div className={`mx-auto mb-4 ${config.color}`}>{config.icon}</div>
          <h2 className="mb-2 font-display text-[1.6rem] font-medium text-[#141413]">{tr(config.title)}</h2>
          <p className="mb-2 leading-relaxed text-[#5e5d59]">{tr(config.desc)}</p>
          {profile.status === "FROZEN" && profile.freeze_reason && (
            <p className="mb-4 text-sm text-[#5e5d59]">{tr("Reason:")} {profile.freeze_reason}</p>
          )}
          <div className="mt-6">
            <Button variant="outline" onClick={signOut}>{tr("Sign out")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountStatus;

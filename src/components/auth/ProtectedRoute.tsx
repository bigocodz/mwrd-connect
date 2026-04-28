import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

type Role = "CLIENT" | "SUPPLIER" | "ADMIN" | "AUDITOR";

type Props = {
  children: React.ReactNode;
  allowedRoles?: Role[];
};

const ProtectedRoute = ({ children, allowedRoles }: Props) => {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  const blockedStatuses = ["PENDING", "REJECTED", "FROZEN", "DEACTIVATED", "REQUIRES_ATTENTION"];
  if (blockedStatuses.includes(profile.status)) {
    return <Navigate to="/account-status" replace />;
  }

  // AUDITOR (PRD §13.4) is a read-only mirror of ADMIN — wherever an admin
  // route is declared, an auditor is admitted too. Mutations are blocked
  // server-side by `requireAdmin`, so the route exposure is safe.
  const effectiveAllowed: Role[] | undefined = allowedRoles?.includes("ADMIN")
    ? Array.from(new Set<Role>([...allowedRoles, "AUDITOR"]))
    : allowedRoles;

  if (effectiveAllowed && !effectiveAllowed.includes(profile.role as Role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

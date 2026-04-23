import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

type Props = {
  children: React.ReactNode;
  allowedRoles?: ("CLIENT" | "SUPPLIER" | "ADMIN")[];
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

  const blockedStatuses = ["PENDING", "REJECTED", "FROZEN", "DEACTIVATED", "REQUIRES_ATTENTION"];
  if (blockedStatuses.includes(profile.status)) {
    return <Navigate to="/account-status" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

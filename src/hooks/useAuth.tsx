import { createContext, useContext, ReactNode } from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";

type Profile = {
  _id: string;
  role: "CLIENT" | "SUPPLIER" | "ADMIN";
  status: "PENDING" | "ACTIVE" | "REJECTED" | "REQUIRES_ATTENTION" | "DEACTIVATED" | "FROZEN";
  kyc_status: "INCOMPLETE" | "IN_REVIEW" | "VERIFIED" | "REJECTED";
  company_name?: string;
  public_id?: string;
  credit_limit?: number;
  current_balance?: number;
  payment_terms?: "net_30" | "prepaid";
  client_margin?: number;
  frozen_at?: number;
  freeze_reason?: string;
  must_change_password?: boolean;
};

type AuthContextType = {
  profile: Profile | null | undefined;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut: convexSignOut } = useAuthActions();
  const profile = useQuery(api.users.getMyProfile) as Profile | null | undefined;

  const loading = isLoading || (isAuthenticated && profile === undefined);

  const signOut = async () => {
    await convexSignOut();
  };

  return (
    <AuthContext.Provider value={{ profile, loading, signOut, refreshProfile: () => {} }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

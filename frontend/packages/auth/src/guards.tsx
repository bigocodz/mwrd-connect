import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import type { Role, Scope } from "./types";

interface RequireAuthProps {
  children: ReactNode;
  scope?: Scope;
  roles?: Role[];
  fallback: ReactNode;
  loading?: ReactNode;
  forbidden?: ReactNode;
}

/** Renders `children` only if the user is authenticated, has the required scope,
 * and (if provided) has one of the allowed roles. Otherwise renders `fallback`. */
export function RequireAuth({
  children,
  scope,
  roles,
  fallback,
  loading = null,
  forbidden,
}: RequireAuthProps) {
  const auth = useAuth();
  if (auth.status === "loading") return <>{loading}</>;
  if (auth.status === "anonymous" || auth.me === null) return <>{fallback}</>;

  if (scope && auth.me.scope !== scope) {
    return <>{forbidden ?? fallback}</>;
  }
  if (roles && roles.length > 0) {
    if (!auth.me.role || !roles.includes(auth.me.role)) {
      return <>{forbidden ?? fallback}</>;
    }
  }
  return <>{children}</>;
}

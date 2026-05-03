import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "./client";
import type { LoginResponse, MeResponse } from "./types";

interface AuthState {
  status: "loading" | "anonymous" | "authenticated";
  me: MeResponse | null;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  customerLogin: (email: string, password: string) => Promise<void>;
  staffLogin: (email: string, password: string, otp: string) => Promise<void>;
  staffEnrollStart: (
    email: string,
    password: string
  ) => Promise<{ provisioning_uri: string; secret: string }>;
  staffEnrollConfirm: (email: string, password: string, otp: string) => Promise<void>;
  signupFromInvite: (
    token: string,
    full_name: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    me: null,
    error: null,
  });

  const reload = useCallback(async () => {
    try {
      const me = await api<MeResponse>("/api/auth/me");
      setState({ status: "authenticated", me, error: null });
    } catch (e) {
      const error = e instanceof ApiError && e.status === 401 ? null : (e as Error).message;
      setState({ status: "anonymous", me: null, error });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const customerLogin = useCallback(
    async (email: string, password: string) => {
      await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      await reload();
    },
    [reload]
  );

  const staffLogin = useCallback(
    async (email: string, password: string, otp: string) => {
      await api<{ ok: true }>("/api/auth/staff/login", {
        method: "POST",
        body: { email, password, otp },
      });
      await reload();
    },
    [reload]
  );

  const staffEnrollStart = useCallback(
    async (email: string, password: string) =>
      api<{ provisioning_uri: string; secret: string }>(
        "/api/auth/staff/enroll/start",
        { method: "POST", body: { email, password } }
      ),
    []
  );

  const staffEnrollConfirm = useCallback(
    async (email: string, password: string, otp: string) => {
      await api<{ ok: true }>("/api/auth/staff/enroll/confirm", {
        method: "POST",
        body: { email, password, otp },
      });
      await reload();
    },
    [reload]
  );

  const signupFromInvite = useCallback(
    async (token: string, full_name: string, password: string) => {
      await api<LoginResponse>("/api/auth/signup-from-invite", {
        method: "POST",
        body: { token, full_name, password },
      });
      await reload();
    },
    [reload]
  );

  const logout = useCallback(async () => {
    try {
      await api<void>("/api/auth/logout", { method: "POST" });
    } finally {
      setState({ status: "anonymous", me: null, error: null });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      customerLogin,
      staffLogin,
      staffEnrollStart,
      staffEnrollConfirm,
      signupFromInvite,
      logout,
      reload,
    }),
    [
      state,
      customerLogin,
      staffLogin,
      staffEnrollStart,
      staffEnrollConfirm,
      signupFromInvite,
      logout,
      reload,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

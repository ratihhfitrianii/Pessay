/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getMe, login as apiLogin } from "../lib/api";
import type { AuthUser } from "../lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  booting: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("pessay.token");
    if (!token) {
      setBooting(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await apiLogin(identifier, password);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("pessay.token");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, booting, login, logout }),
    [user, booting, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}

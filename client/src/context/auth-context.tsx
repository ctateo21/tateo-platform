import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getSession, isAuthHydrated, logout as authLogout, subscribeAuthChange, type AuthUser } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  // True until the first Supabase hydration completes. Use this to avoid
  // flashing "signed out" UI before we actually know.
  isLoading: boolean;
  refresh: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  refresh: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getSession);
  const [isLoading, setIsLoading] = useState<boolean>(() => !isAuthHydrated());

  useEffect(() => {
    // Pick up the initial hydrated session and react to sign-in/sign-out.
    setUser(getSession());
    setIsLoading(!isAuthHydrated());
    const unsub = subscribeAuthChange(() => {
      setUser(getSession());
      setIsLoading(!isAuthHydrated());
    });
    return () => { unsub(); };
  }, []);

  const refresh = useCallback(() => {
    setUser(getSession());
    setIsLoading(!isAuthHydrated());
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getSession, logout as authLogout, subscribeAuthChange, type AuthUser } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  refresh: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  refresh: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getSession);

  useEffect(() => {
    // Pick up the initial hydrated session and react to sign-in/sign-out.
    setUser(getSession());
    const unsub = subscribeAuthChange(() => setUser(getSession()));
    return () => { unsub(); };
  }, []);

  const refresh = useCallback(() => setUser(getSession()), []);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

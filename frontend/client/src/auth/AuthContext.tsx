import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api, type Role } from "../api/client";
type User = { name: string; email: string; role: Role };
type AuthValue = { user: User | null; token: string | null; login: (email: string, password: string, requestedRole: Role) => Promise<User>; logout: () => void; loading: boolean };
const AuthContext = createContext<AuthValue | null>(null);
export const DEMO_ACCOUNTS: Record<Role, { name: string; email: string; password: string }> = {
  manufacturer: { name: "Manufacturer A", email: "manu_a", password: "mpass123" },
  distributor: { name: "Distributor A", email: "dist_a", password: "dpass123" },
  pharmacy: { name: "Hospital A", email: "hosp_a", password: "hpass123" },
};
function normalizeRole(role: Role | "hospital"): Role { return role === "hospital" ? "pharmacy" : role; }
function readStoredUser(): User | null { try { const raw = JSON.parse(localStorage.getItem("pharma_user") || "null"); return raw?.role ? { ...raw, role: normalizeRole(raw.role) } : null; } catch { return null; } }
function isDemoCredentials(email: string, password: string, role: Role) { const account = DEMO_ACCOUNTS[role]; return email.trim().toLowerCase() === account.email.toLowerCase() && password === account.password; }
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("pharma_token"));
  const [loading, setLoading] = useState(false);
  const login = async (email: string, password: string, requestedRole: Role) => {
    setLoading(true);
    try {
      let result: { token: string; user: { name: string; email: string; role: Role | "hospital" } };
      try {
        result = await api.auth.login(email.trim(), password, requestedRole);
      } catch (apiErr) {
        if (isDemoCredentials(email, password, requestedRole)) {
          result = { token: `demo-token-${requestedRole}`, user: { ...DEMO_ACCOUNTS[requestedRole], role: requestedRole } };
        } else {
          throw apiErr;
        }
      }
      const authenticatedUser: User = { ...result.user, role: normalizeRole(result.user.role) };
      if (authenticatedUser.role !== requestedRole) {
        throw new Error(`This account is authorized for the ${authenticatedUser.role} workspace, not ${requestedRole}.`);
      }
      setUser(authenticatedUser);
      setToken(result.token);
      localStorage.setItem("pharma_token", result.token);
      localStorage.setItem("pharma_user", JSON.stringify(authenticatedUser));
      return authenticatedUser;
    } finally {
      setLoading(false);
    }
  };
  const logout = () => { setUser(null); setToken(null); localStorage.removeItem("pharma_token"); localStorage.removeItem("pharma_user"); };
  const value = useMemo(() => ({ user, token, login, logout, loading }), [user, token, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; }

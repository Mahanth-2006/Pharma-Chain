import { Redirect } from "wouter";
import { useAuth } from "./AuthContext";
import type { Role } from "../api/client";

export default function ProtectedRoute({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Redirect to="/login" />;
  if (roles && !roles.includes(user.role)) return <Redirect to={`/${user.role}`} />;
  return <>{children}</>;
}

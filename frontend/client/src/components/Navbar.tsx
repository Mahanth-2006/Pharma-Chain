import { Activity, Bell, LogOut, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../auth/AuthContext";
export default function Navbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  if (!user) return null;
  return (
    <header className="top-nav glass">
      <Link href={`/${user.role}`} className="brand">
        <span className="brand-mark">
          <ShieldCheck size={16} />
        </span>
        <span>
          Pharma-Chain<small>provenance control</small>
        </span>
      </Link>
      <nav className="nav-links">
        <Link
          href={`/${user.role}`}
          className={`nav-link ${location === `/${user.role}` ? "active" : ""}`}
        >
          Workspace
        </Link>
      </nav>
      <div className="nav-user">
        <Bell size={15} color="#91a6a4" />
        <span className="mono" style={{ fontSize: 10, color: "#91a6a4" }}>
          {user.role}
        </span>
        <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
        <button className="icon-btn" onClick={logout} aria-label="Log out">
          <LogOut size={15} />
        </button>
      </div>
      <Activity size={0} />
    </header>
  );
}

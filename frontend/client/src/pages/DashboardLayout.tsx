import { type ReactNode } from "react";
import AnimatedBackground from "../components/AnimatedBackground";
import CustomCursor from "../components/CustomCursor";
import Navbar from "../components/Navbar";
import TextEffect from "../components/TextEffect";
import { useAuth } from "../auth/AuthContext";

export default function DashboardLayout({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { user } = useAuth();
  return (
    <div className="app-shell">
      <AnimatedBackground />
      <CustomCursor />
      <Navbar />
      <main className="app-main">
        <div className="page-header fade-up">
          <div>
            <div className="eyebrow">
              <span className="live-dot" /> <TextEffect>{eyebrow}</TextEffect> · {user?.role}
            </div>
            <h1 className="headline">{title}</h1>
            <p>
              <TextEffect>{description}</TextEffect>
            </p>
          </div>
          {action}
        </div>
        {children}
      </main>
    </div>
  );
}

import { type ReactNode } from "react";
import AnimatedBackground from "../components/AnimatedBackground";
import CustomCursor from "../components/CustomCursor";
import InfiniteSlider, { PharmaLogo } from "../components/InfiniteSlider";
import Navbar from "../components/Navbar";
import TextEffect from "../components/TextEffect";
import ProgressiveBlur from "../components/ProgressiveBlur";
import { useAuth } from "../auth/AuthContext";
const pharmaCompanies = [
  { name: "Pfizer", src: "/manus-storage/pfizer_15121bf7.png" },
  { name: "Roche", src: "/manus-storage/roche_00928a0e.png" },
  { name: "Novartis", src: "/manus-storage/novartis_c3501167.png" },
  { name: "Merck", src: "/manus-storage/merck_79a5cc5b.png" },
  { name: "Sanofi", src: "/manus-storage/sanofi_33fc399c.png" },
  { name: "AstraZeneca", src: "/manus-storage/astrazeneca_57a0ffac.png" },
];
export default function DashboardLayout({ eyebrow, title, description, action, children }: { eyebrow: string; title: ReactNode; description: string; action?: ReactNode; children: ReactNode }) { const { user } = useAuth(); return <div className="app-shell"><AnimatedBackground /><CustomCursor /><Navbar /><main className="app-main"><div className="page-header fade-up"><div><div className="eyebrow"><span className="live-dot" /> <TextEffect>{eyebrow}</TextEffect> · {user?.role}</div><h1 className="headline">{title}</h1><p><TextEffect>{description}</TextEffect></p></div>{action}</div><div className="network-rail fade-up delay-1"><span className="network-rail-label">VERIFIED NETWORK / 06 PARTNERS</span><div className="network-slider-frame"><InfiniteSlider gap={34} reverse>{pharmaCompanies.map(company => <PharmaLogo key={company.name} {...company} />)}</InfiniteSlider><ProgressiveBlur className="network-blur network-blur-left" direction="left" blurIntensity={1} /><ProgressiveBlur className="network-blur network-blur-right" direction="right" blurIntensity={1} /></div></div>{children}</main></div>; }

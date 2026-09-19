import { useEffect, useState } from "react";
export default function AnimatedBackground() {
  const [offset, setOffset] = useState(0);
  useEffect(() => { const onScroll = () => setOffset(window.scrollY); window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll); }, []);
  return <><div className="ambient" style={{ transform: `translate3d(0, ${offset * -.035}px, 0) rotate(${offset * .003}deg)` }}><div className="orb orb-a" /><div className="orb orb-b" /><div className="orb orb-c" /></div><div className="noise" /></>;
}

import { useEffect, useState } from "react";
export default function CustomCursor() {
  const [point, setPoint] = useState({ x: -100, y: -100 }); const [hover, setHover] = useState(false);
  useEffect(() => { const move = (e: MouseEvent) => setPoint({ x: e.clientX, y: e.clientY }); const over = (e: MouseEvent) => setHover(!!(e.target as HTMLElement).closest("button,a,input,select,textarea")); window.addEventListener("mousemove", move); window.addEventListener("mouseover", over); return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseover", over); }; }, []);
  return <div className={`custom-cursor ${hover ? "hover" : ""}`} style={{ left: point.x, top: point.y }}><div className="cursor-ring" /><div className="cursor-dot" /></div>;
}

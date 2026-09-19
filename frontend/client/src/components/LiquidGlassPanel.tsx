import type { CSSProperties, ReactNode } from "react";
export default function LiquidGlassPanel({ children, className = "", hover = false, style }: { children: ReactNode; className?: string; hover?: boolean; style?: CSSProperties }) { return <section style={style} className={`glass panel ${hover ? "glass-hover" : ""} ${className}`}>{children}</section>; }

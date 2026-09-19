import { CheckCircle2 } from "lucide-react";
export default function FraudAlertBanner() { return <div className="alert neutral-status"><CheckCircle2 size={18} color="#7ef3cd" /><div><strong>Custody event recorded</strong><p>The latest handoff is visible in the chain history.</p></div></div>; }

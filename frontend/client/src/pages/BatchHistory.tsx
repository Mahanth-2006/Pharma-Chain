import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Hash,
  ShieldCheck,
  Factory,
  Truck,
  PackageCheck,
  AlertCircle
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import LiquidGlassPanel from "../components/LiquidGlassPanel";
import AnimatedBackground from "../components/AnimatedBackground";
import CustomCursor from "../components/CustomCursor";
import Navbar from "../components/Navbar";

export default function BatchHistory() {
  const [, params] = useRoute("/history/:id");
  const batchId = params?.id || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    api.batches
      .getById(batchId)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err?.message || `Could not find batch '${batchId}' on blockchain.`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [batchId]);

  const copy = () => {
    if (!batchId) return;
    navigator.clipboard?.writeText(batchId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    const ms = timestamp > 1e11 ? timestamp : timestamp * 1000;
    return new Date(ms).toLocaleString();
  };

  const iconFor = (stage: string) => {
    if (stage === "mint") return <Factory size={16} />;
    if (stage === "distribute") return <Truck size={16} />;
    return <PackageCheck size={16} />;
  };

  return (
    <div className="app-shell">
      <AnimatedBackground />
      <CustomCursor />
      <Navbar />

      <main className="app-main">
        <Link href="/manufacturer" className="btn btn-ghost fade-up">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <div className="page-header fade-up delay-1" style={{ marginTop: 24 }}>
          <div>
            <div className="eyebrow">
              <span className="live-dot" /> Live Blockchain Provenance Record
            </div>
            <h1 className="headline">Medicine Custody Trail</h1>
            <p>Cryptographically validated blocks tracking custody from manufacturing to final dispensing.</p>
          </div>
          {data?.blockchain?.chain_verified && (
            <span className="badge" style={{ color: "#7ef3cd", borderColor: "rgba(126,243,205,0.4)" }}>
              <CheckCircle2 size={13} /> Chain Validated
            </span>
          )}
        </div>

        {loading ? (
          <LiquidGlassPanel>
            <div style={{ textAlign: "center", padding: 40, color: "#91a6a4" }}>
              Verifying blockchain blocks for {batchId}...
            </div>
          </LiquidGlassPanel>
        ) : error ? (
          <LiquidGlassPanel>
            <div style={{ textAlign: "center", padding: 40, color: "#ff7b72" }}>
              <AlertCircle size={28} style={{ margin: "0 auto 10px" }} />
              <h3>{error}</h3>
              <p style={{ color: "#91a6a4", fontSize: 12 }}>
                Ensure this batch has been minted into the blockchain before tracking provenance.
              </p>
            </div>
          </LiquidGlassPanel>
        ) : data ? (
          <>
            <div className="grid grid-2" style={{ alignItems: "start", marginBottom: 20 }}>
              <LiquidGlassPanel className="fade-up delay-2">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div className="stat-label">Batch identifier</div>
                    <h2 className="mono" style={{ margin: "10px 0 0", fontSize: 22, color: "#7ef3cd" }}>
                      {data.batch_id}
                    </h2>
                  </div>
                  <button className="icon-btn" onClick={copy} aria-label="Copy batch ID">
                    <Copy size={15} />
                  </button>
                </div>

                <div className="grid grid-3" style={{ marginTop: 24 }}>
                  <div>
                    <div className="stat-label">Product</div>
                    <strong style={{ display: "block", marginTop: 6, fontSize: 13 }}>
                      {data.metadata?.drug_name || "N/A"}
                    </strong>
                  </div>
                  <div>
                    <div className="stat-label">Dosage</div>
                    <strong style={{ display: "block", marginTop: 6, fontSize: 13 }}>
                      {data.metadata?.dosage || "Standard"}
                    </strong>
                  </div>
                  <div>
                    <div className="stat-label">Expiry</div>
                    <strong style={{ display: "block", marginTop: 6, fontSize: 13 }}>
                      {data.metadata?.expiry_date || "N/A"}
                    </strong>
                  </div>
                </div>

                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(159,208,202,.1)" }}>
                  <div className="eyebrow">
                    <ShieldCheck size={13} /> Current Chain State
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
                    <strong style={{ fontSize: 24, color: "#7ef3cd", textTransform: "uppercase" }}>
                      {data.blockchain?.current_stage || "Minted"}
                    </strong>
                    <span className="mono" style={{ color: "#91a6a4", fontSize: 11 }}>
                      Owner: {data.blockchain?.current_owner || "Manufacturer"}
                    </span>
                  </div>
                </div>
                {copied && <div className="badge" style={{ marginTop: 12 }}>Copied to clipboard</div>}
              </LiquidGlassPanel>

              <LiquidGlassPanel className="fade-up delay-3">
                <div className="eyebrow">
                  <Hash size={13} /> Chain Integrity
                </div>
                <h2 style={{ margin: "10px 0 6px", fontSize: 18 }}>Proof of Authority Consensus</h2>
                <p style={{ margin: 0, color: "#91a6a4", fontSize: 12, lineHeight: 1.6 }}>
                  Total On-Chain Transactions: <strong>{data.blockchain?.total_transactions || 0}</strong>
                  <br />
                  Every custody event is cryptographically signed using RSA-2048 private keys and validated by consortium validators.
                </p>

                <div
                  className="mono"
                  style={{
                    marginTop: 18,
                    padding: 14,
                    color: "#7ef3cd",
                    borderRadius: 8,
                    background: "rgba(0,0,0,.25)",
                    fontSize: 10,
                    lineHeight: 1.8,
                    wordBreak: "break-all",
                  }}
                >
                  {data.blockchain?.history?.map((h: any, i: number) => (
                    <div key={i}>
                      Block #{h.block_index}: {h.block_hash ? h.block_hash.slice(0, 32) + "..." : "Genesis Anchor"}
                    </div>
                  ))}
                </div>
              </LiquidGlassPanel>
            </div>

            <LiquidGlassPanel className="fade-up">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div className="eyebrow">Sequential Verification</div>
                  <h2 style={{ margin: "6px 0 0", fontSize: 20 }}>Custody Handoffs in Sequence</h2>
                </div>
                <span className="mono" style={{ color: "#91a6a4", fontSize: 11 }}>
                  {data.blockchain?.history?.length || 0} BLOCKS MINED
                </span>
              </div>

              <div className="timeline">
                {data.blockchain?.history?.map((step: any, idx: number) => (
                  <div className="timeline-item" key={idx}>
                    <div className="timeline-dot" />
                    <div className="timeline-top">
                      <span className="timeline-title">
                        {iconFor(step.stage)} Stage: {step.stage?.toUpperCase()}
                      </span>
                      <span className="timeline-time">{formatDate(step.timestamp)}</span>
                    </div>
                    <div className="timeline-copy">
                      Custody Transferred: <span className="mono">{step.from_actor}</span> → <span className="mono">{step.to_actor}</span>
                      <br />
                      Recorded in Block #{step.block_index}
                    </div>
                    {step.block_hash && (
                      <span className="timeline-hash mono">
                        <CheckCircle2 size={11} style={{ verticalAlign: "-2px" }} /> Hash: {step.block_hash}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </LiquidGlassPanel>
          </>
        ) : null}
      </main>
    </div>
  );
}

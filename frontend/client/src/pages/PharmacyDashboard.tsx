import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Hash,
  Key,
  Layers,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  Clock,
  User,
  FileText,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import LiquidGlassPanel from "../components/LiquidGlassPanel";
import DashboardLayout from "./DashboardLayout";

interface BlockTransaction {
  batch_id: string;
  drug_name: string;
  from_actor: string;
  to_actor: string;
  stage: string;
  timestamp?: number;
  signature?: string;
  actor_public_key?: string;
}

interface BlockData {
  index: number;
  previous_hash: string;
  timestamp: number;
  validator: string;
  transactions: BlockTransaction[];
  hash: string;
}

interface BatchRecord {
  batch_id: string;
  drug_name: string;
  dosage: string;
  manufacturing_date: string;
  expiry_date: string;
  stage: string;
  owner: string;
}

interface BatchTraceData {
  batch_id: string;
  metadata: {
    drug_name: string;
    manufacturer: string;
    manufacturing_date: string;
    expiry_date: string;
    composition?: string;
    dosage?: string;
    pack_size?: string;
    therapeutic_class?: string;
  };
  blockchain: {
    current_stage: string;
    current_owner: string;
    is_authentic: boolean;
    chain_verified: boolean;
    total_transactions: number;
    history: Array<{
      batch_id: string;
      drug_name: string;
      from_actor: string;
      to_actor: string;
      stage: string;
      timestamp: number;
      signature?: string;
      actor_public_key?: string;
      block_index?: number;
      block_hash?: string;
      previous_hash?: string;
      validator?: string;
      block_timestamp?: number;
    }>;
  };
}

export default function PharmacyDashboard() {
  // Modal & Flow State
  const [modalOpen, setModalOpen] = useState(false);
  const [inspectBatchId, setInspectBatchId] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [inspectedBatch, setInspectedBatch] = useState<BatchTraceData | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Verification Code State
  const [verificationCode, setVerificationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    batchId: string;
    blockHeight: number;
    blockHash: string;
  } | null>(null);

  // Feedback States
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Blockchain Explorer State with local storage persistence
  const [chain, setChain] = useState<BlockData[]>(() => {
    try {
      const cached = localStorage.getItem("pharma_chain_cache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [chainValid, setChainValid] = useState<boolean>(true);
  const [loadingChain, setLoadingChain] = useState<boolean>(false);

  // Real Batches State with local storage persistence
  const [batches, setBatches] = useState<BatchRecord[]>(() => {
    try {
      const cached = localStorage.getItem("pharma_batches_cache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loadingBatches, setLoadingBatches] = useState<boolean>(false);

  // Trace Modal State
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<BatchTraceData | null>(null);

  // Load Blockchain and Batches
  const loadData = async () => {
    setLoadingChain(true);
    setLoadingBatches(true);
    try {
      const [chainRes, batchesRes] = await Promise.all([
        api.blockchain.getChain().catch((e) => {
          console.error("Chain fetch failed", e);
          return null;
        }),
        api.batches.getAll().catch((e) => {
          console.error("Batches fetch failed", e);
          return null;
        }),
      ]);

      if (chainRes && Array.isArray(chainRes.chain)) {
        setChain(chainRes.chain);
        setChainValid(chainRes.is_valid);
        try {
          localStorage.setItem("pharma_chain_cache", JSON.stringify(chainRes.chain));
        } catch {}
      }
      if (batchesRes && Array.isArray(batchesRes.batches)) {
        setBatches(batchesRes.batches);
        try {
          localStorage.setItem("pharma_batches_cache", JSON.stringify(batchesRes.batches));
        } catch {}
      }
    } finally {
      setLoadingChain(false);
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Inspect Batch by ID
  const handleInspectBatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedId = inspectBatchId.trim();
    if (!trimmedId) {
      setInspectError("Please enter a valid Batch ID.");
      return;
    }

    setInspecting(true);
    setInspectError(null);
    setInspectedBatch(null);
    setActionError(null);
    try {
      const data = await api.batches.getById(trimmedId);
      setInspectedBatch(data);
    } catch (err: any) {
      setInspectError(err?.message || `Batch '${trimmedId}' not found on blockchain.`);
    } finally {
      setInspecting(false);
    }
  };

  // Submit Verification & Record Final Receipt / Purchase
  const handleVerifyAndPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const trimmedCode = verificationCode.trim();
    if (!trimmedCode) {
      setActionError("Please enter the 10-digit verification code provided by Distributor.");
      return;
    }
    if (trimmedCode.length !== 10 || !/^\d{10}$/.test(trimmedCode)) {
      setActionError("Verification code must be exactly 10 numeric digits.");
      return;
    }

    if (!inspectedBatch) {
      setActionError("Please inspect the batch first.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.batches.addPurchase({
        batch_id: inspectedBatch.batch_id,
        verification_code: trimmedCode,
      });

      setSuccessResult({
        batchId: res.batchId,
        blockHeight: res.blockHeight,
        blockHash: res.blockHash,
      });

      setVerificationCode("");
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || "Verification failed. Please check the 10-digit code.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Trace Modal
  const handleOpenTrace = async (id: string) => {
    if (!id) return;
    setSelectedBatchId(id);
    setTraceModalOpen(true);
    setTraceLoading(true);
    setTraceError(null);
    setBatchDetail(null);
    try {
      const data = await api.batches.getById(id);
      setBatchDetail(data);
    } catch (err: any) {
      setTraceError(err?.message || `Could not load history for batch ${id}`);
    } finally {
      setTraceLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    const ms = timestamp > 1e11 ? timestamp : timestamp * 1000;
    return new Date(ms).toLocaleString();
  };

  // Metrics
  const readyToPurchaseBatches = batches.filter((b) => b.stage === "distribute");
  const completedBatches = batches.filter((b) => b.stage === "purchase");

  return (
    <DashboardLayout
      eyebrow="HOSPITAL & PHARMACY CONSOLE"
      title={<>Verify & Receive Inbound <em>Medicines.</em></>}
      description="Inspect distributor custody blocks, verify 10-digit proof-of-transaction codes, and seal the final dispensing block into the immutable ledger."
      action={
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="btn btn-ghost"
            onClick={loadData}
            disabled={loadingChain}
            title="Refresh Blockchain"
          >
            <RefreshCw size={14} className={loadingChain ? "animate-spin" : ""} />
            Sync Chain
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setModalOpen(true);
              setSuccessResult(null);
              setInspectedBatch(null);
              setInspectError(null);
              setActionError(null);
            }}
          >
            <PackageCheck size={15} /> Verify & Record Purchase
          </button>
        </div>
      }
    >
      {/* Real Live Metrics Bar */}
      <div className="grid grid-4 fade-up delay-1" style={{ marginBottom: 28 }}>
        <LiquidGlassPanel hover>
          <div className="stat-label">Total Blocks</div>
          <div className="stat-value" style={{ color: "#7ef3cd" }}>{chain.length}</div>
          <div className="stat-meta">Verified blockchain ledger</div>
        </LiquidGlassPanel>

        <LiquidGlassPanel hover>
          <div className="stat-label">Ready to Receive</div>
          <div className="stat-value">{readyToPurchaseBatches.length}</div>
          <div className="stat-meta">In transit from distributor</div>
        </LiquidGlassPanel>

        <LiquidGlassPanel hover>
          <div className="stat-label">Dispensed & Verified</div>
          <div className="stat-value" style={{ color: "#7ef3cd" }}>{completedBatches.length}</div>
          <div className="stat-meta good">Complete chain custody</div>
        </LiquidGlassPanel>

        <LiquidGlassPanel hover>
          <div className="stat-label">Chain Health</div>
          <div className="stat-value" style={{ color: chainValid ? "#7ef3cd" : "#ff7b72" }}>
            {chainValid ? "100%" : "FAULT"}
          </div>
          <div className="stat-meta good">Proof of Authority</div>
        </LiquidGlassPanel>
      </div>

      {/* LIVE BLOCKCHAIN LEDGER */}
      <div style={{ marginBottom: 36 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <div className="eyebrow">
              <Layers size={12} /> Distributed Ledger
            </div>
            <h2 style={{ margin: "6px 0 0", fontSize: 20 }}>
              Live Blockchain Blocks ({chain.length})
            </h2>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span
              className="badge"
              style={{
                borderColor: chainValid ? "rgba(126,243,205,0.4)" : "rgba(255,100,100,0.4)",
                color: chainValid ? "#7ef3cd" : "#ff7b72",
              }}
            >
              <ShieldCheck size={12} />
              {chainValid ? "Chain Verified" : "Tamper Detected"}
            </span>
          </div>
        </div>

        {chain.length === 0 ? (
          <LiquidGlassPanel>
            <div style={{ textAlign: "center", padding: "30px 20px", color: "#91a6a4" }}>
              No blocks found on chain.
            </div>
          </LiquidGlassPanel>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {[...chain].reverse().map((block) => (
              <LiquidGlassPanel key={block.index} className="fade-up">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid rgba(159, 208, 202, 0.08)",
                    paddingBottom: 10,
                    marginBottom: 12,
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      className="mono"
                      style={{
                        background: "rgba(126, 243, 205, 0.12)",
                        color: "#7ef3cd",
                        padding: "3px 10px",
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      BLOCK #{block.index}
                    </span>
                    {block.index === 0 && (
                      <span className="badge">GENESIS</span>
                    )}
                    <span className="mono" style={{ color: "#91a6a4", fontSize: 11 }}>
                      Validator: <strong style={{ color: "#edf4f3" }}>{block.validator}</strong>
                    </span>
                  </div>
                  <div className="mono" style={{ color: "#91a6a4", fontSize: 11 }}>
                    Timestamp: {formatDate(block.timestamp)}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 12,
                    fontSize: 11,
                  }}
                >
                  <div style={{ background: "rgba(0,0,0,0.2)", padding: "8px 12px", borderRadius: 6 }}>
                    <div style={{ color: "#91a6a4", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                      <span>BLOCK HASH</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(block.hash)}
                        className="icon-btn"
                        style={{ width: 18, height: 18 }}
                        title="Copy Hash"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                    <div className="mono" style={{ color: "#7ef3cd", wordBreak: "break-all", fontSize: 10 }}>
                      {block.hash}
                    </div>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.2)", padding: "8px 12px", borderRadius: 6 }}>
                    <div style={{ color: "#91a6a4", marginBottom: 4 }}>PREVIOUS HASH</div>
                    <div className="mono" style={{ color: "#91a6a4", wordBreak: "break-all", fontSize: 10 }}>
                      {block.previous_hash}
                    </div>
                  </div>
                </div>

                {/* Transactions in Block */}
                <div>
                  <div className="stat-label" style={{ marginBottom: 8, fontSize: 10 }}>
                    Transactions in Block ({block.transactions.length})
                  </div>
                  {block.transactions.length === 0 ? (
                    <div className="mono" style={{ fontSize: 11, color: "#91a6a4", fontStyle: "italic" }}>
                      Genesis Block - Initial Chain Anchor
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {block.transactions.map((tx, txIdx) => (
                        <div
                          key={txIdx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 10,
                            padding: "10px 14px",
                            borderRadius: 8,
                            background: "rgba(159, 208, 202, 0.04)",
                            border: "1px solid rgba(159, 208, 202, 0.08)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span
                              className="badge"
                              style={{ textTransform: "uppercase", fontWeight: 700, fontSize: 9 }}
                            >
                              {tx.stage}
                            </span>
                            <div>
                              <strong style={{ fontSize: 13, color: "#edf4f3" }}>
                                {tx.drug_name || "Medicine Batch"}
                              </strong>
                              <div className="mono" style={{ fontSize: 11, color: "#7ef3cd" }}>
                                Batch ID: {tx.batch_id}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11 }}>
                            <div className="mono" style={{ color: "#91a6a4" }}>
                              {tx.from_actor} → {tx.to_actor}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenTrace(tx.batch_id)}
                              className="btn btn-ghost"
                              style={{ minHeight: 30, padding: "0 12px", fontSize: 11 }}
                            >
                              Trace
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </LiquidGlassPanel>
            ))}
          </div>
        )}
      </div>

      {/* VERIFY & PURCHASE MODAL */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(0, 5, 6, 0.85)",
            backdropFilter: "blur(10px)",
          }}
        >
          <LiquidGlassPanel
            className="fade-up"
            style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 28 } as any}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid rgba(159, 208, 202, 0.12)",
                paddingBottom: 14,
                marginBottom: 20,
              }}
            >
              <div>
                <div className="eyebrow" style={{ color: "#7ef3cd" }}>
                  <PackageCheck size={13} style={{ verticalAlign: "-2px" }} /> FINAL INBOUND VERIFICATION
                </div>
                <h2 style={{ margin: "6px 0 0", fontSize: 20 }}>Verify & Receive Inbound Batch</h2>
              </div>
              <button
                className="icon-btn"
                onClick={() => {
                  setModalOpen(false);
                  setSuccessResult(null);
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Success State */}
            {successResult ? (
              <div>
                <div
                  style={{
                    background: "rgba(126, 243, 205, 0.08)",
                    border: "1px solid rgba(126, 243, 205, 0.4)",
                    borderRadius: 12,
                    padding: 24,
                    marginBottom: 24,
                    textAlign: "center",
                  }}
                >
                  <CheckCircle2 size={40} color="#7ef3cd" style={{ margin: "0 auto 12px" }} />
                  <h3 style={{ margin: "0 0 6px", fontSize: 20, color: "#edf4f3" }}>
                    Receipt Verified & Sealed on Blockchain!
                  </h3>
                  <p style={{ margin: "0 0 16px", fontSize: 13, color: "#91a6a4", lineHeight: 1.5 }}>
                    Final dispensing block has been cryptographically signed and added to the ledger under Proof of Authority.
                  </p>
                  <div
                    className="mono"
                    style={{ fontSize: 13, color: "#7ef3cd", fontWeight: 700 }}
                  >
                    Block Height: #{successResult.blockHeight} · Batch ID: {successResult.batchId}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "#91a6a4", marginTop: 6, wordBreak: "break-all" }}>
                    {successResult.blockHash}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setModalOpen(false);
                      setSuccessResult(null);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Step 1: Batch Search */}
                <form onSubmit={handleInspectBatch} style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#91a6a4", marginBottom: 6, fontWeight: 600 }}>
                    STEP 1: ENTER BATCH ID
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. BATCH-2026-001"
                      value={inspectBatchId}
                      onChange={(e) => setInspectBatchId(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn btn-ghost" disabled={inspecting}>
                      <Search size={14} />
                      {inspecting ? "Inspecting..." : "Inspect Block"}
                    </button>
                  </div>
                </form>

                {inspectError && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: "rgba(255, 100, 100, 0.1)",
                      border: "1px solid rgba(255, 100, 100, 0.3)",
                      color: "#ff7b72",
                      fontSize: 12,
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <AlertCircle size={15} />
                    {inspectError}
                  </div>
                )}

                {/* Inspected Block Details from Distributor */}
                {inspectedBatch && (
                  <div
                    className="fade-up"
                    style={{
                      background: "rgba(0, 0, 0, 0.25)",
                      border: "1px solid rgba(159, 208, 202, 0.15)",
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span className="eyebrow" style={{ color: "#7ef3cd" }}>
                        <CheckCircle2 size={12} /> Distributor Block Found
                      </span>
                      <span
                        className="badge"
                        style={{
                          textTransform: "uppercase",
                          color: inspectedBatch.blockchain.current_stage === "distribute" ? "#7ef3cd" : "#ffb356",
                        }}
                      >
                        Stage: {inspectedBatch.blockchain.current_stage || "None"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ color: "#91a6a4", fontSize: 10 }}>PRODUCT</div>
                        <strong style={{ color: "#edf4f3" }}>{inspectedBatch.metadata.drug_name}</strong>
                      </div>
                      <div>
                        <div style={{ color: "#91a6a4", fontSize: 10 }}>DOSAGE</div>
                        <span className="mono" style={{ color: "#edf4f3" }}>{inspectedBatch.metadata.dosage || "Standard"}</span>
                      </div>
                      <div>
                        <div style={{ color: "#91a6a4", fontSize: 10 }}>CURRENT OWNER</div>
                        <span style={{ color: "#edf4f3" }}>{inspectedBatch.blockchain.current_owner || "dist_a"}</span>
                      </div>
                      <div>
                        <div style={{ color: "#91a6a4", fontSize: 10 }}>TOTAL TRANSACTIONS</div>
                        <span className="mono" style={{ color: "#edf4f3" }}>{inspectedBatch.blockchain.total_transactions} on-chain</span>
                      </div>
                    </div>

                    {inspectedBatch.blockchain.current_stage !== "distribute" ? (
                      <div
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "rgba(255, 179, 86, 0.1)",
                          border: "1px solid rgba(255, 179, 86, 0.3)",
                          color: "#ffb356",
                          fontSize: 11,
                        }}
                      >
                        This batch is at stage '{inspectedBatch.blockchain.current_stage}'. Only batches in 'distribute' stage can be purchased/dispensed.
                      </div>
                    ) : (
                      /* Step 2: Verification Code Form */
                      <form onSubmit={handleVerifyAndPurchase} style={{ marginTop: 16 }}>
                        <label style={{ display: "block", fontSize: 11, color: "#91a6a4", marginBottom: 6, fontWeight: 600 }}>
                          STEP 2: ENTER 10-DIGIT VERIFICATION CODE (FROM DISTRIBUTOR)
                        </label>
                        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                          <input
                            type="text"
                            maxLength={10}
                            className="input mono"
                            placeholder="e.g. 7192840192"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                            style={{ flex: 1, letterSpacing: "0.15em", fontSize: 16, fontWeight: 700 }}
                          />
                        </div>

                        {actionError && (
                          <div
                            style={{
                              padding: "8px 12px",
                              borderRadius: 6,
                              background: "rgba(255, 100, 100, 0.1)",
                              border: "1px solid rgba(255, 100, 100, 0.3)",
                              color: "#ff7b72",
                              fontSize: 12,
                              marginBottom: 12,
                            }}
                          >
                            {actionError}
                          </div>
                        )}

                        <button
                          type="submit"
                          className="btn btn-primary full"
                          disabled={submitting || verificationCode.length !== 10}
                        >
                          <ShieldCheck size={15} />
                          {submitting ? "Signing & Mining Final Block..." : "Verify Code & Record Final Receipt"}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </LiquidGlassPanel>
        </div>
      )}

      {/* TRACE MODAL */}
      {traceModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(0, 5, 6, 0.78)",
            backdropFilter: "blur(8px)",
          }}
        >
          <LiquidGlassPanel
            className="fade-up"
            style={{ maxWidth: 600, width: "100%", maxHeight: "90vh", overflowY: "auto" } as any}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid rgba(159, 208, 202, 0.12)",
                paddingBottom: 14,
                marginBottom: 16,
              }}
            >
              <div>
                <div className="eyebrow">BLOCKCHAIN AUDIT TRAIL</div>
                <h2 style={{ margin: "4px 0 0", fontSize: 18 }}>Batch Trace: {selectedBatchId}</h2>
              </div>
              <button className="icon-btn" onClick={() => setTraceModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {traceLoading ? (
              <div style={{ textAlign: "center", padding: 30, color: "#91a6a4" }}>Loading trace...</div>
            ) : traceError ? (
              <div style={{ padding: 14, color: "#ff7b72" }}>{traceError}</div>
            ) : batchDetail ? (
              <div>
                <div style={{ marginBottom: 16, fontSize: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ color: "#91a6a4", fontSize: 10 }}>MEDICINE</div>
                    <strong>{batchDetail.metadata.drug_name}</strong>
                  </div>
                  <div>
                    <div style={{ color: "#91a6a4", fontSize: 10 }}>DOSAGE</div>
                    <span className="mono">{batchDetail.metadata.dosage || "Standard"}</span>
                  </div>
                </div>

                <div className="timeline" style={{ marginTop: 16 }}>
                  {batchDetail.blockchain.history.map((tx, idx) => (
                    <div key={idx} className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-top">
                        <span className="timeline-title" style={{ textTransform: "uppercase" }}>
                          Stage: {tx.stage}
                        </span>
                        <span className="timeline-time">{formatDate(tx.timestamp)}</span>
                      </div>
                      <div className="timeline-copy">
                        From: <span className="mono">{tx.from_actor}</span> → To: <span className="mono">{tx.to_actor}</span>
                        {tx.block_hash && (
                          <div className="mono" style={{ fontSize: 10, color: "#7ef3cd", marginTop: 4 }}>
                            Block #{tx.block_index}: {tx.block_hash.slice(0, 18)}...
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </LiquidGlassPanel>
        </div>
      )}
    </DashboardLayout>
  );
}

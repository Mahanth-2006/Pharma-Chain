import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Hash,
  Key,
  Layers,
  Plus,
  RefreshCw,
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

export default function ManufacturerDashboard() {
  // Modal & Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Exactly the 5 required fields
  const [batchId, setBatchId] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [dosage, setDosage] = useState("");
  const [manufactureDate, setManufactureDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  // Feedback States
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Blockchain Explorer State (Read-Only)
  const [chain, setChain] = useState<BlockData[]>([]);
  const [chainValid, setChainValid] = useState<boolean>(true);
  const [loadingChain, setLoadingChain] = useState<boolean>(false);

  // Real Batches State
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [loadingBatches, setLoadingBatches] = useState<boolean>(false);

  // Trace Popup State
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<BatchTraceData | null>(null);

  // 10-Digit Verification Code Modal State
  const [codeModalData, setCodeModalData] = useState<{
    batchId: string;
    code: string;
    title: string;
    description: string;
  } | null>(null);

  const handleViewCode = async (bId: string) => {
    try {
      const res = await api.batches.getVerificationCode(bId);
      if (res && res.code) {
        setCodeModalData({
          batchId: bId,
          code: res.code,
          title: "Proof-of-Transaction Code",
          description: "Provide this 10-digit code to Distributor A to authorize custody transfer.",
        });
      } else {
        alert(`No active verification code for batch ${bId}. (Stage: ${res.current_stage || "unknown"})`);
      }
    } catch (e: any) {
      alert(e?.message || "Could not retrieve verification code.");
    }
  };

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

      if (chainRes) {
        setChain(chainRes.chain || []);
        setChainValid(chainRes.is_valid);
      }
      if (batchesRes) {
        setBatches(batchesRes.batches || []);
      }
    } finally {
      setLoadingChain(false);
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Form Submit Handler
  const handleMintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate Required Fields
    const trimmedId = batchId.trim();
    const trimmedName = medicineName.trim();
    const trimmedDosage = dosage.trim();

    if (!trimmedId) {
      setErrorMessage("Batch ID is required.");
      return;
    }
    if (!trimmedName) {
      setErrorMessage("Medicine Name is required.");
      return;
    }
    if (!trimmedDosage) {
      setErrorMessage("Dosage is required.");
      return;
    }
    if (!manufactureDate) {
      setErrorMessage("Manufacture Date is required.");
      return;
    }
    if (!expiryDate) {
      setErrorMessage("Expiry Date is required.");
      return;
    }

    if (new Date(expiryDate) <= new Date(manufactureDate)) {
      setErrorMessage("Expiry Date must be after Manufacture Date.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.batches.mint({
        batch_id: trimmedId,
        medicine_name: trimmedName,
        dosage: trimmedDosage,
        manufacture_date: manufactureDate,
        expiry_date: expiryDate,
      });

      // After success:
      // - Show: ‘Medicine batch successfully minted to the blockchain.’
      // - Clear the form.
      setSuccessMessage(
        result.message || "Medicine batch successfully minted to the blockchain."
      );

      if (result.verification_code) {
        setCodeModalData({
          batchId: trimmedId,
          code: result.verification_code,
          title: "Batch Minted — 10-Digit Distributor Verification Code",
          description: "Provide this 10-digit proof-of-transaction code to Distributor A to authorize custody transfer.",
        });
      }

      setBatchId("");
      setMedicineName("");
      setDosage("");
      setManufactureDate("");
      setExpiryDate("");
      setModalOpen(false);

      // Refresh blockchain and batch records immediately
      await loadData();
    } catch (err: any) {
      // Show an error if Batch ID already exists or any validation fails
      setErrorMessage(
        err?.message || "Failed to mint batch to blockchain. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Open Trace Modal Handler
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

  return (
    <DashboardLayout
      eyebrow="MANUFACTURER CONSOLE"
      title={<>Mint to the <em>Blockchain.</em></>}
      description="Cryptographically create and sign genesis medicine batches into the immutable chain with Proof of Authority."
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
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> Mint New Batch
          </button>
        </div>
      }
    >
      {/* Alert Banners */}
      {successMessage && (
        <div
          className="fade-up"
          style={{
            marginBottom: "20px",
            padding: "16px 20px",
            borderRadius: "12px",
            border: "1px solid rgba(126, 243, 205, 0.4)",
            background: "rgba(126, 243, 205, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#edf4f3",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <CheckCircle2 size={20} color="#7ef3cd" />
            <div>
              <strong style={{ display: "block", color: "#7ef3cd", fontSize: "14px" }}>
                {successMessage}
              </strong>
              <span style={{ fontSize: "12px", color: "#91a6a4" }}>
                The block has been validated and appended to the chain ledger.
              </span>
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={() => setSuccessMessage(null)}
            aria-label="Dismiss alert"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          className="fade-up"
          style={{
            marginBottom: "20px",
            padding: "16px 20px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 141, 131, 0.4)",
            background: "rgba(255, 141, 131, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#edf4f3",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <AlertCircle size={20} color="#ff8d83" />
            <div>
              <strong style={{ display: "block", color: "#ff8d83", fontSize: "14px" }}>
                Minting Error
              </strong>
              <span style={{ fontSize: "12px", color: "#ff8d83" }}>{errorMessage}</span>
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss alert"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Overview Status Bar */}
      <div className="grid grid-2 fade-up delay-1" style={{ marginBottom: 24 }}>
        <LiquidGlassPanel hover>
          <div className="stat-label">Chain Height</div>
          <div className="stat-value">{chain.length} Blocks</div>
          <div className="stat-meta good">
            {chainValid ? "✓ Tamper-proof verified" : "⚠ Chain mismatch detected"}
          </div>
        </LiquidGlassPanel>

        <LiquidGlassPanel hover>
          <div className="stat-label">Registered Batches</div>
          <div className="stat-value">{batches.length}</div>
          <div className="stat-meta">Active batches in PostgreSQL & Blockchain</div>
        </LiquidGlassPanel>
      </div>

      {/* READ-ONLY BLOCKCHAIN EXPLORER */}
      <div style={{ marginBottom: 32 }}>
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
              <Layers size={12} /> Live Blockchain Explorer (Read-Only)
            </div>
            <h2 style={{ margin: "6px 0 0", fontSize: 20 }}>
              Immutable Blocks Ledger
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              className={`badge ${chainValid ? "" : "danger"}`}
              style={{ padding: "6px 12px" }}
            >
              <ShieldCheck size={12} />
              {chainValid ? "Chain Cryptographically Valid" : "Tamper Alert"}
            </span>
          </div>
        </div>

        {chain.length === 0 ? (
          <LiquidGlassPanel>
            <div style={{ textAlign: "center", padding: "30px 20px", color: "#91a6a4" }}>
              {loadingChain ? "Loading blockchain blocks..." : "No blocks found in the chain."}
            </div>
          </LiquidGlassPanel>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {/* Display blocks in reverse order (newest blocks first) */}
            {[...chain].reverse().map((block) => (
              <LiquidGlassPanel key={block.index} className="fade-up">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 12,
                    borderBottom: "1px solid rgba(159, 208, 202, 0.1)",
                    paddingBottom: 14,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        className="mono"
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#7ef3cd",
                          background: "rgba(126, 243, 205, 0.12)",
                          padding: "2px 8px",
                          borderRadius: 6,
                        }}
                      >
                        Block #{block.index}
                      </span>
                      {block.index === 0 && (
                        <span className="badge">GENESIS</span>
                      )}
                      <span className="mono" style={{ fontSize: 11, color: "#91a6a4" }}>
                        Validator: <strong>{block.validator}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="mono" style={{ fontSize: 11, color: "#91a6a4" }}>
                    {formatDate(block.timestamp)}
                  </div>
                </div>

                {/* Block Hashes */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 12,
                    fontSize: 11,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      background: "rgba(0,0,0,0.2)",
                      padding: "10px 14px",
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        color: "#91a6a4",
                        marginBottom: 4,
                      }}
                    >
                      <span>BLOCK HASH</span>
                      <button
                        className="icon-btn"
                        style={{ width: 22, height: 22 }}
                        onClick={() => copyToClipboard(block.hash)}
                        title="Copy Hash"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                    <div
                      className="mono"
                      style={{
                        color: "#7ef3cd",
                        wordBreak: "break-all",
                        fontSize: 10,
                      }}
                    >
                      {block.hash}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(0,0,0,0.2)",
                      padding: "10px 14px",
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        color: "#91a6a4",
                        marginBottom: 4,
                      }}
                    >
                      PREVIOUS HASH
                    </div>
                    <div
                      className="mono"
                      style={{
                        color: "#91a6a4",
                        wordBreak: "break-all",
                        fontSize: 10,
                      }}
                    >
                      {block.previous_hash}
                    </div>
                  </div>
                </div>

                {/* Transactions in Block */}
                <div>
                  <div
                    className="stat-label"
                    style={{ marginBottom: 8, fontSize: 10 }}
                  >
                    Transactions in Block ({block.transactions.length})
                  </div>
                  {block.transactions.length === 0 ? (
                    <div
                      className="mono"
                      style={{ fontSize: 11, color: "#91a6a4", fontStyle: "italic" }}
                    >
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
                              style={{
                                textTransform: "uppercase",
                                fontWeight: 700,
                                fontSize: 9,
                              }}
                            >
                              {tx.stage}
                            </span>
                            <div>
                              <strong style={{ fontSize: 13, color: "#edf4f3" }}>
                                {tx.drug_name || "Medicine Batch"}
                              </strong>
                              <div
                                className="mono"
                                style={{ fontSize: 11, color: "#7ef3cd" }}
                              >
                                Batch ID: {tx.batch_id}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 16,
                              fontSize: 11,
                            }}
                          >
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

      {/* REGISTERED MEDICINE BATCHES (REAL DATA ONLY) */}
      <div style={{ marginBottom: 32 }}>
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
              <Hash size={12} /> Production Inventory
            </div>
            <h2 style={{ margin: "6px 0 0", fontSize: 20 }}>
              Minted Batches Registry
            </h2>
          </div>
          <span className="mono" style={{ color: "#91a6a4", fontSize: 11 }}>
            {batches.length} BATCHES
          </span>
        </div>

        {batches.length === 0 ? (
          <LiquidGlassPanel>
            <div
              style={{
                textAlign: "center",
                padding: "36px 20px",
                color: "#91a6a4",
              }}
            >
              <p style={{ margin: "0 0 16px", fontSize: 14 }}>
                No medicine batches minted yet.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setModalOpen(true)}
              >
                <Plus size={14} /> Mint First Batch
              </button>
            </div>
          </LiquidGlassPanel>
        ) : (
          <LiquidGlassPanel>
            <div className="table-wrap">
              <div
                className="table-head"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1.2fr 0.8fr 1fr 1fr 0.8fr 0.8fr",
                  gap: 12,
                }}
              >
                <span>BATCH ID</span>
                <span>MEDICINE NAME</span>
                <span>DOSAGE</span>
                <span>MFG DATE</span>
                <span>EXPIRY DATE</span>
                <span>STAGE</span>
                <span>ACTION</span>
              </div>
              {batches.map((b) => (
                <div
                  key={b.batch_id}
                  className="table-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1.2fr 0.8fr 1fr 1fr 0.8fr 0.8fr",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <span className="mono" style={{ color: "#7ef3cd", fontWeight: 600 }}>
                    {b.batch_id}
                  </span>
                  <span style={{ fontWeight: 600 }}>{b.drug_name}</span>
                  <span className="mono" style={{ color: "#91a6a4" }}>
                    {b.dosage || "N/A"}
                  </span>
                  <span className="mono" style={{ color: "#91a6a4" }}>
                    {b.manufacturing_date}
                  </span>
                  <span className="mono" style={{ color: "#91a6a4" }}>
                    {b.expiry_date}
                  </span>
                  <span>
                    <span className="badge">{b.stage || "minted"}</span>
                  </span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenTrace(b.batch_id)}
                      className="btn btn-ghost"
                      style={{ minHeight: 28, padding: "0 10px", fontSize: 11 }}
                    >
                      Trace
                    </button>
                    {b.stage === "mint" && (
                      <button
                        type="button"
                        onClick={() => handleViewCode(b.batch_id)}
                        className="btn btn-primary"
                        style={{ minHeight: 28, padding: "0 8px", fontSize: 11 }}
                        title="View 10-Digit Distributor Verification Code"
                      >
                        <Key size={11} /> Code
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </LiquidGlassPanel>
        )}
      </div>

      {/* 10-DIGIT VERIFICATION CODE POPUP MODAL */}
      {codeModalData && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(0, 5, 6, 0.85)",
            backdropFilter: "blur(10px)",
          }}
        >
          <LiquidGlassPanel
            className="fade-up"
            style={{ maxWidth: 520, width: "100%", padding: 28 } as any}
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
                  <Key size={13} style={{ verticalAlign: "-2px" }} /> PROOF OF TRANSACTION
                </div>
                <h2 style={{ margin: "6px 0 0", fontSize: 18 }}>
                  {codeModalData.title}
                </h2>
              </div>
              <button
                className="icon-btn"
                onClick={() => setCodeModalData(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "#91a6a4", marginBottom: 6 }}>
                BATCH IDENTIFIER
              </div>
              <div
                className="mono"
                style={{ fontSize: 16, fontWeight: 700, color: "#edf4f3" }}
              >
                {codeModalData.batchId}
              </div>
            </div>

            <div
              style={{
                background: "rgba(126, 243, 205, 0.08)",
                border: "1px solid rgba(126, 243, 205, 0.3)",
                borderRadius: 12,
                padding: "20px",
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#7ef3cd",
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                10-Digit Verification Code
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 32,
                  letterSpacing: "0.18em",
                  fontWeight: 800,
                  color: "#7ef3cd",
                  userSelect: "all",
                }}
              >
                {codeModalData.code}
              </div>
            </div>

            <p style={{ fontSize: 12, color: "#91a6a4", lineHeight: 1.6, margin: "0 0 20px" }}>
              {codeModalData.description}
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setCodeModalData(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => copyToClipboard(codeModalData.code)}
              >
                <Copy size={14} />
                {copiedHash === codeModalData.code ? "Copied to Clipboard!" : "Copy 10-Digit Code"}
              </button>
            </div>
          </LiquidGlassPanel>
        </div>
      )}

      {/* MINT NEW BATCH MODAL */}
      {modalOpen && (
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
            style={{ maxWidth: 580, width: "100%", maxHeight: "90vh", overflowY: "auto" } as any}
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
                <div className="eyebrow">NEW BLOCKCHAIN RECORD</div>
                <h2 style={{ margin: "6px 0 0", fontSize: 20 }}>
                  Mint Medicine Batch
                </h2>
              </div>
              <button
                className="icon-btn"
                onClick={() => {
                  setModalOpen(false);
                  setErrorMessage(null);
                }}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255, 141, 131, 0.4)",
                  background: "rgba(255, 141, 131, 0.1)",
                  color: "#ff8d83",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Exactly the 5 fields required by prompt */}
            <form className="form-grid" onSubmit={handleMintSubmit}>
              {/* 1. Batch ID */}
              <div className="input-wrap full">
                <label>
                  Batch ID <span style={{ color: "#ff8d83" }}>*</span>
                </label>
                <input
                  className="input mono"
                  placeholder="e.g. BATCH-2026-001"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              {/* 2. Medicine Name */}
              <div className="input-wrap full">
                <label>
                  Medicine Name <span style={{ color: "#ff8d83" }}>*</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. Ceftriaxone Injection"
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              {/* 3. Dosage */}
              <div className="input-wrap full">
                <label>
                  Dosage <span style={{ color: "#ff8d83" }}>*</span>
                </label>
                <input
                  className="input mono"
                  placeholder="e.g. 1g / vial or 500mg"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              {/* 4. Manufacture Date */}
              <div className="input-wrap">
                <label>
                  Manufacture Date <span style={{ color: "#ff8d83" }}>*</span>
                </label>
                <input
                  className="input"
                  type="date"
                  value={manufactureDate}
                  onChange={(e) => setManufactureDate(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              {/* 5. Expiry Date */}
              <div className="input-wrap">
                <label>
                  Expiry Date <span style={{ color: "#ff8d83" }}>*</span>
                </label>
                <input
                  className="input"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-actions full">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setModalOpen(false);
                    setErrorMessage(null);
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Minting to Blockchain...
                    </>
                  ) : (
                    <>
                      Commit to Chain <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </LiquidGlassPanel>
        </div>
      )}

      {/* TRACE BATCH POPUP MODAL */}
      {traceModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(0, 5, 6, 0.82)",
            backdropFilter: "blur(10px)",
          }}
        >
          <LiquidGlassPanel
            className="fade-up"
            style={{
              maxWidth: 760,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            } as any}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "1px solid rgba(159, 208, 202, 0.12)",
                paddingBottom: 14,
                marginBottom: 20,
              }}
            >
              <div>
                <div className="eyebrow">
                  <ShieldCheck size={12} /> PROVENANCE AUDIT · IMMUTABLE CHAIN
                </div>
                <h2 style={{ margin: "6px 0 0", fontSize: 22 }}>
                  Medicine Batch History
                </h2>
                <div
                  className="mono"
                  style={{ fontSize: 12, color: "#7ef3cd", marginTop: 4 }}
                >
                  Batch ID: {selectedBatchId}
                </div>
              </div>
              <button
                className="icon-btn"
                onClick={() => setTraceModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Trace Loading State */}
            {traceLoading && (
              <div
                style={{
                  textAlign: "center",
                  padding: "50px 20px",
                  color: "#91a6a4",
                }}
              >
                <RefreshCw
                  size={24}
                  className="animate-spin"
                  style={{ margin: "0 auto 12px", color: "#7ef3cd" }}
                />
                <p style={{ margin: 0, fontSize: 13 }}>
                  Verifying cryptographic provenance from blockchain...
                </p>
              </div>
            )}

            {/* Trace Error State */}
            {traceError && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255, 141, 131, 0.4)",
                  background: "rgba(255, 141, 131, 0.1)",
                  color: "#ff8d83",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <AlertCircle size={18} />
                <span>{traceError}</span>
              </div>
            )}

            {/* Trace Details Content */}
            {!traceLoading && batchDetail && (
              <div>
                {/* Verification Status Banner */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: 10,
                    marginBottom: 20,
                    background: batchDetail.blockchain.is_authentic
                      ? "rgba(126, 243, 205, 0.08)"
                      : "rgba(255, 141, 131, 0.08)",
                    border: `1px solid ${
                      batchDetail.blockchain.is_authentic
                        ? "rgba(126, 243, 205, 0.3)"
                        : "rgba(255, 141, 131, 0.3)"
                    }`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {batchDetail.blockchain.is_authentic ? (
                      <CheckCircle2 size={18} color="#7ef3cd" />
                    ) : (
                      <AlertCircle size={18} color="#ff8d83" />
                    )}
                    <div>
                      <strong
                        style={{
                          fontSize: 13,
                          color: batchDetail.blockchain.is_authentic
                            ? "#7ef3cd"
                            : "#ff8d83",
                        }}
                      >
                        {batchDetail.blockchain.is_authentic
                          ? "Authentic & Cryptographically Verified"
                          : "Tamper Warning"}
                      </strong>
                      <div style={{ fontSize: 11, color: "#91a6a4" }}>
                        {batchDetail.blockchain.chain_verified
                          ? "SHA-256 block hash and signature integrity verified on the chain."
                          : "Integrity check failed."}
                      </div>
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{ textTransform: "uppercase", fontSize: 10 }}
                  >
                    Current Holder: {batchDetail.blockchain.current_owner}
                  </span>
                </div>

                {/* Medicine Metadata Section */}
                <div
                  style={{
                    background: "rgba(0,0,0,0.22)",
                    borderRadius: 10,
                    padding: "16px",
                    marginBottom: 24,
                  }}
                >
                  <div
                    className="eyebrow"
                    style={{ marginBottom: 12, fontSize: 10 }}
                  >
                    <FileText size={11} /> Medicine Specifications
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 14,
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <span className="stat-label">Medicine Name</span>
                      <strong style={{ display: "block", marginTop: 4, color: "#edf4f3" }}>
                        {batchDetail.metadata.drug_name}
                      </strong>
                    </div>
                    <div>
                      <span className="stat-label">Dosage</span>
                      <strong className="mono" style={{ display: "block", marginTop: 4, color: "#edf4f3" }}>
                        {batchDetail.metadata.dosage || "Standard"}
                      </strong>
                    </div>
                    <div>
                      <span className="stat-label">Manufacture Date</span>
                      <strong className="mono" style={{ display: "block", marginTop: 4, color: "#edf4f3" }}>
                        {batchDetail.metadata.manufacturing_date}
                      </strong>
                    </div>
                    <div>
                      <span className="stat-label">Expiry Date</span>
                      <strong className="mono" style={{ display: "block", marginTop: 4, color: "#edf4f3" }}>
                        {batchDetail.metadata.expiry_date}
                      </strong>
                    </div>
                    <div>
                      <span className="stat-label">Manufacturer</span>
                      <strong style={{ display: "block", marginTop: 4, color: "#edf4f3" }}>
                        {batchDetail.metadata.manufacturer}
                      </strong>
                    </div>
                    <div>
                      <span className="stat-label">Current Stage</span>
                      <div style={{ marginTop: 4 }}>
                        <span className="badge" style={{ textTransform: "uppercase" }}>
                          {batchDetail.blockchain.current_stage || "minted"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Complete Transaction History Timeline */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 14,
                    }}
                  >
                    <div className="eyebrow" style={{ fontSize: 10 }}>
                      <Clock size={11} /> Transaction History from Mint
                    </div>
                    <span className="mono" style={{ fontSize: 10, color: "#91a6a4" }}>
                      {batchDetail.blockchain.history.length} TRANSFERS RECORDED
                    </span>
                  </div>

                  {batchDetail.blockchain.history.length === 0 ? (
                    <div
                      style={{
                        padding: "20px",
                        textAlign: "center",
                        color: "#91a6a4",
                        fontSize: 12,
                      }}
                    >
                      No transactions recorded for this batch.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {batchDetail.blockchain.history.map((tx, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "14px 16px",
                            borderRadius: 10,
                            background: "rgba(159, 208, 202, 0.04)",
                            border: "1px solid rgba(159, 208, 202, 0.1)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: 10,
                              marginBottom: 10,
                              borderBottom: "1px solid rgba(159, 208, 202, 0.08)",
                              paddingBottom: 8,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span
                                className="mono"
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "#7ef3cd",
                                }}
                              >
                                Step #{idx + 1}
                              </span>
                              <span
                                className="badge"
                                style={{
                                  textTransform: "uppercase",
                                  fontSize: 9,
                                }}
                              >
                                {tx.stage}
                              </span>
                              {tx.block_index !== undefined && (
                                <span
                                  className="mono"
                                  style={{ fontSize: 10, color: "#91a6a4" }}
                                >
                                  Block #{tx.block_index}
                                </span>
                              )}
                            </div>

                            <span
                              className="mono"
                              style={{ fontSize: 10, color: "#91a6a4" }}
                            >
                              {formatDate(tx.timestamp || tx.block_timestamp)}
                            </span>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                              gap: 10,
                              fontSize: 11,
                            }}
                          >
                            <div>
                              <span className="stat-label" style={{ fontSize: 9 }}>
                                Custody Transfer
                              </span>
                              <div
                                className="mono"
                                style={{
                                  marginTop: 3,
                                  color: "#edf4f3",
                                  fontSize: 11,
                                }}
                              >
                                {tx.from_actor} → {tx.to_actor}
                              </div>
                            </div>

                            {tx.validator && (
                              <div>
                                <span className="stat-label" style={{ fontSize: 9 }}>
                                  Block Validator
                                </span>
                                <div
                                  className="mono"
                                  style={{
                                    marginTop: 3,
                                    color: "#edf4f3",
                                    fontSize: 11,
                                  }}
                                >
                                  {tx.validator}
                                </div>
                              </div>
                            )}

                            {tx.block_hash && (
                              <div style={{ gridColumn: "1 / -1" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <span className="stat-label" style={{ fontSize: 9 }}>
                                    Block Hash
                                  </span>
                                  <button
                                    className="icon-btn"
                                    style={{ width: 18, height: 18 }}
                                    onClick={() => copyToClipboard(tx.block_hash || "")}
                                    title="Copy Block Hash"
                                  >
                                    <Copy size={10} />
                                  </button>
                                </div>
                                <div
                                  className="mono"
                                  style={{
                                    marginTop: 3,
                                    color: "#7ef3cd",
                                    wordBreak: "break-all",
                                    fontSize: 10,
                                  }}
                                >
                                  {tx.block_hash}
                                </div>
                              </div>
                            )}

                            {tx.signature && (
                              <div style={{ gridColumn: "1 / -1" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <span className="stat-label" style={{ fontSize: 9 }}>
                                    RSA Digital Signature
                                  </span>
                                  <button
                                    className="icon-btn"
                                    style={{ width: 18, height: 18 }}
                                    onClick={() => copyToClipboard(tx.signature || "")}
                                    title="Copy Signature"
                                  >
                                    <Copy size={10} />
                                  </button>
                                </div>
                                <div
                                  className="mono"
                                  style={{
                                    marginTop: 3,
                                    color: "#91a6a4",
                                    wordBreak: "break-all",
                                    fontSize: 9,
                                    background: "rgba(0,0,0,0.18)",
                                    padding: "6px 8px",
                                    borderRadius: 6,
                                  }}
                                >
                                  {tx.signature}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </LiquidGlassPanel>
        </div>
      )}
    </DashboardLayout>
  );
}

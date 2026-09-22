import { Check, Factory, Pill, Truck } from "lucide-react";

interface TimelineEvent {
  stage?: string;
  from_actor?: string;
  to_actor?: string;
  timestamp?: number;
  block_index?: number;
  block_hash?: string;
}

const iconFor = (stage?: string) => {
  if (stage === "mint") return <Factory size={15} />;
  if (stage === "distribute") return <Truck size={15} />;
  return <Pill size={15} />;
};

export default function ProvenanceTimeline({ events = [] }: { events?: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "#91a6a4", fontSize: 12 }}>
        No custody events recorded on blockchain yet.
      </div>
    );
  }

  return (
    <div className="timeline">
      {events.map((ev, idx) => (
        <div className="timeline-item" key={idx}>
          <div className="timeline-dot" />
          <div className="timeline-top">
            <span className="timeline-title">
              {iconFor(ev.stage)} Stage: {ev.stage?.toUpperCase() || "RECORDED"}
            </span>
            <span className="timeline-time">
              {ev.timestamp ? new Date(ev.timestamp > 1e11 ? ev.timestamp : ev.timestamp * 1000).toLocaleString() : "N/A"}
            </span>
          </div>
          <div className="timeline-copy">
            From: <span className="mono">{ev.from_actor}</span> → To: <span className="mono">{ev.to_actor}</span>
            {ev.block_index !== undefined && <span> (Block #{ev.block_index})</span>}
          </div>
          {ev.block_hash && (
            <span className="timeline-hash mono">
              <Check size={11} style={{ verticalAlign: "-2px" }} /> {ev.block_hash.slice(0, 16)}...
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

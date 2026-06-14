import { ReactNode } from "react";

type DataSphereNode = {
  label: string;
  value: string;
  angle: number;
  active?: boolean;
};

type DataSphereProps = {
  title: string;
  summary: string;
  actions: ReactNode;
  voicePhase: string;
  coreLabel: string;
  nodes: DataSphereNode[];
  onNodeClick: (label: string) => void;
};

export default function DataSphere({
  title,
  summary,
  actions,
  voicePhase,
  coreLabel,
  nodes,
  onNodeClick,
}: DataSphereProps) {
  return (
    <section className="jarvis-data-sphere-section">
      <div className="data-sphere-copy">
        <p className="section-kicker">Holographic Home Core</p>
        <h2>{title}</h2>
        <p>{summary}</p>
        <div className="data-sphere-actions">{actions}</div>
      </div>
      <div className="data-sphere-wrap" aria-label="JARVIS holographic system map">
        <div className={`data-sphere-core ${voicePhase}`}>
          <span>{coreLabel}</span>
          <small>{voicePhase}</small>
        </div>
        <div className="data-sphere-ring ring-one" aria-hidden="true" />
        <div className="data-sphere-ring ring-two" aria-hidden="true" />
        <div className="data-sphere-ring ring-three" aria-hidden="true" />
        {nodes.map((node) => (
          <button
            className={`data-sphere-node ${node.active ? "active" : ""}`}
            type="button"
            key={node.label}
            style={{ "--node-angle": `${node.angle}deg` } as React.CSSProperties}
            onClick={() => onNodeClick(node.label)}
          >
            <span>{node.label}</span>
            <small>{node.value}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

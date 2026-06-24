import { useMemo } from "react";

import type { TopicGraphBundle, TopicGraphNode } from "../../../services/jarvisApi";

type TopicGraphCanvasProps = {
  graph: TopicGraphBundle;
  selectedEntityId: number | null;
  onSelectNode: (node: TopicGraphNode) => void;
};

const WIDTH = 520;
const HEIGHT = 280;
const RADIUS = 28;

export function TopicGraphCanvas({ graph, selectedEntityId, onSelectNode }: TopicGraphCanvasProps) {
  const layout = useMemo(() => {
    const nodes = graph.nodes.slice(0, 24);
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    const orbit = Math.min(WIDTH, HEIGHT) / 2 - RADIUS - 12;
    return nodes.map((node, index) => {
      const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        node,
        x: centerX + Math.cos(angle) * orbit,
        y: centerY + Math.sin(angle) * orbit,
      };
    });
  }, [graph.nodes]);

  const positions = useMemo(
    () => new Map(layout.map((entry) => [entry.node.entityId, entry])),
    [layout],
  );

  return (
    <svg
      className="topic-graph-canvas"
      data-testid="topic-graph-canvas"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Topic graph canvas"
    >
      {graph.edges.map((edge) => {
        const subject = positions.get(edge.subjectEntityId);
        const object = positions.get(edge.objectEntityId);
        if (!subject || !object) {
          return null;
        }
        return (
          <line
            key={edge.id}
            x1={subject.x}
            y1={subject.y}
            x2={object.x}
            y2={object.y}
            stroke="var(--border-subtle, #4b5563)"
            strokeWidth={1.5}
          />
        );
      })}
      {layout.map(({ node, x, y }) => {
        const selected = selectedEntityId === node.entityId;
        return (
          <g
            key={node.entityId}
            data-testid={`topic-graph-node-${node.entityId}`}
            style={{ cursor: "pointer" }}
            onClick={() => onSelectNode(node)}
          >
            <circle
              cx={x}
              cy={y}
              r={RADIUS}
              fill={selected ? "var(--accent, #3b82f6)" : "var(--surface-elevated, #1f2937)"}
              stroke={selected ? "var(--accent, #60a5fa)" : "var(--border-subtle, #6b7280)"}
              strokeWidth={2}
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-primary, #f9fafb)"
            >
              {node.label.length > 14 ? `${node.label.slice(0, 12)}…` : node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

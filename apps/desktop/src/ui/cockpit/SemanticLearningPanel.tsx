import { useState } from "react";

type SemanticLearningPanelProps = {
  onSuggest?: (capabilityId: string) => void;
};

const SUGGESTIONS = [
  { phrase: "open my notes", capabilityId: "memory.vault" },
  { phrase: "how much did i spend", capabilityId: "finance.readonly" },
  { phrase: "draft an email", capabilityId: "writer.draft" },
];

export default function SemanticLearningPanel({ onSuggest }: SemanticLearningPanelProps) {
  const [correction, setCorrection] = useState("");

  return (
    <div className="gateway-followup-card">
      <h3>Semantic learning</h3>
      <p className="memory-meta">
        Training Mode corrections map phrases to capabilities for L1/L2 router suggestions (Phase 4).
      </p>
      <label className="gateway-field">
        <span>When I say…</span>
        <input
          type="text"
          value={correction}
          onChange={(event) => setCorrection(event.target.value)}
          placeholder="e.g. check my spending"
        />
      </label>
      <ul className="memory-list">
        {SUGGESTIONS.map((row) => (
          <li className="memory-meta" key={row.capabilityId}>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onSuggest?.(row.capabilityId)}
            >
              Map to {row.capabilityId}
            </button>
            {" — "}
            {row.phrase}
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";

import type { LearnedIntentRecord } from "../../types/jarvis";
import {
  deleteLearnedIntentEntry,
  getLearnedIntents,
  listGatewayCapabilities,
  saveLearnedIntentEntry,
  type GatewayCapabilityRecord,
} from "../../services/jarvisApi";

type SemanticLearningPanelProps = {
  onSuggest?: (capabilityId: string) => void;
};

function normalizePhrase(phrase: string) {
  return phrase.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function SemanticLearningPanel({ onSuggest }: SemanticLearningPanelProps) {
  const [phrase, setPhrase] = useState("");
  const [capabilityId, setCapabilityId] = useState("memory.vault");
  const [learnedIntents, setLearnedIntents] = useState<LearnedIntentRecord[]>([]);
  const [capabilities, setCapabilities] = useState<GatewayCapabilityRecord[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [intents, caps] = await Promise.all([
          getLearnedIntents(),
          listGatewayCapabilities(),
        ]);
        if (!cancelled) {
          setLearnedIntents(intents);
          setCapabilities(caps);
          if (caps.length > 0) {
            setCapabilityId((current) =>
              caps.some((cap) => cap.id === current) ? current : caps[0].id,
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Failed to load phrase suggestions.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(
    () =>
      learnedIntents.map((record) => ({
        phrase: record.phrase,
        capabilityId: record.intentKind.includes(".")
          ? record.intentKind
          : record.intentPayload || record.intentKind,
        id: record.id,
      })),
    [learnedIntents],
  );

  async function handleSave() {
    const trimmed = phrase.trim();
    if (!trimmed) {
      setStatus("Enter a phrase to map.");
      return;
    }
    const normalized = normalizePhrase(trimmed);
    try {
      await saveLearnedIntentEntry(trimmed, normalized, capabilityId, capabilityId);
      const intents = await getLearnedIntents();
      setLearnedIntents(intents);
      setPhrase("");
      setStatus(`Mapped "${trimmed}" → ${capabilityId}`);
      onSuggest?.(capabilityId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save phrase mapping.");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteLearnedIntentEntry(id);
      setLearnedIntents((current) => current.filter((record) => record.id !== id));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete mapping.");
    }
  }

  return (
    <div className="gateway-followup-card">
      <h3>Semantic learning</h3>
      <p className="memory-meta">
        Phrase mappings persist in SQLite and route at L1 before L2 Ollama classification.
      </p>
      <label className="gateway-field">
        <span>When I say…</span>
        <input
          type="text"
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          placeholder="e.g. check my spending"
          disabled={loading}
        />
      </label>
      <label className="gateway-field">
        <span>Route to capability</span>
        <select
          value={capabilityId}
          onChange={(event) => setCapabilityId(event.target.value)}
          disabled={loading || capabilities.length === 0}
        >
          {capabilities.map((capability) => (
            <option key={capability.id} value={capability.id}>
              {capability.id} · {capability.label}
            </option>
          ))}
        </select>
      </label>
      <div className="workflow-actions">
        <button className="primary-button" type="button" onClick={() => void handleSave()} disabled={loading}>
          Save mapping
        </button>
      </div>
      {status ? <p className="memory-meta">{status}</p> : null}
      <ul className="memory-list">
        {suggestions.length === 0 ? (
          <li className="memory-meta">
            {loading ? "Loading learned phrases…" : "No learned phrases yet. Add one above or use Training Mode."}
          </li>
        ) : (
          suggestions.map((row) => (
            <li className="memory-meta" key={row.id}>
              <button
                className="secondary-button"
                type="button"
                onClick={() => onSuggest?.(row.capabilityId)}
              >
                Try {row.capabilityId}
              </button>
              {" — "}
              {row.phrase}
              <button
                className="secondary-button"
                type="button"
                onClick={() => void handleDelete(row.id)}
                style={{ marginLeft: "0.5rem" }}
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

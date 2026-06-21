import { useCallback, useEffect, useState } from "react";

import { getTopicGraph, inferTopicGraph, type TopicGraphBundle } from "../../../services/jarvisApi";

export function TopicGraphPanel() {
  const [graph, setGraph] = useState<TopicGraphBundle | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setGraph(await getTopicGraph(30));
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleInfer() {
    try {
      const count = await inferTopicGraph();
      setStatus(`Inferred ${count} relation(s).`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="result-card">
      <p className="section-kicker">Topic graph</p>
      <h3>Memory connections</h3>
      <div className="inline-actions">
        <button type="button" className="ghost-button" onClick={() => void refresh()}>
          Refresh
        </button>
        <button type="button" className="ghost-button" onClick={() => void handleInfer()}>
          Infer relations
        </button>
      </div>
      {status ? <p className="result-meta">{status}</p> : null}
      {graph ? (
        <>
          <p className="result-meta">
            {graph.nodes.length} entities · {graph.edges.length} relations
          </p>
          <ul className="memory-list">
            {graph.edges.slice(0, 12).map((edge) => {
              const subject = graph.nodes.find((node) => node.entityId === edge.subjectEntityId);
              const object = graph.nodes.find((node) => node.entityId === edge.objectEntityId);
              return (
                <li key={edge.id} className="memory-meta">
                  {subject?.label ?? edge.subjectEntityId} — {edge.predicate} →{" "}
                  {object?.label ?? edge.objectEntityId}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}

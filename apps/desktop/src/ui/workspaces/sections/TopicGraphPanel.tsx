import { useCallback, useEffect, useState } from "react";

import {
  getActiveProfile,
  getTopicGraph,
  inferTopicGraph,
  queryTopicNeighbors,
  type TopicGraphBundle,
  type TopicGraphNode,
} from "../../../services/jarvisApi";
import { TopicGraphCanvas } from "./TopicGraphCanvas";

const PAGE_SIZE = 30;

export function TopicGraphPanel() {
  const [graph, setGraph] = useState<TopicGraphBundle | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selectedNode, setSelectedNode] = useState<TopicGraphNode | null>(null);
  const [neighborText, setNeighborText] = useState<string | null>(null);
  const [activeProfileName, setActiveProfileName] = useState<string | null>(null);

  const refresh = useCallback(async (nextLimit = limit) => {
    try {
      setGraph(await getTopicGraph(nextLimit));
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
    void getActiveProfile()
      .then((profile) => setActiveProfileName(profile?.name ?? null))
      .catch(() => setActiveProfileName(null));
  }, [refresh]);

  async function handleInfer() {
    try {
      const count = await inferTopicGraph();
      await refresh();
      setStatus(`Inferred ${count} relation(s).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSelectNode(node: TopicGraphNode) {
    setSelectedNode(node);
    try {
      setNeighborText(await queryTopicNeighbors(node.label));
    } catch (error) {
      setNeighborText(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleLoadMore() {
    const nextLimit = limit + PAGE_SIZE;
    setLimit(nextLimit);
    await refresh(nextLimit);
  }

  const visibleEdges = graph?.edges ?? [];

  return (
    <div className="result-card" data-testid="topic-graph-panel">
      <p className="section-kicker">Topic graph</p>
      <h3>Memory connections</h3>
      {activeProfileName ? (
        <p className="result-meta">Active profile: {activeProfileName}</p>
      ) : null}
      <div className="inline-actions">
        <button type="button" className="ghost-button" onClick={() => void refresh()}>
          Refresh
        </button>
        <button type="button" className="ghost-button" onClick={() => void handleInfer()}>
          Infer relations
        </button>
        <button type="button" className="ghost-button" onClick={() => void handleLoadMore()}>
          Load more
        </button>
      </div>
      {status ? <p className="result-meta">{status}</p> : null}
      {graph ? (
        <>
          <p className="result-meta">
            {graph.nodes.length} entities · {graph.edges.length} relations
          </p>
          <TopicGraphCanvas
            graph={graph}
            selectedEntityId={selectedNode?.entityId ?? null}
            onSelectNode={(node) => void handleSelectNode(node)}
          />
          {neighborText ? (
            <pre className="result-meta" data-testid="topic-graph-neighbors">
              {neighborText}
            </pre>
          ) : null}
          <ul className="memory-list">
            {visibleEdges.map((edge) => {
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

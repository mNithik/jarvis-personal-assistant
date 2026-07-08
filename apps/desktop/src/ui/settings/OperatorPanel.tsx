import { useCallback, useEffect, useState } from "react";

import {
  createBuildHandoffArtifact,
  exportProactiveMetrics,
  getProactiveMetrics,
  listGatewayTaskRuns,
  listMarketplaceCatalog,
  listProjectBundles,
  prepareSkillPublish,
  searchAuditLog,
  type AuditEntry,
  type GatewayTaskRunSummary,
  type MarketplaceCatalogEntry,
  type ProactiveMetrics,
  type ProjectBundleRecord,
} from "../../services/jarvisApi";

export default function OperatorPanel() {
  const [taskRuns, setTaskRuns] = useState<GatewayTaskRunSummary[]>([]);
  const [bundles, setBundles] = useState<ProjectBundleRecord[]>([]);
  const [catalog, setCatalog] = useState<MarketplaceCatalogEntry[]>([]);
  const [metrics, setMetrics] = useState<ProactiveMetrics | null>(null);
  const [auditTail, setAuditTail] = useState<AuditEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTaskRuns(await listGatewayTaskRuns(8));
      setBundles(await listProjectBundles(5));
      setCatalog(await listMarketplaceCatalog());
      setMetrics(await getProactiveMetrics());
      setAuditTail(await searchAuditLog({ limit: 6 }));
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="result-card" data-testid="operator-panel">
      <p className="section-kicker">Project operator</p>
      <h3>Active runs, bundles, and lab metrics</h3>
      <div className="inline-actions">
        <button type="button" className="ghost-button" onClick={() => void refresh()}>
          Refresh
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            void (async () => {
              try {
                setStatus(await exportProactiveMetrics());
              } catch (error) {
                setStatus(error instanceof Error ? error.message : String(error));
              }
            })();
          }}
        >
          Export proactive metrics
        </button>
        <button
          type="button"
          className="ghost-button"
          data-testid="operator-prepare-publish"
          onClick={() => {
            void (async () => {
              try {
                const hello = catalog.find((entry) => entry.id === "hello");
                const skillId = hello?.id ?? catalog[0]?.id;
                if (!skillId) {
                  setStatus("Install a skill before preparing a publish package.");
                  return;
                }
                const pkg = await prepareSkillPublish(skillId);
                setStatus(`${pkg.instructions}\n\nCatalog entry:\n${pkg.catalogEntryJson}`);
              } catch (error) {
                setStatus(error instanceof Error ? error.message : String(error));
              }
            })();
          }}
        >
          Prepare skill publish
        </button>
        <button
          type="button"
          className="ghost-button"
          data-testid="operator-builder-handoff"
          onClick={() => {
            void (async () => {
              try {
                const hello = catalog.find((entry) => entry.id === "hello");
                const skillId = hello?.id ?? catalog[0]?.id;
                if (!skillId) {
                  setStatus("Install a skill before creating a builder handoff.");
                  return;
                }
                const pkg = await prepareSkillPublish(skillId);
                const artifact = await createBuildHandoffArtifact({
                  skillName: pkg.skillId,
                  title: `Publish ${pkg.skillId} v${pkg.version}`,
                  prompt: `${pkg.instructions}\n\nCatalog entry:\n${pkg.catalogEntryJson}`,
                  safetyChecks: [
                    "Review catalog JSON before opening a PR",
                    "Run marketplace skill evals locally",
                  ],
                  createdAt: new Date().toISOString(),
                });
                setStatus(`${artifact.message}\n\n${artifact.markdownPath}`);
              } catch (error) {
                setStatus(error instanceof Error ? error.message : String(error));
              }
            })();
          }}
        >
          Builder handoff for publish
        </button>
      </div>
      {metrics ? (
        <p className="result-meta" data-testid="operator-proactive-metrics">
          Proactive nudges: {metrics.shown} shown · dismiss rate{" "}
          {(metrics.dismissRate * 100).toFixed(0)}% · accept rate{" "}
          {(metrics.acceptRate * 100).toFixed(0)}%
        </p>
      ) : null}
      <p className="section-kicker">Task runs</p>
      {taskRuns.length === 0 ? (
        <p className="result-meta">No recent task runs.</p>
      ) : (
        <ul className="memory-list">
          {taskRuns.map((run) => (
            <li key={run.id}>
              {run.command} — {run.status} (step {run.currentStepIndex + 1}/{run.stepCount})
            </li>
          ))}
        </ul>
      )}
      <p className="section-kicker">Project bundles</p>
      {bundles.length === 0 ? (
        <p className="result-meta">No bundle evidence yet. Enable projectBundlePilot lab.</p>
      ) : (
        <ul className="memory-list">
          {bundles.map((bundle) => (
            <li key={bundle.runId}>
              {bundle.command} — {bundle.steps.filter((step) => step.status === "done").length}/
              {bundle.steps.length} steps
            </li>
          ))}
        </ul>
      )}
      <p className="section-kicker">Audit tail</p>
      {auditTail.length === 0 ? (
        <p className="result-meta">No recent audit entries.</p>
      ) : (
        <ul className="memory-list" data-testid="operator-audit-tail">
          {auditTail.map((entry) => (
            <li key={entry.lineIndex}>
              {entry.policyClass} — {entry.detail}
            </li>
          ))}
        </ul>
      )}
      <p className="section-kicker">Marketplace lanes</p>
      <ul className="memory-list">
        {catalog.map((entry) => (
          <li key={entry.id}>
            {entry.label} — lane {entry.operatorLane ?? "general"}
          </li>
        ))}
      </ul>
      {status ? <p className="result-meta">{status}</p> : null}
    </div>
  );
}

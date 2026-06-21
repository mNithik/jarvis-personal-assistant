import { useMemo, useState } from "react";

import type { ApprovalRequest, AuditEntry, GatewayEvent, GatewayTaskRunSummary } from "../../services/jarvisApi";
import { rollbackAuditEntry, searchAuditLog } from "../../services/jarvisApi";

type MissionControlPanelProps = {
  trace: GatewayEvent[];
  pendingApprovals: ApprovalRequest[];
  auditLog: string[];
  taskRuns: GatewayTaskRunSummary[];
  loading?: boolean;
  onRefresh?: () => void;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
  onResumeTask?: () => void;
};

function formatRunStatus(status: string) {
  return status.split("_").join(" ");
}

export default function MissionControlPanel({
  trace,
  pendingApprovals,
  auditLog,
  taskRuns,
  loading = false,
  onRefresh,
  onApprove,
  onDeny,
  onResumeTask,
}: MissionControlPanelProps) {
  const [auditQuery, setAuditQuery] = useState("");
  const [auditClass, setAuditClass] = useState("");
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditStatus, setAuditStatus] = useState<string | null>(null);

  const timeline = useMemo(
    () =>
      trace
        .filter((event) =>
          ["route_decided", "tool_start", "tool_end", "approval_required", "error"].includes(
            event.kind,
          ),
        )
        .slice(0, 12),
    [trace],
  );

  async function runAuditSearch() {
    setAuditStatus(null);
    try {
      const entries = await searchAuditLog({
        query: auditQuery.trim() || undefined,
        policyClass: auditClass.trim() || undefined,
        limit: 20,
      });
      setAuditEntries(entries);
    } catch (error) {
      setAuditStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleRollback(lineIndex: number) {
    setAuditStatus(null);
    try {
      const summary = await rollbackAuditEntry(lineIndex);
      setAuditStatus(summary);
      await runAuditSearch();
      onRefresh?.();
    } catch (error) {
      setAuditStatus(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className="gateway-followup-card mission-control-panel">
      <div className="gateway-trace-header">
        <p className="section-kicker">Mission control</p>
        {onRefresh ? (
          <button className="secondary-button" type="button" onClick={() => void onRefresh()}>
            Refresh
          </button>
        ) : null}
      </div>

      {loading ? <p className="memory-meta">Loading mission control…</p> : null}

      <div className="mission-control-grid">
        <div className="mission-control-column">
          <h3>Approval inbox</h3>
          {pendingApprovals.length > 0 ? (
            pendingApprovals.map((approval) => (
              <article className="gateway-followup-card confirm" key={approval.id}>
                <p className="result-meta">{approval.title}</p>
                <p>{approval.detail}</p>
                <div className="gateway-approval-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => onApprove?.(approval.id)}
                  >
                    Approve
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onDeny?.(approval.id)}
                  >
                    Deny
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="gateway-trace-empty">No pending approvals.</p>
          )}
        </div>

        <div className="mission-control-column">
          <h3>Task runs</h3>
          {onResumeTask ? (
            <button className="ghost-button" type="button" onClick={() => void onResumeTask()}>
              Resume last task
            </button>
          ) : null}
          {taskRuns.length > 0 ? (
            <ol className="memory-list">
              {taskRuns.map((run) => (
                <li className="memory-meta" key={run.id}>
                  <strong>{formatRunStatus(run.status)}</strong> · {run.command}
                  <br />
                  Step {run.currentStepIndex + 1}/{Math.max(run.stepCount, 1)} · {run.updatedAt}
                </li>
              ))}
            </ol>
          ) : (
            <p className="gateway-trace-empty">No saved task runs yet.</p>
          )}
        </div>
      </div>

      <div className="mission-control-grid">
        <div className="mission-control-column">
          <h3>Explainability timeline</h3>
          {timeline.length > 0 ? (
            timeline.map((event) => (
              <article className={`gateway-history-item ${event.kind}`} key={event.id}>
                <strong>{event.kind.split("_").join(" ")}</strong>
                <span>{event.createdAt}</span>
                <p>{event.message}</p>
              </article>
            ))
          ) : (
            <p className="gateway-trace-empty">No routed steps yet.</p>
          )}
        </div>

        <div className="mission-control-column">
          <h3>Audit ledger</h3>
          <div className="inline-actions">
            <input
              type="search"
              placeholder="Search audit log"
              value={auditQuery}
              onChange={(event) => setAuditQuery(event.target.value)}
            />
            <select value={auditClass} onChange={(event) => setAuditClass(event.target.value)}>
              <option value="">All classes</option>
              <option value="send">Send</option>
              <option value="write">Write</option>
              <option value="schedule">Schedule</option>
            </select>
            <button className="ghost-button" type="button" onClick={() => void runAuditSearch()}>
              Search
            </button>
          </div>
          {auditStatus ? <p className="result-meta">{auditStatus}</p> : null}
          {auditEntries.length > 0 ? (
            <div className="memory-list">
              {auditEntries.map((entry) => (
                <div className="memory-card" key={`${entry.lineIndex}-${entry.timestamp}`}>
                  <p className="result-meta">
                    {entry.policyClass} · {entry.outcome} · turn {entry.turnId}
                  </p>
                  <p>{entry.detail || entry.rawLine}</p>
                  {entry.rollbackRef ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void handleRollback(entry.lineIndex)}
                    >
                      Rollback
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : auditLog.length > 0 ? (
            <pre className="gateway-trace-empty">{auditLog.slice(0, 8).join("\n")}</pre>
          ) : (
            <p className="gateway-trace-empty">No external mutations logged yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

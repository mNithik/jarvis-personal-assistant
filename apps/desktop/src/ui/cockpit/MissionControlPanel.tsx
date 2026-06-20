import { useMemo } from "react";

import type { ApprovalRequest, GatewayEvent, GatewayTaskRunSummary } from "../../services/jarvisApi";

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
          {auditLog.length > 0 ? (
            <pre className="gateway-trace-empty">{auditLog.slice(0, 8).join("\n")}</pre>
          ) : (
            <p className="gateway-trace-empty">No external mutations logged yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

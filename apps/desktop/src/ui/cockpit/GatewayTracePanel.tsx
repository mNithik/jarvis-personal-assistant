import { useMemo, useState } from "react";

import { useJarvisGateway } from "../../hooks/useJarvisGateway";
import type { GatewayPreview } from "../../services/jarvisApi";
import { formatGatewayPreview } from "../../features/gateway/gatewayBridge";
import GatewayHealthCard from "./GatewayHealthCard";
import AgentCockpitCards from "./AgentCockpitCards";
import MissionControlPanel from "./MissionControlPanel";
import SemanticLearningPanel from "./SemanticLearningPanel";

type GatewayTracePanelProps = {
  livePreview?: GatewayPreview | null;
  livePreviewError?: string | null;
  isPreviewing?: boolean;
  onRunCommand?: (command: string) => void | Promise<unknown>;
};

const TRACE_FILTERS = [
  { id: "all", label: "All" },
  { id: "channel", label: "Channel" },
  { id: "budget", label: "Budget" },
  { id: "quota", label: "Quota" },
  { id: "knowledge_recalled", label: "Knowledge" },
  { id: "dry_run", label: "Dry run" },
  { id: "thinking", label: "Thinking" },
  { id: "tool", label: "Tools" },
] as const;

type TraceFilterId = (typeof TRACE_FILTERS)[number]["id"];

function formatEventKind(kind: string) {
  return kind.split("_").join(" ");
}

function formatGatewayMode(mode: string | undefined) {
  switch (mode) {
    case "dry_run":
      return "Dry run";
    case "plan_only":
      return "Plan only";
    default:
      return "Execute";
  }
}

function extractPlannedSteps(reply: string | undefined): string[] {
  if (!reply) {
    return [];
  }

  const lines = reply.split("\n");
  const steps: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\d+\.\s+(.+)$/);
    if (match) {
      steps.push(match[1]);
    }
  }
  return steps;
}

function matchesTraceFilter(filter: TraceFilterId, kind: string, message: string) {
  if (filter === "all") {
    return true;
  }
  if (filter === "budget") {
    return message.includes("Turn budgets") || message.includes("budget");
  }
  if (filter === "channel") {
    return message.toLowerCase().includes("channel")
      || message.toLowerCase().includes("telegram")
      || message.toLowerCase().includes("local turn")
      || message.toLowerCase().includes("trigger");
  }
  if (filter === "quota") {
    return message.includes("Provider quota") || message.includes("quota");
  }
  if (filter === "knowledge_recalled") {
    return kind.includes("knowledge") || message.toLowerCase().includes("recall");
  }
  if (filter === "dry_run") {
    return message.toLowerCase().includes("dry run") || message.toLowerCase().includes("planned");
  }
  return kind.includes(filter);
}

export default function GatewayTracePanel({
  livePreview = null,
  livePreviewError = null,
  isPreviewing = false,
  onRunCommand,
}: GatewayTracePanelProps) {
  const {
    config,
    trace,
    pendingApprovals,
    auditLog,
    taskRuns,
    lastTurn,
    loading,
    error,
    approve,
    deny,
    refresh,
  } = useJarvisGateway();
  const [traceFilter, setTraceFilter] = useState<TraceFilterId>("all");

  const filteredTrace = useMemo(
    () =>
      trace.filter((event) => matchesTraceFilter(traceFilter, event.kind, event.message)),
    [trace, traceFilter],
  );

  const plannedSteps = extractPlannedSteps(lastTurn?.result.reply);
  const isSimulationMode = config?.mode === "dry_run" || config?.mode === "plan_only";
  const simulationLabel =
    config?.mode === "plan_only" ? "Plan-only mode" : config?.mode === "dry_run" ? "Dry-run mode" : null;

  return (
    <div className="gateway-trace-panel">
      <div className="gateway-trace-header">
        <p className="section-kicker">Gateway trace</p>
        <button className="secondary-button" type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <GatewayHealthCard config={config} trace={trace} />
      <MissionControlPanel
        trace={trace}
        pendingApprovals={pendingApprovals}
        auditLog={auditLog}
        taskRuns={taskRuns}
        loading={loading}
        onRefresh={() => void refresh()}
        onApprove={(id) => void approve(id)}
        onDeny={(id) => void deny(id)}
        onResumeTask={onRunCommand ? () => void onRunCommand("resume last task") : undefined}
      />
      <AgentCockpitCards lastTurn={lastTurn} pendingApprovals={pendingApprovals} />
      <SemanticLearningPanel />

      <div className="workflow-actions">
        {TRACE_FILTERS.map((filter) => (
          <button
            className={`secondary-button${traceFilter === filter.id ? " active" : ""}`}
            key={filter.id}
            type="button"
            onClick={() => setTraceFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? <p>Loading gateway state...</p> : null}
      {error ? <p className="gateway-preview-reason warning">{error}</p> : null}

      <div className="gateway-trace-meta">
        <span>Enabled: {config?.enabled ? "yes" : "no"}</span>
        <span>Mode: {formatGatewayMode(config?.mode)}</span>
        <span>Talker: {config?.voice.talkerEnabled ? "on" : "off"}</span>
        <span>L2: {config?.routing.l2Enabled ? "on" : "off"}</span>
        {lastTurn?.result.route ? (
          <span>
            Route: {lastTurn.result.route.routeLevel} → {lastTurn.result.route.capabilityId}
            {lastTurn.result.route.resolvedProvider
              ? ` (${lastTurn.result.route.resolvedProvider})`
              : ""}
          </span>
        ) : null}
        {lastTurn ? <span>Correlation: {lastTurn.correlationId}</span> : null}
      </div>

      {livePreview || livePreviewError || isPreviewing ? (
        <div className="gateway-followup-card">
          <h3>Live route preview</h3>
          {isPreviewing ? <p className="memory-meta">Debouncing input preview…</p> : null}
          {livePreviewError ? <p className="gateway-preview-reason warning">{livePreviewError}</p> : null}
          {formatGatewayPreview(livePreview) ? (
            <p className="memory-meta">{formatGatewayPreview(livePreview)}</p>
          ) : null}
          {livePreview?.result.route ? (
            <p className="memory-meta">
              {livePreview.result.route.capabilityLabel} · {livePreview.result.route.decisionPolicy} ·{" "}
              {livePreview.result.route.confidence}
            </p>
          ) : null}
        </div>
      ) : null}

      {isSimulationMode && simulationLabel ? (
        <div className="gateway-followup-card confirm">
          <h3>{simulationLabel}</h3>
          <p className="memory-meta">
            Tools were not executed for the last turn. Review the planned route and steps below.
          </p>
          {plannedSteps.length > 0 ? (
            <ol className="memory-list">
              {plannedSteps.map((step) => (
                <li className="memory-meta" key={step}>
                  {step}
                </li>
              ))}
            </ol>
          ) : lastTurn?.result.reply ? (
            <pre className="gateway-trace-empty">{lastTurn.result.reply}</pre>
          ) : (
            <p className="gateway-trace-empty">Run a gateway turn in simulation mode to see planned steps.</p>
          )}
        </div>
      ) : null}

      {lastTurn?.talkerReply ? (
        <p className="gateway-trace-empty">Talker: {lastTurn.talkerReply}</p>
      ) : null}

      {pendingApprovals.length > 0 ? (
        <div className="gateway-approval-stack">
          {pendingApprovals.map((approval) => (
            <article className="gateway-followup-card confirm" key={approval.id}>
              <h3>{approval.title}</h3>
              <p>{approval.detail}</p>
              <div className="gateway-approval-actions">
                <button className="primary-button" type="button" onClick={() => void approve(approval.id)}>
                  Approve
                </button>
                <button className="secondary-button" type="button" onClick={() => void deny(approval.id)}>
                  Deny
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="gateway-trace-empty">No pending approvals.</p>
      )}

      <div className="gateway-history-list">
        {filteredTrace.length > 0 ? (
          filteredTrace.map((event) => (
            <article className={`gateway-history-item ${event.kind}`} key={event.id}>
              <div>
                <strong>{formatEventKind(event.kind)}</strong>
                <span>{event.createdAt}</span>
              </div>
              <p>{event.message}</p>
              {event.turnId != null ? <small>Turn {event.turnId}</small> : null}
            </article>
          ))
        ) : (
          <p className="gateway-trace-empty">No trace events match this filter.</p>
        )}
      </div>
    </div>
  );
}

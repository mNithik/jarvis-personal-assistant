import type { ApprovalRequest, GatewayTurnResponse } from "../../services/jarvisApi";

type AgentCockpitCardsProps = {
  lastTurn: GatewayTurnResponse | null;
  pendingApprovals: ApprovalRequest[];
};

export default function AgentCockpitCards({ lastTurn, pendingApprovals }: AgentCockpitCardsProps) {
  const route = lastTurn?.result.route;
  const reply = lastTurn?.result.reply ?? "";
  const isFinance = route?.capabilityId?.startsWith("finance") ?? false;
  const isWriter = route?.capabilityId?.startsWith("writer") ?? false;
  const writerApprovals = pendingApprovals.filter(
    (approval) =>
      approval.title.toLowerCase().includes("draft") ||
      approval.title.toLowerCase().includes("writer") ||
      approval.detail.toLowerCase().includes("notion"),
  );

  if (!isFinance && !isWriter && pendingApprovals.length === 0) {
    return null;
  }

  return (
    <div className="gateway-followup-card">
      <h3>Agent cockpit</h3>
      {isFinance ? (
        <div className="memory-card">
          <h4>Finance summary</h4>
          <p className="memory-meta">{reply.slice(0, 400) || "No finance reply yet."}</p>
        </div>
      ) : null}
      {isWriter ? (
        <div className="memory-card">
          <h4>Writer draft</h4>
          <p className="memory-meta">{reply.slice(0, 400) || "No draft yet."}</p>
          {writerApprovals.length > 0 ? (
            <ul className="memory-list">
              {writerApprovals.map((approval) => (
                <li className="memory-meta" key={approval.id}>
                  Pending approval: {approval.title}
                </li>
              ))}
            </ul>
          ) : pendingApprovals.length > 0 ? (
            <p className="gateway-preview-reason warning">
              {pendingApprovals.length} approval(s) waiting in the trace panel below.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

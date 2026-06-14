import { ReactNode } from "react";
import type { BuilderSectionProps } from "./sectionTypes";

export function buildBuilderWorkspaceSections({
  buildRequest,
  dispatchUi,
  executorStatus,
  handoffArtifact,
  implementationRequest,
  missingSkillPlan,
  missingSkillRequest,
  runCommand,
}: BuilderSectionProps): ReactNode[] {
  return [
    <section className="grid-layout single-column" key="builder-main">
      <div className="result-card">
        <p className="section-kicker">Builder Status</p>
        <h3>{executorStatus?.configured ? "Executor configured" : "Executor not configured"}</h3>
        <p className="result-meta">{executorStatus?.message ?? "Use the system drawer to configure local coding tools."}</p>
        <div className="workflow-actions">
          <button className="secondary-button" type="button" onClick={() => void runCommand("Run project checks")}>Run project checks</button>
          <button className="secondary-button" type="button" onClick={() => void runCommand("Open project in VS Code")}>Open project</button>
          <button className="secondary-button" type="button" onClick={() => dispatchUi({ type: "setSystemDrawerOpen", open: true })}>
            Open system drawer
          </button>
        </div>
      </div>
      {missingSkillRequest ? <div className="result-card"><p className="section-kicker">Skill Gap</p><h3>Missing skill detected</h3><p>Request: {missingSkillRequest}</p></div> : null}
      {missingSkillPlan ? <div className="result-card"><p className="section-kicker">Advanced Plan</p><h3>{missingSkillPlan.skillName}</h3><p>{missingSkillPlan.summary}</p></div> : null}
      {implementationRequest ? <div className="result-card"><p className="section-kicker">Implementation Brief</p><h3>{implementationRequest.skillName}</h3><p>{implementationRequest.summary}</p></div> : null}
      {buildRequest ? <div className="result-card"><p className="section-kicker">Build Request</p><h3>{buildRequest.title}</h3><p className="result-meta">Created at: {buildRequest.createdAt}</p></div> : null}
      {handoffArtifact ? <div className="result-card"><p className="section-kicker">Handoff Package</p><h3>Manual boundary reached</h3><p>{handoffArtifact.message}</p></div> : null}
    </section>,
  ];
}


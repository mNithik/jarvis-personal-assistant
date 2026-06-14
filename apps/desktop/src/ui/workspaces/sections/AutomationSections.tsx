import { ReactNode } from "react";
import type { AutomationSectionProps } from "./sectionTypes";

export function buildAutomationWorkspaceSections({
  crossFeatureSuggestions,
  pendingWorkflowExecution,
  proposals,
  savedWorkflows,
  storedRoutines,
  workflowSuggestion,
}: AutomationSectionProps): ReactNode[] {
  return [
    <section className="grid-layout single-column" key="automation-main">
      {crossFeatureSuggestions.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">Cross-Feature Suggestions</p>
          <h3>{crossFeatureSuggestions.length} suggested next step{crossFeatureSuggestions.length === 1 ? "" : "s"}</h3>
          <div className="memory-grid">
            {crossFeatureSuggestions.map((suggestion) => (
              <div className="memory-card" key={suggestion.id}>
                <h4>{suggestion.title}</h4>
                <p>{suggestion.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {workflowSuggestion ? <div className="result-card"><p className="section-kicker">Workflow Suggestion</p><h3>{workflowSuggestion.name}</h3><p>You have repeated this workflow {workflowSuggestion.basedOnCount} times.</p></div> : null}
      {pendingWorkflowExecution ? (
        <div className="result-card">
          <p className="section-kicker">Pending Workflow</p>
          <h3>{pendingWorkflowExecution.workflowName}</h3>
          <p>
            {pendingWorkflowExecution.missingPlaceholder === "input"
              ? "JARVIS is waiting for the extra text this workflow needs before it can continue."
              : `JARVIS is waiting for the right current context for {{${pendingWorkflowExecution.missingPlaceholder}}}.`}
          </p>
        </div>
      ) : null}
      <div className="result-card">
        <p className="section-kicker">Workflow Memory</p>
        <h3>{savedWorkflows.length} saved workflow{savedWorkflows.length === 1 ? "" : "s"}</h3>
        <p className="result-meta">Stored routines: {storedRoutines.length} | Draft proposals: {proposals.length}</p>
      </div>
    </section>,
  ];
}


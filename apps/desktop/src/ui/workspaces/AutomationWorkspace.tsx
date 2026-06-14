import { WorkspaceRenderProps } from "../model/jarvisTypes";

export default function AutomationWorkspace({ title, summary, sections }: WorkspaceRenderProps) {
  return (
    <section className="workspace-surface-body">
      <header className="workspace-surface-header">
        <p className="section-kicker">Automation Workspace</p>
        <h2>{title}</h2>
        <p>{summary}</p>
      </header>
      {sections}
    </section>
  );
}

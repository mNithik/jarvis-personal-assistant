import { WorkspaceRenderProps } from "../model/jarvisTypes";

export default function VisionWorkspace({ title, summary, sections }: WorkspaceRenderProps) {
  return (
    <section className="workspace-surface-body">
      <header className="workspace-surface-header">
        <p className="section-kicker">Vision Workspace</p>
        <h2>{title}</h2>
        <p>{summary}</p>
      </header>
      {sections}
    </section>
  );
}

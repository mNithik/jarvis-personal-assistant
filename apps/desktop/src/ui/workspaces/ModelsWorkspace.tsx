import { WorkspaceRenderProps } from "../model/jarvisTypes";

export default function ModelsWorkspace({ title, summary, sections }: WorkspaceRenderProps) {
  return (
    <section className="workspace-page models-workspace">
      <div className="workspace-heading">
        <p className="section-kicker">Model Router</p>
        <h1>{title}</h1>
        <p>{summary}</p>
      </div>
      {sections}
    </section>
  );
}

import { ReactNode } from "react";

type AdvancedConfigPanelProps = {
  title: string;
  summary: string;
  children: ReactNode;
};

export default function AdvancedConfigPanel({
  title,
  summary,
  children,
}: AdvancedConfigPanelProps) {
  return (
    <section className="advanced-config-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Advanced Config</p>
          <h2>{title}</h2>
        </div>
      </div>
      <p className="memory-meta">{summary}</p>
      <div className="advanced-config-body">{children}</div>
    </section>
  );
}

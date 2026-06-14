import { ReactNode } from "react";
import { FloatingPanelId } from "../model/jarvisTypes";

type FloatingPanelRecord = {
  id: FloatingPanelId;
  x: number;
  y: number;
  minimized: boolean;
};

type FloatingPanelHostProps = {
  panels: FloatingPanelRecord[];
  titleForPanel: (panelId: FloatingPanelId) => string;
  accentForPanel: (panelId: FloatingPanelId) => string;
  onStartDrag: (panelId: FloatingPanelId, clientX: number, clientY: number, rect: DOMRect) => void;
  onToggle: (panelId: FloatingPanelId) => void;
  onClose: (panelId: FloatingPanelId) => void;
  renderPanelContent: (panelId: FloatingPanelId) => ReactNode;
};

export default function FloatingPanelHost({
  panels,
  titleForPanel,
  accentForPanel,
  onStartDrag,
  onToggle,
  onClose,
  renderPanelContent,
}: FloatingPanelHostProps) {
  if (panels.length === 0) {
    return null;
  }

  return (
    <div className="jarvis-floating-layer" aria-live="polite">
      {panels.map((panel) => (
        <article
          className={`jarvis-floating-panel accent-${accentForPanel(panel.id)} ${panel.minimized ? "minimized" : ""}`}
          key={panel.id}
          style={{ transform: `translate(${panel.x}px, ${panel.y}px)` }}
        >
          <header
            className="floating-panel-header"
            onMouseDown={(event) => {
              const rect = event.currentTarget.parentElement?.getBoundingClientRect();
              if (!rect) {
                return;
              }
              onStartDrag(panel.id, event.clientX, event.clientY, rect);
            }}
          >
            <div>
              <span className="floating-panel-kicker">Inspector</span>
              <h3>{titleForPanel(panel.id)}</h3>
            </div>
            <div className="floating-panel-controls">
              <button type="button" onClick={() => onToggle(panel.id)}>
                {panel.minimized ? "Open" : "Min"}
              </button>
              <button type="button" onClick={() => onClose(panel.id)}>Close</button>
            </div>
          </header>
          {!panel.minimized ? <div className="floating-panel-body">{renderPanelContent(panel.id)}</div> : null}
        </article>
      ))}
    </div>
  );
}

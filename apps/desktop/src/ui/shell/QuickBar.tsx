import { ReactNode } from "react";
import { QuickBarPlacement } from "../model/jarvisTypes";

type QuickBarProps = {
  visible: boolean;
  placement: QuickBarPlacement;
  position: { x: number; y: number };
  voicePhase: string;
  brainLabel: string;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onListen: () => void;
  onHide: () => void;
  onRestore: () => void;
  onPinToggle: () => void;
  onStartDrag: (clientX: number, clientY: number, rect: DOMRect) => void;
  shortcuts: ReactNode;
  isRoutingCommand: boolean;
};

export default function QuickBar({
  visible,
  placement,
  position,
  voicePhase,
  brainLabel,
  input,
  onInputChange,
  onSubmit,
  onListen,
  onHide,
  onRestore,
  onPinToggle,
  onStartDrag,
  shortcuts,
  isRoutingCommand,
}: QuickBarProps) {
  if (!visible) {
    return (
      <button
        className="jarvis-quickbar-restore"
        type="button"
        onClick={onRestore}
        aria-label="Show JARVIS quick bar"
      >
        J
      </button>
    );
  }

  return (
    <section
      className={`jarvis-quickbar ${placement}`}
      aria-label="JARVIS quick command bar"
      style={
        placement === "free"
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              bottom: "auto",
              transform: "none",
            }
          : undefined
      }
    >
      <button
        className="quickbar-drag-handle"
        type="button"
        aria-label="Drag JARVIS quick bar"
        onMouseDown={(event) => {
          const rect = event.currentTarget.parentElement?.getBoundingClientRect();
          if (!rect) {
            return;
          }
          onStartDrag(event.clientX, event.clientY, rect);
        }}
      >
        ::
      </button>
      <button
        className={`quickbar-orb ${voicePhase}`}
        type="button"
        onClick={onListen}
        aria-label="Start voice input"
      >
        J
      </button>
      <form className="quickbar-command" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Ask JARVIS from anywhere..."
        />
        <button type="submit" disabled={isRoutingCommand}>
          {isRoutingCommand ? "..." : "Run"}
        </button>
      </form>
      <div className="quickbar-brain" aria-label={`Conversation brain ${brainLabel}`}>
        <span>Brain</span>
        <strong>{brainLabel}</strong>
      </div>
      <div className="quickbar-modules">{shortcuts}</div>
      <button className="quickbar-close" type="button" onClick={onPinToggle} aria-label="Pin JARVIS quick bar">
        {placement === "top" ? "Bottom" : "Top"}
      </button>
      <button className="quickbar-close" type="button" onClick={onHide} aria-label="Hide JARVIS quick bar">
        Hide
      </button>
    </section>
  );
}

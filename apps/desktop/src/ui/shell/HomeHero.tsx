import { ReactNode } from "react";

type HomeHeroProps = {
  assistantName: string;
  statusMessage: string;
  wakeCueActive: boolean;
  onPingCore: () => void;
  onOpenCockpit: () => void;
};

export default function HomeHero({
  assistantName,
  statusMessage,
  wakeCueActive,
  onPingCore,
  onOpenCockpit,
}: HomeHeroProps) {
  return (
    <section className="hero-panel home-hero-compact">
      <div className="hero-copy">
        <p className="eyebrow">Personal Assistant Platform</p>
        <h1>JARVIS</h1>
        <p className="hero-text">{statusMessage}</p>
      </div>
      <div className="status-card">
        <span className="status-label">Core status</span>
        <div className={`wake-cue ${wakeCueActive ? "active" : ""}`}>
          {wakeCueActive ? `${assistantName} woke up` : "Wake cue idle"}
        </div>
        <div className="workflow-actions">
          <button className="primary-button" type="button" onClick={onOpenCockpit}>
            Open cockpit
          </button>
          <button className="secondary-button" type="button" onClick={onPingCore}>
            Test native bridge
          </button>
        </div>
      </div>
    </section>
  );
}

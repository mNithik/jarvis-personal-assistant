import { ReactNode } from "react";

type CockpitOverlayProps = {
  open: boolean;
  title: string;
  subtitle: string;
  actions: ReactNode;
  core: ReactNode;
  signals: ReactNode;
  missions: ReactNode;
  modules: ReactNode;
};

export default function CockpitOverlay({
  open,
  title,
  subtitle,
  actions,
  core,
  signals,
  missions,
  modules,
}: CockpitOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <section className="jarvis-cockpit" aria-label="JARVIS cockpit mode">
      <div className="cockpit-backdrop" aria-hidden="true" />
      <div className="cockpit-frame">
        <header className="cockpit-header">
          <div>
            <p className="section-kicker">Cockpit Mode</p>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <div className="cockpit-actions">{actions}</div>
        </header>
        <div className="cockpit-grid">
          {core}
          {signals}
          {missions}
          {modules}
        </div>
      </div>
    </section>
  );
}

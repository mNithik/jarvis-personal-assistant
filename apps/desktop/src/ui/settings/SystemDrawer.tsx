import { ReactNode } from "react";

type SystemDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export default function SystemDrawer({ open, onClose, children }: SystemDrawerProps) {
  return (
    <aside className={`system-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="system-drawer-backdrop" onClick={onClose} />
      <div className="system-drawer-panel">
        <div className="system-drawer-header">
          <div>
            <p className="section-kicker">System Drawer</p>
            <h2>Connections and advanced controls</h2>
          </div>
          <button className="secondary-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="system-drawer-body">{children}</div>
      </div>
    </aside>
  );
}

import { useCallback, useEffect, useState } from "react";

import {
  listMemoryEntityControls,
  setMemoryEntityControl,
  type MemoryEntityControl,
} from "../../../services/jarvisApi";

type MemoryControlsPanelProps = {
  domain: string;
  title: string;
};

export default function MemoryControlsPanel({ domain, title }: MemoryControlsPanelProps) {
  const [controls, setControls] = useState<MemoryEntityControl[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await listMemoryEntityControls(domain);
      setControls(next);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [domain]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateControl = async (entityId: number, patch: { pinned?: boolean; forgotten?: boolean }) => {
    await setMemoryEntityControl({ domain, entityId, ...patch });
    await refresh();
  };

  if (controls.length === 0 && !error) {
    return null;
  }

  return (
    <div className="result-card">
      <p className="section-kicker">Memory controls</p>
      <h3>{title}</h3>
      {error ? <p className="gateway-preview-reason warning">{error}</p> : null}
      <ul className="memory-list">
        {controls.slice(0, 6).map((control) => (
          <li className="memory-meta" key={`${control.domain}-${control.entityId}`}>
            <strong>{control.label}</strong> · {control.confidence}
            {control.pinned ? " · pinned" : ""}
            <div className="inline-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => void updateControl(control.entityId, { pinned: !control.pinned })}
              >
                {control.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void updateControl(control.entityId, { forgotten: true })}
              >
                Forget
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

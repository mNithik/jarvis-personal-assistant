import { useCallback, useEffect, useState } from "react";
import {
  acceptProactiveNudge,
  dismissProactiveNudge,
  listProactiveNudges,
  type ProactiveNudgeRecord,
} from "../../../services/jarvisApi";

export function ProactiveNudgePanel() {
  const [nudges, setNudges] = useState<ProactiveNudgeRecord[]>([]);

  const refresh = useCallback(() => {
    listProactiveNudges(8)
      .then((items) => setNudges(items.filter((item) => item.status === "pending")))
      .catch(() => setNudges([]));
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (nudges.length === 0) {
    return null;
  }

  return (
    <section className="proactive-nudge-panel" data-testid="proactive-nudge-panel">
      <div>
        <p className="section-kicker">Proactive</p>
        <h3>Anomaly nudges</h3>
      </div>
      {nudges.map((nudge) => (
        <article className="proactive-nudge-card" key={nudge.id}>
          <p>{nudge.message}</p>
          <div className="proactive-nudge-actions">
            <button
              className="secondary-button"
              type="button"
              data-testid="proactive-nudge-dismiss"
              onClick={() => {
                dismissProactiveNudge(nudge.id).then(refresh).catch(() => refresh());
              }}
            >
              Dismiss
            </button>
            <button
              className="primary-button"
              type="button"
              data-testid="proactive-nudge-acknowledge"
              onClick={() => {
                acceptProactiveNudge(nudge.id).then(refresh).catch(() => refresh());
              }}
            >
              Acknowledge
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

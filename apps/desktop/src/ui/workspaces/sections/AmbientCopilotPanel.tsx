import { useCallback, useEffect, useState } from "react";

import {
  dismissAmbientSuggestion,
  listAmbientSuggestions,
  startAmbientSession,
  type AmbientSuggestionRecord,
} from "../../../services/jarvisApi";

export function AmbientCopilotPanel() {
  const [suggestions, setSuggestions] = useState<AmbientSuggestionRecord[]>([]);
  const [consent, setConsent] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSuggestions(await listAmbientSuggestions(8));
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (!consent && suggestions.length === 0) {
    return (
      <section className="proactive-nudge-panel" data-testid="ambient-copilot-panel">
        <div>
          <p className="section-kicker">Ambient</p>
          <h3>Focus session suggestions</h3>
        </div>
        <article className="proactive-nudge-card">
          <p>Ambient copilot observes OCR/voice during focus sessions. No auto-writes.</p>
          <div className="proactive-nudge-actions">
            <button
              className="primary-button"
              type="button"
              data-testid="ambient-consent-accept"
              onClick={() => {
                setConsent(true);
                void startAmbientSession({ consentGiven: true }).then(refresh);
              }}
            >
              Enable session
            </button>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="proactive-nudge-panel" data-testid="ambient-copilot-panel">
      <div>
        <p className="section-kicker">Ambient</p>
        <h3>Focus session suggestions</h3>
      </div>
      {!consent ? (
        <article className="proactive-nudge-card">
          <p>Ambient copilot observes OCR/voice during focus sessions. No auto-writes.</p>
          <div className="proactive-nudge-actions">
            <button
              className="primary-button"
              type="button"
              data-testid="ambient-consent-accept"
              onClick={() => {
                setConsent(true);
                void startAmbientSession({ consentGiven: true }).then(refresh);
              }}
            >
              Enable session
            </button>
          </div>
        </article>
      ) : null}
      {suggestions.map((item) => (
        <article className="proactive-nudge-card" key={item.id}>
          <p>{item.message}</p>
          <div className="proactive-nudge-actions">
            <button
              className="secondary-button"
              type="button"
              data-testid="ambient-suggestion-dismiss"
              onClick={() => {
                void dismissAmbientSuggestion(item.id).then(refresh);
              }}
            >
              Dismiss
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

import { useEffect, useState } from "react";

import { applyGatewayEasyPreset, getGatewayConfig, type GatewayConfig } from "../../services/jarvisApi";

const DISMISS_KEY = "jarvis-gateway-onboarding-dismissed";

type GatewayOnboardingBannerProps = {
  onApplied?: (config: GatewayConfig) => void;
};

export default function GatewayOnboardingBanner({ onApplied }: GatewayOnboardingBannerProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") {
      return;
    }
    void getGatewayConfig()
      .then((config) => {
        if (!config.enabled) {
          setVisible(true);
        }
      })
      .catch(() => {
        setVisible(true);
      });
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="gateway-followup-card confirm">
      <h3>Try the agent gateway (preview)</h3>
      <p className="memory-meta">
        Enable dry-run mode with proactive heartbeat and local turn API. Legacy routing stays available;
        nothing destructive runs until you switch to Execute mode.
      </p>
      {error ? <p className="gateway-preview-reason warning">{error}</p> : null}
      <div className="workflow-actions">
        <button
          className="primary-button"
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setError(null);
            void applyGatewayEasyPreset()
              .then((config) => {
                localStorage.setItem(DISMISS_KEY, "1");
                setVisible(false);
                onApplied?.(config);
              })
              .catch((applyError) => {
                setError(applyError instanceof Error ? applyError.message : String(applyError));
              })
              .finally(() => setLoading(false));
          }}
        >
          {loading ? "Applying…" : "Apply easy mode (dry-run)"}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={loading}
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

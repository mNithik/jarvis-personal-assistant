import { useCallback, useState } from "react";

import type { GatewayPreview } from "../services/jarvisApi";

export type GatewayHistoryRecord = {
  id: string;
  kind:
    | "preview"
    | "confirm_requested"
    | "confirm_accepted"
    | "confirm_cancelled"
    | "teach_requested"
    | "teach_saved"
    | "teach_cancelled";
  command: string;
  capabilityLabel: string;
  decisionPolicy: string;
  confidence: string;
  detail: string;
  createdAt: string;
};

type UseJarvisGatewayHistoryOptions = {
  refreshGatewayPreview: (command: string, source: "text" | "voice") => Promise<GatewayPreview | null>;
};

export function useJarvisGatewayHistory({ refreshGatewayPreview }: UseJarvisGatewayHistoryOptions) {
  const [gatewayHistory, setGatewayHistory] = useState<GatewayHistoryRecord[]>([]);

  const pushGatewayHistory = useCallback(
    (
      kind: GatewayHistoryRecord["kind"],
      command: string,
      preview: GatewayPreview | null,
      detail: string,
    ) => {
      const route = preview?.result.route;
      const record: GatewayHistoryRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        kind,
        command,
        capabilityLabel: route?.capabilityLabel ?? "Unknown",
        decisionPolicy: route?.decisionPolicy ?? "unknown",
        confidence: route?.confidence ?? "unknown",
        detail,
        createdAt: new Date().toLocaleTimeString(),
      };
      setGatewayHistory((current) => [record, ...current].slice(0, 12));
    },
    [],
  );

  const refreshGatewayPreviewWithHistory = useCallback(
    async (command: string, source: "text" | "voice") => {
      const preview = await refreshGatewayPreview(command, source);
      if (preview) {
        pushGatewayHistory("preview", command, preview, `Previewed from ${source}.`);
      }
      return preview;
    },
    [pushGatewayHistory, refreshGatewayPreview],
  );

  return {
    gatewayHistory,
    setGatewayHistory,
    pushGatewayHistory,
    refreshGatewayPreviewWithHistory,
  };
}

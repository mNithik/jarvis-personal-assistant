import { useRef } from "react";

import { useJarvisGatewayHistory } from "./useJarvisGatewayHistory";
import { useJarvisGateway } from "./useJarvisGateway";

type UseJarvisGatewayShellOptions = {
  input: string;
  traceLimit?: number;
};

export function useJarvisGatewayShell({ input, traceLimit = 30 }: UseJarvisGatewayShellOptions) {
  const previewRef = useRef<
    (command: string, source: "text" | "voice") => Promise<import("../services/jarvisApi").GatewayPreview | null>
  >(async () => null);

  const {
    gatewayHistory,
    setGatewayHistory,
    pushGatewayHistory,
    refreshGatewayPreviewWithHistory,
  } = useJarvisGatewayHistory({
    refreshGatewayPreview: (command, source) => previewRef.current(command, source),
  });

  const gateway = useJarvisGateway({
    previewInput: input,
    gatewayHistoryLength: gatewayHistory.length,
    traceLimit,
  });

  previewRef.current = gateway.refreshGatewayPreview;

  return {
    ...gateway,
    gatewayHistory,
    setGatewayHistory,
    pushGatewayHistory,
    refreshGatewayPreviewWithHistory,
  };
}

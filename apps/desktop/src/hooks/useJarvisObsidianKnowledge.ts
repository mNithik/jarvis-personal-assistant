import { useCallback, useEffect, useState } from "react";

import { getGatewayConfig, type GatewayConfig, type GatewayKnowledgeConfig } from "../services/jarvisApi";

/** Wave 2 peel: knowledge/Obsidian config loaded outside JarvisAppRoot.logic. */
export function useJarvisObsidianKnowledge() {
  const [knowledge, setKnowledge] = useState<GatewayKnowledgeConfig | undefined>();
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const config: GatewayConfig = await getGatewayConfig();
      setKnowledge(config.knowledge);
      setGatewayEnabled(config.enabled);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    knowledge,
    gatewayEnabled,
    loading,
    refresh,
    vaultConfigured: Boolean(knowledge?.localVaultPath?.trim()),
    obsidianHostId: knowledge?.obsidianHostId?.trim() || null,
  };
}

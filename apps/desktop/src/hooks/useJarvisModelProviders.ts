import { useCallback } from "react";

import type { ModelProviderId } from "../features/legacy/appHelpers";
import {
  deleteProviderKey,
  saveModelProviderSecretEntry,
} from "../services/jarvisApi";

/** Wave 2 peel: model provider key management extracted from JarvisAppRoot.logic */
export function useJarvisModelProviders() {
  const saveProviderApiKey = useCallback(async (providerId: ModelProviderId, apiKey: string) => {
    return saveModelProviderSecretEntry(providerId, apiKey.trim() || null);
  }, []);

  const removeProviderApiKey = useCallback(async (providerId: ModelProviderId) => {
    return deleteProviderKey(providerId);
  }, []);

  return { saveProviderApiKey, removeProviderApiKey };
}

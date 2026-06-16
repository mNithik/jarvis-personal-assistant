import { createContext, useContext, type ReactNode } from "react";

import type {
  ConversationBackend,
  SpeechOutputBackend,
  VoiceBackend,
} from "../../../types/voice";
import type {
  ModelBenchmarkResult,
  ModelComparisonRun,
  ModelProviderId,
  ModelProviderUsageRecord,
  ModelRouterConfig,
} from "../../../features/legacy/appHelpers";
import type { NotionStatus } from "../../../types/jarvis";
import type { CommandIntent, EmbeddingBackend } from "../../../features/command/jarvisCommandTypes";

export type JarvisSystemDrawerContextValue = {
  conversationBackend: ConversationBackend;
  setConversationBackend: (backend: ConversationBackend) => void;
  saveCurrentAssistantDefaults: () => void;
  restoreSavedAssistantDefaults: () => void;
  resetToRecommendedAssistantDefaults: () => void;
  voiceBackend: VoiceBackend;
  speechOutputBackend: SpeechOutputBackend;
  localExecutablePath: string;
  setLocalExecutablePath: (value: string) => void;
  localModelPath: string;
  setLocalModelPath: (value: string) => void;
  handleSaveLocalVoiceConfig: () => void;
  localTtsExecutablePath: string;
  setLocalTtsExecutablePath: (value: string) => void;
  localTtsModelPath: string;
  setLocalTtsModelPath: (value: string) => void;
  handleSaveLocalSpeechConfig: () => void;
  ollamaBaseUrl: string;
  setOllamaBaseUrl: (value: string) => void;
  ollamaModelName: string;
  setOllamaModelName: (value: string) => void;
  handleSaveOllamaConfig: () => void;
  modelRouterConfig: ModelRouterConfig;
  updateModelRouterConfig: (patch: Partial<ModelRouterConfig>) => void;
  updateModelProviderConfig: (
    providerId: ModelProviderId,
    patch: Partial<ModelRouterConfig["providers"][ModelProviderId]>,
  ) => void;
  modelProviderKeyStatus: Record<string, boolean>;
  modelProviderKeyPreview: Record<string, string>;
  saveProviderApiKey: (providerId: ModelProviderId, apiKey: string) => Promise<void>;
  deleteSavedProviderApiKey: (providerId: ModelProviderId) => Promise<void>;
  testSavedProviderApiKey: (providerId: ModelProviderId) => Promise<void>;
  applyModelProviderPreset: (presetId: string) => void;
  executeIntent: (intent: CommandIntent) => Promise<boolean | undefined>;
  handleTestModelProvider: (providerId: ModelProviderId) => Promise<void>;
  isTestingModelRouter: boolean;
  isBenchmarkingModels: boolean;
  isComparingModels: boolean;
  modelComparisonPrompt: string;
  setModelComparisonPrompt: (value: string) => void;
  modelComparisonRun: ModelComparisonRun | null;
  modelBenchmarkResults: ModelBenchmarkResult[];
  modelProviderUsage: ModelProviderUsageRecord[];
  modelRouterStatusMessage: string;
  setModelRouterConfig: (config: ModelRouterConfig) => void;
  createDefaultModelRouterConfig: () => ModelRouterConfig;
  embeddingBackend: EmbeddingBackend;
  setEmbeddingBackend: (backend: EmbeddingBackend) => void;
  embeddingModelName: string;
  setEmbeddingModelName: (value: string) => void;
  embeddingStatusMessage: string;
  googleCalendarClientId: string;
  setGoogleCalendarClientId: (value: string) => void;
  googleCalendarApiKey: string;
  setGoogleCalendarApiKey: (value: string) => void;
  googleCalendarAccessToken: string | null;
  gmailAccessToken: string | null;
  handleSaveGoogleCalendarConfig: () => Promise<void>;
  handleConnectGoogleCalendar: () => Promise<void>;
  handleConnectGmail: () => Promise<void>;
  spotifyClientId: string;
  setSpotifyClientId: (value: string) => void;
  spotifyAccessToken: string | null;
  handleSaveSpotifyConfig: () => void;
  handleConnectSpotify: () => Promise<void>;
  notionTokenInput: string;
  setNotionTokenInput: (value: string) => void;
  notionDatabaseId: string;
  setNotionDatabaseId: (value: string) => void;
  notionStatus: NotionStatus | null;
  handleSaveNotionConfig: () => void;
  executorCommandPath: string;
  setExecutorCommandPath: (value: string) => void;
  executorWorkingDirectory: string;
  setExecutorWorkingDirectory: (value: string) => void;
  handleSaveExecutorConfig: () => void;
  assistantName: string;
  setAssistantName: (value: string) => void;
  wakeModeEnabled: boolean;
  setWakeModeEnabled: (value: boolean | ((current: boolean) => boolean)) => void;
  handleSaveWakeMode: () => void;
  handleWakeActivation: () => void;
};

const JarvisSystemDrawerContext = createContext<JarvisSystemDrawerContextValue | null>(null);

export function JarvisSystemDrawerProvider({
  value,
  children,
}: {
  value: JarvisSystemDrawerContextValue;
  children: ReactNode;
}) {
  return (
    <JarvisSystemDrawerContext.Provider value={value}>{children}</JarvisSystemDrawerContext.Provider>
  );
}

export function useJarvisSystemDrawer() {
  const value = useContext(JarvisSystemDrawerContext);
  if (!value) {
    throw new Error("useJarvisSystemDrawer must be used within JarvisSystemDrawerProvider");
  }
  return value;
}

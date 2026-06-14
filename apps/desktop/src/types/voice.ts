export type SpeechRecognitionState =
  | "idle"
  | "listening"
  | "wake_listening"
  | "unsupported"
  | "error";

export type VoiceTranscriptResult = {
  transcript: string;
  isFinal: boolean;
};

export type VoiceSessionPhase =
  | "idle"
  | "armed"
  | "awakened"
  | "listening"
  | "processing"
  | "ready"
  | "unsupported"
  | "error";

export type VoiceBackend = "browser" | "local" | "groq";

export type LocalVoiceBackendStatus = {
  backend: VoiceBackend;
  available: boolean;
  configured: boolean;
  providerName: string;
  executablePath: string | null;
  modelPath: string | null;
  message: string;
};

export type SpeechOutputBackend = "browser" | "local";

export type LocalSpeechOutputStatus = {
  backend: SpeechOutputBackend;
  available: boolean;
  configured: boolean;
  providerName: string;
  executablePath: string | null;
  modelPath: string | null;
  message: string;
};

export type WakeModeStatus = {
  assistantName: string;
  wakeModeEnabled: boolean;
  message: string;
};

export type ConversationBackend = "heuristics" | "ollama" | "auto";

export type OllamaStatus = {
  backend: string;
  available: boolean;
  configured: boolean;
  providerName: string;
  baseUrl: string | null;
  modelName: string | null;
  message: string;
};

export type ExecutorStatus = {
  configured: boolean;
  available: boolean;
  commandPath: string | null;
  workingDirectory: string | null;
  message: string;
};

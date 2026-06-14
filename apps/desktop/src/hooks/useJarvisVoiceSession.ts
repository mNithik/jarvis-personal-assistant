import { useRef, useState } from "react";

import { createVoiceRecognition } from "../services/voiceRecognition";
import type {
  LocalSpeechOutputStatus,
  LocalVoiceBackendStatus,
  SpeechRecognitionState,
  SpeechOutputBackend,
  VoiceBackend,
  VoiceSessionPhase,
} from "../types/voice";
import type { VoiceReplyMode } from "../features/command/jarvisCommandTypes";
import type { VoiceCorrectionRecord } from "../types/jarvis";

type FollowUpWindow = {
  active: boolean;
  reason: "wake" | "reply" | "clarification";
} | null;

type BrowserRecognitionHandle = ReturnType<typeof createVoiceRecognition>;

export function useJarvisVoiceSession() {
  const [voiceState, setVoiceState] = useState<SpeechRecognitionState>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceResponseEnabled, setVoiceResponseEnabled] = useState(true);
  const [voiceReplyMode, setVoiceReplyMode] = useState<VoiceReplyMode>("normal");
  const [voiceCorrections, setVoiceCorrections] = useState<VoiceCorrectionRecord[]>([]);
  const [voiceCorrectionInput, setVoiceCorrectionInput] = useState("");
  const [voiceSessionPhase, setVoiceSessionPhase] = useState<VoiceSessionPhase>("idle");
  const [voiceAutoRouteEnabled, setVoiceAutoRouteEnabled] = useState(false);
  const [voiceBackend, setVoiceBackend] = useState<VoiceBackend>("browser");
  const [localVoiceStatus, setLocalVoiceStatus] = useState<LocalVoiceBackendStatus | null>(null);
  const [speechOutputBackend, setSpeechOutputBackend] = useState<SpeechOutputBackend>("browser");
  const [localSpeechStatus, setLocalSpeechStatus] = useState<LocalSpeechOutputStatus | null>(null);
  const [localExecutablePath, setLocalExecutablePath] = useState("");
  const [localModelPath, setLocalModelPath] = useState("");
  const [localTtsExecutablePath, setLocalTtsExecutablePath] = useState("");
  const [localTtsModelPath, setLocalTtsModelPath] = useState("");
  const [followUpWindow, setFollowUpWindow] = useState<FollowUpWindow>(null);

  const commandRecognitionRef = useRef<BrowserRecognitionHandle | null>(null);
  const wakeRecognitionRef = useRef<BrowserRecognitionHandle | null>(null);
  const wakeRestartTimeoutRef = useRef<number | null>(null);
  const lastAutoRoutedVoiceRef = useRef("");

  return {
    voiceState,
    setVoiceState,
    voiceTranscript,
    setVoiceTranscript,
    voiceResponseEnabled,
    setVoiceResponseEnabled,
    voiceReplyMode,
    setVoiceReplyMode,
    voiceCorrections,
    setVoiceCorrections,
    voiceCorrectionInput,
    setVoiceCorrectionInput,
    voiceSessionPhase,
    setVoiceSessionPhase,
    voiceAutoRouteEnabled,
    setVoiceAutoRouteEnabled,
    voiceBackend,
    setVoiceBackend,
    localVoiceStatus,
    setLocalVoiceStatus,
    speechOutputBackend,
    setSpeechOutputBackend,
    localSpeechStatus,
    setLocalSpeechStatus,
    localExecutablePath,
    setLocalExecutablePath,
    localModelPath,
    setLocalModelPath,
    localTtsExecutablePath,
    setLocalTtsExecutablePath,
    localTtsModelPath,
    setLocalTtsModelPath,
    followUpWindow,
    setFollowUpWindow,
    commandRecognitionRef,
    wakeRecognitionRef,
    wakeRestartTimeoutRef,
    lastAutoRoutedVoiceRef,
  };
}

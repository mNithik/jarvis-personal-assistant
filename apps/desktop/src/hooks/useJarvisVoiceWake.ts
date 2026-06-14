import { useEffect, type MutableRefObject } from "react";

import { createVoiceRecognition } from "../services/voiceRecognition";
import type { SpeechRecognitionState, VoiceBackend, VoiceSessionPhase } from "../types/voice";

type BrowserRecognitionHandle = ReturnType<typeof createVoiceRecognition>;

type UseJarvisVoiceWakeOptions = {
  wakeModeEnabled: boolean;
  voiceBackend: VoiceBackend;
  assistantName: string;
  voiceSessionPhase: VoiceSessionPhase;
  voiceState: SpeechRecognitionState;
  startBrowserWakeListener: () => void;
  stopWakeListener: () => void;
  closeFollowUpWindow: () => void;
  clearWakeRestartTimeout: () => void;
  setVoiceSessionPhase: (phase: VoiceSessionPhase) => void;
  setVoiceState: (state: SpeechRecognitionState) => void;
  commandRecognitionRef: MutableRefObject<BrowserRecognitionHandle | null>;
  wakeRecognitionRef: MutableRefObject<BrowserRecognitionHandle | null>;
};

export function useJarvisVoiceWake({
  wakeModeEnabled,
  voiceBackend,
  assistantName,
  voiceSessionPhase,
  voiceState,
  startBrowserWakeListener,
  stopWakeListener,
  closeFollowUpWindow,
  clearWakeRestartTimeout,
  setVoiceSessionPhase,
  setVoiceState,
  commandRecognitionRef,
  wakeRecognitionRef,
}: UseJarvisVoiceWakeOptions) {
  useEffect(() => {
    if (voiceBackend !== "browser" || !wakeModeEnabled) {
      stopWakeListener();
      closeFollowUpWindow();
      if (voiceSessionPhase === "armed" || voiceState === "wake_listening") {
        setVoiceSessionPhase("idle");
        setVoiceState("idle");
      }
      return;
    }

    if (!commandRecognitionRef.current && !wakeRecognitionRef.current) {
      startBrowserWakeListener();
    }

    return () => {
      stopWakeListener();
      if (commandRecognitionRef.current) {
        const commandRecognition = commandRecognitionRef.current;
        commandRecognitionRef.current = null;
        commandRecognition.onend = null;
        commandRecognition.onerror = null;
        commandRecognition.onresult = null;
        commandRecognition.stop();
      }
      clearWakeRestartTimeout();
    };
  }, [
    wakeModeEnabled,
    voiceBackend,
    assistantName,
    voiceSessionPhase,
    voiceState,
    startBrowserWakeListener,
    stopWakeListener,
    closeFollowUpWindow,
    clearWakeRestartTimeout,
    setVoiceSessionPhase,
    setVoiceState,
    commandRecognitionRef,
    wakeRecognitionRef,
  ]);
}

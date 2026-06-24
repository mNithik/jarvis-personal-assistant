import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import {
  cleanConversationalCommand,
  extractWakeCommand,
  parseWakeControlIntent,
  wakeTranscriptMatchesAssistant,
} from "../features/legacy/appHelpers";
import { FOLLOW_UP_WINDOW_MS, type FollowUpWindow } from "../features/command/jarvisCommandTypes";
import { startLocalAudioRecorder } from "../services/localAudioRecorder";
import {
  getLocalSpeechOutputStatus,
  getLocalVoiceBackendStatus,
  recordAmbientSignal,
  getVoiceCorrections,
  getWakeModeStatus,
  saveLocalSpeechOutputPaths,
  saveLocalVoiceBackendPaths,
  saveWakeModeStatus,
  speakLocalText,
  transcribeGroqAudio,
  transcribeLocalAudio,
} from "../services/jarvisApi";
import { speakText } from "../services/speechSynthesis";
import { createVoiceRecognition } from "../services/voiceRecognition";
import type { BrowserAliasRecord, VoiceCorrectionRecord } from "../types/jarvis";
import type {
  ConversationBackend,
  LocalSpeechOutputStatus,
  LocalVoiceBackendStatus,
  SpeechOutputBackend,
  SpeechRecognitionState,
  VoiceBackend,
  VoiceSessionPhase,
  WakeModeStatus,
} from "../types/voice";
import { useJarvisVoiceWake } from "./useJarvisVoiceWake";

type BrowserRecognitionHandle = ReturnType<typeof createVoiceRecognition>;

type CommandResult = { title: string; detail: string };

type VoiceSessionBag = {
  voiceState: SpeechRecognitionState;
  setVoiceState: (state: SpeechRecognitionState) => void;
  voiceTranscript: string;
  setVoiceTranscript: (transcript: string) => void;
  voiceResponseEnabled: boolean;
  voiceReplyMode: "quiet" | "brief" | "normal" | "detailed";
  voiceCorrections: VoiceCorrectionRecord[];
  voiceSessionPhase: VoiceSessionPhase;
  setVoiceSessionPhase: Dispatch<SetStateAction<VoiceSessionPhase>>;
  voiceAutoRouteEnabled: boolean;
  voiceBackend: VoiceBackend;
  localVoiceStatus: LocalVoiceBackendStatus | null;
  setLocalVoiceStatus: (status: LocalVoiceBackendStatus | null) => void;
  speechOutputBackend: SpeechOutputBackend;
  localSpeechStatus: LocalSpeechOutputStatus | null;
  setLocalSpeechStatus: (status: LocalSpeechOutputStatus | null) => void;
  localExecutablePath: string;
  setLocalExecutablePath: (path: string) => void;
  localModelPath: string;
  setLocalModelPath: (path: string) => void;
  localTtsExecutablePath: string;
  setLocalTtsExecutablePath: (path: string) => void;
  localTtsModelPath: string;
  setLocalTtsModelPath: (path: string) => void;
  followUpWindow: FollowUpWindow | null;
  setFollowUpWindow: Dispatch<SetStateAction<FollowUpWindow | null>>;
  setVoiceCorrections: (corrections: VoiceCorrectionRecord[]) => void;
  commandRecognitionRef: MutableRefObject<BrowserRecognitionHandle | null>;
  wakeRecognitionRef: MutableRefObject<BrowserRecognitionHandle | null>;
  wakeRestartTimeoutRef: MutableRefObject<number | null>;
  lastAutoRoutedVoiceRef: MutableRefObject<string>;
};

type UseJarvisVoiceRuntimeOptions = VoiceSessionBag & {
  assistantName: string;
  setAssistantName: (name: string) => void;
  wakeModeEnabled: boolean;
  setWakeModeEnabled: (enabled: boolean) => void;
  setWakeModeStatus: (status: WakeModeStatus | null) => void;
  setWakeCueActive: (active: boolean) => void;
  setWakeListenerActive: (active: boolean) => void;
  browserAliases: BrowserAliasRecord[];
  conversationBackend: ConversationBackend;
  isRoutingCommand: boolean;
  setInput: (value: string) => void;
  setStatusMessage: (message: string) => void;
  setCommandResult: (result: CommandResult | null) => void;
  routeCommandFromVoiceRef: MutableRefObject<(transcript: string) => Promise<void>>;
  runCommandRef: MutableRefObject<(command: string) => Promise<unknown>>;
  speakIfEnabledRef: MutableRefObject<(text: string) => void>;
};

/** Wave 2 peel: voice capture, wake listener, TTS, and routing from JarvisAppRoot.logic */
export function useJarvisVoiceRuntime(options: UseJarvisVoiceRuntimeOptions) {
  const {
    assistantName,
    setAssistantName,
    wakeModeEnabled,
    setWakeModeEnabled,
    setWakeModeStatus,
    setWakeCueActive,
    setWakeListenerActive,
    browserAliases,
    conversationBackend,
    isRoutingCommand,
    setInput,
    setStatusMessage,
    setCommandResult,
    routeCommandFromVoiceRef,
    runCommandRef,
    speakIfEnabledRef,
    voiceState,
    setVoiceState,
    voiceTranscript,
    setVoiceTranscript,
    voiceResponseEnabled,
    voiceReplyMode,
    voiceCorrections,
    voiceSessionPhase,
    setVoiceSessionPhase,
    voiceAutoRouteEnabled,
    voiceBackend,
    localVoiceStatus,
    setLocalVoiceStatus,
    speechOutputBackend,
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
    setVoiceCorrections,
    commandRecognitionRef,
    wakeRecognitionRef,
    wakeRestartTimeoutRef,
    lastAutoRoutedVoiceRef,
  } = options;

  const localRecorderRef = useRef<{ stop: () => Promise<string> } | null>(null);
  const wakeTriggeredRef = useRef(false);
  const followUpTimeoutRef = useRef<number | null>(null);

  const shouldAutoRouteVoice =
    voiceAutoRouteEnabled || conversationBackend === "ollama" || conversationBackend === "auto";

  function speakIfEnabled(text: string) {
    if (!voiceResponseEnabled) {
      return;
    }

    if (voiceReplyMode === "quiet") {
      return;
    }

    const spokenText =
      voiceReplyMode === "brief"
        ? text.split(/[.!?]/)[0]?.trim() || text
        : text;

    if (speechOutputBackend === "local") {
      void speakLocalText(spokenText).catch(() => {
        setStatusMessage(
          localSpeechStatus?.message ??
            "Local Piper speech output is not configured correctly yet.",
        );
      });
      return;
    }

    speakText(spokenText);
  }

  speakIfEnabledRef.current = speakIfEnabled;

  function applyVoiceCorrections(transcript: string) {
    const match = voiceCorrections.find(
      (correction) =>
        correction.heardPhrase.trim().toLowerCase() === transcript.trim().toLowerCase(),
    );

    return match ? match.correctedPhrase : transcript;
  }

  function handleVoiceStateChange(state: SpeechRecognitionState) {
    setVoiceState(state);

    if (state === "idle") {
      setVoiceSessionPhase((current) =>
        current === "processing"
          ? "ready"
          : current === "unsupported"
            ? "unsupported"
            : followUpWindow?.active
              ? "ready"
              : "idle",
      );
    }

    if (state === "unsupported") {
      setVoiceSessionPhase("unsupported");
    }

    if (state === "error") {
      setVoiceSessionPhase("error");
    }
  }

  async function loadVoiceCorrections() {
    try {
      const corrections = await getVoiceCorrections();
      setVoiceCorrections(corrections);
    } catch {
      setStatusMessage("Voice correction memory could not be loaded.");
    }
  }

  async function loadLocalVoiceStatus() {
    try {
      const status = await getLocalVoiceBackendStatus();
      setLocalVoiceStatus(status);
      setLocalExecutablePath(status.executablePath ?? "");
      setLocalModelPath(status.modelPath ?? "");
    } catch {
      setStatusMessage("Local voice backend status could not be loaded.");
    }
  }

  async function loadLocalSpeechStatus() {
    try {
      const status = await getLocalSpeechOutputStatus();
      setLocalSpeechStatus(status);
      setLocalTtsExecutablePath(status.executablePath ?? "");
      setLocalTtsModelPath(status.modelPath ?? "");
    } catch {
      setStatusMessage("Local speech output status could not be loaded.");
    }
  }

  async function loadWakeModeStatus() {
    try {
      const status = await getWakeModeStatus();
      setWakeModeStatus(status);
      setAssistantName(status.assistantName);
      setWakeModeEnabled(status.wakeModeEnabled);
    } catch {
      setStatusMessage("Wake mode status could not be loaded.");
    }
  }

  async function handleSaveLocalVoiceConfig() {
    try {
      const status = await saveLocalVoiceBackendPaths(localExecutablePath, localModelPath);
      setLocalVoiceStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Local voice config saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save local voice config",
        detail: "JARVIS could not update the whisper.cpp executable or model paths.",
      });
    }
  }

  async function handleSaveLocalSpeechConfig() {
    try {
      const status = await saveLocalSpeechOutputPaths(
        localTtsExecutablePath,
        localTtsModelPath,
      );
      setLocalSpeechStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Local speech config saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save local speech config",
        detail: "JARVIS could not update the Piper executable or voice model paths.",
      });
    }
  }

  async function handleSaveWakeMode() {
    try {
      const status = await saveWakeModeStatus(assistantName, wakeModeEnabled);
      setWakeModeStatus(status);
      setAssistantName(status.assistantName);
      setWakeModeEnabled(status.wakeModeEnabled);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Wake mode settings saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save wake mode settings",
        detail: "JARVIS could not update the wake mode configuration.",
      });
    }
  }

  function clearWakeRestartTimeout() {
    if (wakeRestartTimeoutRef.current !== null) {
      window.clearTimeout(wakeRestartTimeoutRef.current);
      wakeRestartTimeoutRef.current = null;
    }
  }

  function clearFollowUpTimeout() {
    if (followUpTimeoutRef.current !== null) {
      window.clearTimeout(followUpTimeoutRef.current);
      followUpTimeoutRef.current = null;
    }
  }

  function shouldUseBrowserFollowUps() {
    return wakeModeEnabled && voiceBackend === "browser";
  }

  function closeFollowUpWindow() {
    clearFollowUpTimeout();
    setFollowUpWindow(null);
  }

  function openFollowUpWindow(reason: NonNullable<FollowUpWindow>["reason"]) {
    if (!shouldUseBrowserFollowUps()) {
      return;
    }

    clearFollowUpTimeout();
    setFollowUpWindow({ active: true, reason });
    followUpTimeoutRef.current = window.setTimeout(() => {
      followUpTimeoutRef.current = null;
      setFollowUpWindow(null);
      restartWakeListenerSoon();
    }, FOLLOW_UP_WINDOW_MS);
  }

  function stopWakeListener() {
    clearWakeRestartTimeout();
    wakeTriggeredRef.current = false;
    if (wakeRecognitionRef.current) {
      const wakeRecognition = wakeRecognitionRef.current;
      wakeRecognitionRef.current = null;
      wakeRecognition.onend = null;
      wakeRecognition.onerror = null;
      wakeRecognition.onresult = null;
      wakeRecognition.stop();
    }
    setWakeListenerActive(false);
    if (voiceState === "wake_listening") {
      setVoiceState("idle");
    }
  }

  function stopCommandListener() {
    if (commandRecognitionRef.current) {
      const commandRecognition = commandRecognitionRef.current;
      commandRecognitionRef.current = null;
      commandRecognition.onend = null;
      commandRecognition.onerror = null;
      commandRecognition.onresult = null;
      commandRecognition.stop();
    }
  }

  function stopHandsFreeSession() {
    closeFollowUpWindow();
    stopWakeListener();
    stopCommandListener();
    setWakeCueActive(false);
    setWakeListenerActive(false);
    setVoiceTranscript("");
    setVoiceState("idle");
    setVoiceSessionPhase("idle");
  }

  function returnToArmedWakeMode() {
    closeFollowUpWindow();
    stopCommandListener();
    setWakeCueActive(false);
    setVoiceTranscript("");
    setVoiceState("idle");
    setVoiceSessionPhase("idle");
    setStatusMessage(`${assistantName} is standing by. Wake mode is armed again.`);
    if (shouldUseBrowserFollowUps()) {
      startBrowserWakeListener();
    }
  }

  function restartWakeListenerSoon() {
    clearWakeRestartTimeout();

    if (!shouldUseBrowserFollowUps() || followUpWindow?.active) {
      return;
    }

    wakeRestartTimeoutRef.current = window.setTimeout(() => {
      wakeRestartTimeoutRef.current = null;
      startBrowserWakeListener();
    }, 350);
  }

  function restartFollowUpListenerSoon() {
    if (!shouldUseBrowserFollowUps() || !followUpWindow?.active) {
      return;
    }

    window.setTimeout(() => {
      if (
        wakeModeEnabled &&
        voiceBackend === "browser" &&
        followUpWindow?.active &&
        !commandRecognitionRef.current &&
        !isRoutingCommand
      ) {
        startBrowserVoiceRecognition();
      }
    }, 450);
  }

  function triggerVoiceAutoRoute(transcript: string) {
    const normalizedTranscript = transcript.trim();
    if (!normalizedTranscript) {
      return;
    }

    lastAutoRoutedVoiceRef.current = normalizedTranscript;
    void routeCommandFromVoiceRef.current(normalizedTranscript);
  }

  function noteAmbientTranscript(transcript: string) {
    const normalizedTranscript = transcript.trim();
    if (normalizedTranscript.length < 8) {
      return;
    }
    void recordAmbientSignal(normalizedTranscript).catch(() => undefined);
  }

  function startBrowserVoiceRecognition() {
    stopWakeListener();
    stopCommandListener();

    const recognition = createVoiceRecognition({
      onStateChange: handleVoiceStateChange,
      onTranscript: ({ transcript, isFinal }) => {
        const normalized = applyVoiceCorrections(transcript);
        setVoiceTranscript(normalized);
        setInput(normalized);

        if (isFinal) {
          noteAmbientTranscript(normalized);
          setVoiceSessionPhase("processing");
          setStatusMessage(
            shouldAutoRouteVoice
              ? "Voice command captured. Routing now."
              : "Voice command captured. Review or route it when ready.",
          );
          if (shouldAutoRouteVoice) {
            triggerVoiceAutoRoute(normalized);
          }
        }
      },
      onError: (message) => {
        setStatusMessage(message);
      },
    });

    if (!recognition) {
      return;
    }

    recognition.onend = () => {
      commandRecognitionRef.current = null;
      handleVoiceStateChange("idle");
      if (followUpWindow?.active) {
        setStatusMessage("Still with you. Keep talking if you want to continue.");
        restartFollowUpListenerSoon();
      } else {
        restartWakeListenerSoon();
      }
    };

    commandRecognitionRef.current = recognition;
    setVoiceTranscript("");
    setVoiceState("listening");
    setVoiceSessionPhase("listening");
    recognition.start();
  }

  function startBrowserWakeListener() {
    if (!wakeModeEnabled || voiceBackend !== "browser" || commandRecognitionRef.current) {
      return;
    }

    if (wakeRecognitionRef.current) {
      return;
    }

    wakeTriggeredRef.current = false;

    const recognition = createVoiceRecognition(
      {
        onStateChange: (state) => {
          if (state === "error") {
            setVoiceState("error");
            setVoiceSessionPhase("error");
            setWakeListenerActive(false);
            return;
          }

          if (state === "idle" && wakeRecognitionRef.current) {
            setVoiceState("wake_listening");
            setVoiceSessionPhase("armed");
            return;
          }

          handleVoiceStateChange(state);
        },
        onTranscript: ({ transcript, isFinal }) => {
          if (wakeTriggeredRef.current) {
            return;
          }

          const wakeCommand = extractWakeCommand(transcript, assistantName);

          if (isFinal) {
            const wakeControlIntent = parseWakeControlIntent(transcript, browserAliases);
            if (wakeControlIntent) {
              wakeTriggeredRef.current = true;
              setVoiceTranscript(transcript.trim());
              stopWakeListener();
              void runCommandRef.current(cleanConversationalCommand(transcript));
              return;
            }

            if (wakeCommand) {
              wakeTriggeredRef.current = true;
              setVoiceTranscript(transcript.trim());
              stopWakeListener();
              void runCommandRef.current(wakeCommand);
              return;
            }
          }

          if (!wakeCommand && wakeTranscriptMatchesAssistant(transcript, assistantName)) {
            wakeTriggeredRef.current = true;
            setVoiceTranscript(transcript.trim());
            stopWakeListener();
            handleWakeActivation();
            return;
          }

          if (!isFinal) {
            setStatusMessage(`${assistantName} wake listener is armed. Say "${assistantName}" to start talking.`);
          }
        },
        onError: (message) => {
          setStatusMessage(message);
          setVoiceSessionPhase("error");
          setWakeListenerActive(false);
          wakeTriggeredRef.current = false;
        },
      },
      {
        continuous: true,
        interimResults: true,
      },
    );

    if (!recognition) {
      setStatusMessage(
        "Hands-free wake mode is not available in this browser recognizer environment yet.",
      );
      setVoiceSessionPhase("unsupported");
      return;
    }

    recognition.onend = () => {
      wakeRecognitionRef.current = null;
      setWakeListenerActive(false);
      wakeTriggeredRef.current = false;
      if (wakeModeEnabled && voiceBackend === "browser" && !commandRecognitionRef.current) {
        restartWakeListenerSoon();
      }
    };

    wakeRecognitionRef.current = recognition;
    setWakeListenerActive(true);
    setVoiceState("wake_listening");
    setVoiceSessionPhase("armed");
    setStatusMessage(`${assistantName} wake listener is armed. Say "${assistantName}" to start talking.`);
    recognition.start();
  }

  function handleWakeActivation() {
    if (!wakeModeEnabled) {
      setCommandResult({
        title: "Wake mode is off",
        detail: `Enable wake mode first if you want ${assistantName} to stay armed for activation.`,
      });
      return;
    }

    setVoiceSessionPhase("awakened");
    setWakeCueActive(true);
    setStatusMessage(`${assistantName} is awake. Listening for your command now.`);
    openFollowUpWindow("wake");
    if (voiceBackend === "local") {
      speakIfEnabled(`${assistantName} is listening.`);
    }
    beginSelectedVoiceCapture();
    window.setTimeout(() => {
      setWakeCueActive(false);
    }, 1200);
  }

  async function handleLocalVoiceToggle() {
    if (localRecorderRef.current) {
      setVoiceSessionPhase("processing");
      setStatusMessage("Transcribing local audio with whisper.cpp.");

      try {
        const audioBase64 = await localRecorderRef.current.stop();
        localRecorderRef.current = null;
        const transcript = await transcribeLocalAudio(audioBase64);
        const normalized = applyVoiceCorrections(transcript);
        setVoiceTranscript(normalized);
        setInput(normalized);
        noteAmbientTranscript(normalized);

        if (shouldAutoRouteVoice) {
          setStatusMessage("Local voice transcript captured. Routing now.");
          triggerVoiceAutoRoute(normalized);
        } else {
          setVoiceSessionPhase("ready");
          setStatusMessage("Local voice transcript captured. Review or route it when ready.");
        }
      } catch (error) {
        localRecorderRef.current = null;
        setVoiceSessionPhase("error");
        setStatusMessage(
          error instanceof Error ? error.message : "Local voice transcription failed.",
        );
      }

      return;
    }

    if (!localVoiceStatus?.configured) {
      setVoiceSessionPhase("error");
      setStatusMessage(
        localVoiceStatus?.message ??
          "Local STT is selected, but the whisper.cpp backend is not configured yet.",
      );
      return;
    }

    try {
      localRecorderRef.current = await startLocalAudioRecorder();
      setVoiceTranscript("");
      setVoiceSessionPhase("listening");
      setStatusMessage("Recording local audio. Click again to stop and transcribe.");
    } catch (error) {
      setVoiceSessionPhase("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Could not start local audio recording.",
      );
    }
  }

  async function handleGroqVoiceToggle() {
    if (localRecorderRef.current) {
      setVoiceSessionPhase("processing");
      setStatusMessage("Transcribing audio with Groq Whisper.");

      try {
        const audioBase64 = await localRecorderRef.current.stop();
        localRecorderRef.current = null;
        const transcript = await transcribeGroqAudio(audioBase64);
        const normalized = applyVoiceCorrections(transcript);
        setVoiceTranscript(normalized);
        setInput(normalized);
        noteAmbientTranscript(normalized);

        if (shouldAutoRouteVoice) {
          setStatusMessage("Groq voice transcript captured. Routing now.");
          triggerVoiceAutoRoute(normalized);
        } else {
          setVoiceSessionPhase("ready");
          setStatusMessage("Groq voice transcript captured. Review or route it when ready.");
        }
      } catch (error) {
        localRecorderRef.current = null;
        setVoiceSessionPhase("error");
        setStatusMessage(
          error instanceof Error ? error.message : "Groq voice transcription failed.",
        );
      }

      return;
    }

    try {
      localRecorderRef.current = await startLocalAudioRecorder();
      setVoiceTranscript("");
      setVoiceSessionPhase("listening");
      setStatusMessage("Recording audio for Groq transcription. Click again to stop.");
    } catch (error) {
      setVoiceSessionPhase("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Could not start audio recording for Groq STT.",
      );
    }
  }

  function beginSelectedVoiceCapture() {
    if (voiceBackend === "local") {
      void handleLocalVoiceToggle();
      return;
    }
    if (voiceBackend === "groq") {
      void handleGroqVoiceToggle();
      return;
    }

    startBrowserVoiceRecognition();
  }

  function handleVoiceStart() {
    beginSelectedVoiceCapture();
  }

  useEffect(() => {
    void loadVoiceCorrections();
    void loadLocalVoiceStatus();
    void loadLocalSpeechStatus();
    void loadWakeModeStatus();
  }, []);

  useEffect(() => {
    const recognition = createVoiceRecognition(
      {
        onStateChange: () => {},
        onTranscript: () => {},
        onError: () => {},
      },
      {
        continuous: false,
        interimResults: false,
      },
    );

    if (!recognition && voiceBackend === "browser") {
      setStatusMessage(
        "Voice recognition is not available in this environment yet. The mic control stays disabled until we swap in a local engine.",
      );
      setVoiceSessionPhase("unsupported");
      return;
    }

    recognition?.stop();
  }, [voiceBackend]);

  useEffect(() => {
    if (!followUpWindow?.active || !shouldUseBrowserFollowUps()) {
      return;
    }

    if (commandRecognitionRef.current || isRoutingCommand) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (
        shouldUseBrowserFollowUps() &&
        followUpWindow?.active &&
        !commandRecognitionRef.current &&
        !isRoutingCommand
      ) {
        setStatusMessage("Follow-up window is open. Keep talking.");
        startBrowserVoiceRecognition();
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [followUpWindow, isRoutingCommand, wakeModeEnabled, voiceBackend]);

  useJarvisVoiceWake({
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
  });

  useEffect(() => {
    const transcript = voiceTranscript.trim();
    if (!shouldAutoRouteVoice || !transcript || isRoutingCommand) {
      return;
    }

    if (voiceSessionPhase !== "ready" && voiceSessionPhase !== "processing") {
      return;
    }

    if (lastAutoRoutedVoiceRef.current === transcript) {
      return;
    }

    triggerVoiceAutoRoute(transcript);
  }, [voiceTranscript, voiceSessionPhase, shouldAutoRouteVoice, isRoutingCommand]);

  return {
    applyVoiceCorrections,
    beginSelectedVoiceCapture,
    clearFollowUpTimeout,
    clearWakeRestartTimeout,
    closeFollowUpWindow,
    followUpTimeoutRef,
    handleGroqVoiceToggle,
    handleLocalVoiceToggle,
    handleSaveLocalSpeechConfig,
    handleSaveLocalVoiceConfig,
    handleSaveWakeMode,
    handleVoiceStart,
    handleVoiceStateChange,
    handleWakeActivation,
    loadLocalSpeechStatus,
    loadLocalVoiceStatus,
    loadVoiceCorrections,
    loadWakeModeStatus,
    localRecorderRef,
    openFollowUpWindow,
    restartFollowUpListenerSoon,
    restartWakeListenerSoon,
    returnToArmedWakeMode,
    shouldAutoRouteVoice,
    shouldUseBrowserFollowUps,
    speakIfEnabled,
    startBrowserVoiceRecognition,
    startBrowserWakeListener,
    stopCommandListener,
    stopHandsFreeSession,
    stopWakeListener,
    triggerVoiceAutoRoute,
    wakeTriggeredRef,
  };
}

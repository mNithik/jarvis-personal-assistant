import { useEffect, type Dispatch, type SetStateAction } from "react";

import type {
  DesktopPermissionSettings,
  EmbeddingBackend,
  ExpenseMemoryRecord,
  MeetingPrepMemoryRecord,
  PackageMemoryRecord,
  PersonMemoryRecord,
  SchoolPlanMemoryRecord,
  SemanticConversationMemoryRecord,
  SemanticIntentFeedbackRecord,
  TravelMemoryRecord,
  UserPreferenceMemory,
  VoiceReplyMode,
} from "../features/command/jarvisCommandTypes";
import type { ConversationBackend } from "../types/voice";
import type { AssistantDefaults } from "../features/legacy/appHelpers";
import {
  ASSISTANT_DEFAULTS_STORAGE_KEY,
  CONVERSATION_BACKEND_STORAGE_KEY,
  DEFAULT_DESKTOP_PERMISSION_SETTINGS,
  DESKTOP_PERMISSION_SETTINGS_STORAGE_KEY,
  EMBEDDING_CONFIG_STORAGE_KEY,
  EXPENSE_MEMORY_STORAGE_KEY,
  MEETING_PREP_MEMORY_STORAGE_KEY,
  PACKAGE_MEMORY_STORAGE_KEY,
  PEOPLE_MEMORY_STORAGE_KEY,
  SCHOOL_PLAN_MEMORY_STORAGE_KEY,
  SEMANTIC_CONVERSATION_MEMORY_STORAGE_KEY,
  SEMANTIC_INTENT_FEEDBACK_STORAGE_KEY,
  TRAVEL_MEMORY_STORAGE_KEY,
  USER_PREFERENCE_MEMORY_STORAGE_KEY,
  VOICE_REPLY_MODE_STORAGE_KEY,
} from "../features/legacy/appHelpers";
import type { JarvisUiState } from "../ui/model/jarvisTypes";
import { persistJarvisUiState } from "../ui/model/uiPersistence";

type VoiceBackend = "browser" | "local" | "groq";
type SpeechOutputBackend = "browser" | "local";

export type JarvisShellPersistenceConfig = {
  setStatusMessage: (message: string) => void;
  uiState: JarvisUiState;
  voiceReplyMode: VoiceReplyMode;
  setVoiceReplyMode: Dispatch<SetStateAction<VoiceReplyMode>>;
  conversationBackend: ConversationBackend;
  setConversationBackend: Dispatch<SetStateAction<ConversationBackend>>;
  setVoiceBackend: Dispatch<SetStateAction<VoiceBackend>>;
  setSpeechOutputBackend: Dispatch<SetStateAction<SpeechOutputBackend>>;
  setVoiceAutoRouteEnabled: Dispatch<SetStateAction<boolean>>;
  setVoiceResponseEnabled: Dispatch<SetStateAction<boolean>>;
  userPreferenceMemory: UserPreferenceMemory;
  setUserPreferenceMemory: Dispatch<SetStateAction<UserPreferenceMemory>>;
  semanticConversationMemory: SemanticConversationMemoryRecord[];
  setSemanticConversationMemory: Dispatch<SetStateAction<SemanticConversationMemoryRecord[]>>;
  semanticIntentFeedback: SemanticIntentFeedbackRecord[];
  setSemanticIntentFeedback: Dispatch<SetStateAction<SemanticIntentFeedbackRecord[]>>;
  embeddingBackend: EmbeddingBackend;
  setEmbeddingBackend: Dispatch<SetStateAction<EmbeddingBackend>>;
  embeddingModelName: string;
  setEmbeddingModelName: Dispatch<SetStateAction<string>>;
  peopleMemory: PersonMemoryRecord[];
  setPeopleMemory: Dispatch<SetStateAction<PersonMemoryRecord[]>>;
  travelMemory: TravelMemoryRecord[];
  setTravelMemory: Dispatch<SetStateAction<TravelMemoryRecord[]>>;
  expenseMemory: ExpenseMemoryRecord[];
  setExpenseMemory: Dispatch<SetStateAction<ExpenseMemoryRecord[]>>;
  packageMemory: PackageMemoryRecord[];
  setPackageMemory: Dispatch<SetStateAction<PackageMemoryRecord[]>>;
  meetingPrepMemory: MeetingPrepMemoryRecord[];
  setMeetingPrepMemory: Dispatch<SetStateAction<MeetingPrepMemoryRecord[]>>;
  schoolPlanMemory: SchoolPlanMemoryRecord[];
  setSchoolPlanMemory: Dispatch<SetStateAction<SchoolPlanMemoryRecord[]>>;
  desktopPermissionSettings: DesktopPermissionSettings;
  setDesktopPermissionSettings: Dispatch<SetStateAction<DesktopPermissionSettings>>;
};

/** Wave A: localStorage hydrate/persist effects peeled from JarvisAppRoot.logic. */
export function useJarvisShellPersistence(config: JarvisShellPersistenceConfig) {
  const {
    setStatusMessage,
    uiState,
    voiceReplyMode,
    setVoiceReplyMode,
    conversationBackend,
    setConversationBackend,
    setVoiceBackend,
    setSpeechOutputBackend,
    setVoiceAutoRouteEnabled,
    setVoiceResponseEnabled,
    userPreferenceMemory,
    setUserPreferenceMemory,
    semanticConversationMemory,
    setSemanticConversationMemory,
    semanticIntentFeedback,
    setSemanticIntentFeedback,
    embeddingBackend,
    setEmbeddingBackend,
    embeddingModelName,
    setEmbeddingModelName,
    peopleMemory,
    setPeopleMemory,
    travelMemory,
    setTravelMemory,
    expenseMemory,
    setExpenseMemory,
    packageMemory,
    setPackageMemory,
    meetingPrepMemory,
    setMeetingPrepMemory,
    schoolPlanMemory,
    setSchoolPlanMemory,
    desktopPermissionSettings,
    setDesktopPermissionSettings,
  } = config;

  useEffect(() => {
    try {
      persistJarvisUiState(uiState);
    } catch {
      setStatusMessage("JARVIS could not persist UI preferences locally.");
    }
  }, [setStatusMessage, uiState]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VOICE_REPLY_MODE_STORAGE_KEY);
      if (
        saved === "quiet" ||
        saved === "brief" ||
        saved === "normal" ||
        saved === "detailed"
      ) {
        setVoiceReplyMode(saved);
      }
    } catch {
      setVoiceReplyMode("normal");
    }
  }, [setVoiceReplyMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VOICE_REPLY_MODE_STORAGE_KEY, voiceReplyMode);
    } catch {
      setStatusMessage("JARVIS could not persist the voice reply mode locally.");
    }
  }, [setStatusMessage, voiceReplyMode]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CONVERSATION_BACKEND_STORAGE_KEY);
      if (saved === "heuristics" || saved === "ollama" || saved === "auto") {
        setConversationBackend(saved);
      } else {
        setConversationBackend("auto");
      }
    } catch {
      setConversationBackend("auto");
    }
  }, [setConversationBackend]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONVERSATION_BACKEND_STORAGE_KEY, conversationBackend);
    } catch {
      setStatusMessage("JARVIS could not persist the conversation brain locally.");
    }
  }, [conversationBackend, setStatusMessage]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ASSISTANT_DEFAULTS_STORAGE_KEY);
      if (!saved) {
        return;
      }
      const defaults = JSON.parse(saved) as Partial<AssistantDefaults>;
      if (
        defaults.voiceBackend === "browser" ||
        defaults.voiceBackend === "local" ||
        defaults.voiceBackend === "groq"
      ) {
        setVoiceBackend(defaults.voiceBackend);
      }
      if (defaults.speechOutputBackend === "browser" || defaults.speechOutputBackend === "local") {
        setSpeechOutputBackend(defaults.speechOutputBackend);
      }
      if (typeof defaults.voiceAutoRouteEnabled === "boolean") {
        setVoiceAutoRouteEnabled(defaults.voiceAutoRouteEnabled);
      }
      if (
        defaults.conversationBackend === "heuristics" ||
        defaults.conversationBackend === "ollama" ||
        defaults.conversationBackend === "auto"
      ) {
        setConversationBackend(defaults.conversationBackend);
      }
      if (
        defaults.voiceReplyMode === "quiet" ||
        defaults.voiceReplyMode === "brief" ||
        defaults.voiceReplyMode === "normal" ||
        defaults.voiceReplyMode === "detailed"
      ) {
        setVoiceReplyMode(defaults.voiceReplyMode);
      }
      if (typeof defaults.voiceResponseEnabled === "boolean") {
        setVoiceResponseEnabled(defaults.voiceResponseEnabled);
      }
    } catch {
      setStatusMessage("JARVIS could not load saved assistant defaults.");
    }
  }, [
    setConversationBackend,
    setSpeechOutputBackend,
    setStatusMessage,
    setVoiceAutoRouteEnabled,
    setVoiceBackend,
    setVoiceReplyMode,
    setVoiceResponseEnabled,
  ]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(USER_PREFERENCE_MEMORY_STORAGE_KEY);
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as Partial<UserPreferenceMemory>;
      setUserPreferenceMemory({
        noteApp: "notion",
        musicProvider: parsed.musicProvider === "spotify" ? "spotify" : null,
        defaultWorkspaceName:
          typeof parsed.defaultWorkspaceName === "string" && parsed.defaultWorkspaceName.trim()
            ? parsed.defaultWorkspaceName.trim()
            : null,
      });
    } catch {
      setStatusMessage("JARVIS could not load your preference memory.");
    }
  }, [setStatusMessage, setUserPreferenceMemory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        USER_PREFERENCE_MEMORY_STORAGE_KEY,
        JSON.stringify(userPreferenceMemory),
      );
    } catch {
      setStatusMessage("JARVIS could not persist your preference memory locally.");
    }
  }, [setStatusMessage, userPreferenceMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SEMANTIC_CONVERSATION_MEMORY_STORAGE_KEY);
      if (saved) {
        setSemanticConversationMemory(JSON.parse(saved) as SemanticConversationMemoryRecord[]);
      }
    } catch {
      setSemanticConversationMemory([]);
    }
  }, [setSemanticConversationMemory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SEMANTIC_CONVERSATION_MEMORY_STORAGE_KEY,
        JSON.stringify(semanticConversationMemory.slice(0, 80)),
      );
    } catch {
      setStatusMessage("JARVIS could not persist semantic conversation memory locally.");
    }
  }, [semanticConversationMemory, setStatusMessage]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SEMANTIC_INTENT_FEEDBACK_STORAGE_KEY);
      if (saved) {
        setSemanticIntentFeedback(JSON.parse(saved) as SemanticIntentFeedbackRecord[]);
      }
    } catch {
      setSemanticIntentFeedback([]);
    }
  }, [setSemanticIntentFeedback]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SEMANTIC_INTENT_FEEDBACK_STORAGE_KEY,
        JSON.stringify(semanticIntentFeedback.slice(0, 120)),
      );
    } catch {
      setStatusMessage("JARVIS could not persist semantic intent feedback locally.");
    }
  }, [semanticIntentFeedback, setStatusMessage]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(EMBEDDING_CONFIG_STORAGE_KEY);
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as {
        backend?: EmbeddingBackend;
        modelName?: string;
      };
      if (
        parsed.backend === "local" ||
        parsed.backend === "ollama" ||
        parsed.backend === "transformers"
      ) {
        setEmbeddingBackend(parsed.backend);
      }
      if (typeof parsed.modelName === "string" && parsed.modelName.trim()) {
        setEmbeddingModelName(parsed.modelName.trim());
      }
    } catch {
      setStatusMessage("JARVIS could not load embedding settings.");
    }
  }, [setEmbeddingBackend, setEmbeddingModelName, setStatusMessage]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        EMBEDDING_CONFIG_STORAGE_KEY,
        JSON.stringify({
          backend: embeddingBackend,
          modelName: embeddingModelName,
        }),
      );
    } catch {
      setStatusMessage("JARVIS could not persist embedding settings.");
    }
  }, [embeddingBackend, embeddingModelName, setStatusMessage]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PEOPLE_MEMORY_STORAGE_KEY);
      if (saved) {
        setPeopleMemory(JSON.parse(saved) as PersonMemoryRecord[]);
      }
    } catch {
      setPeopleMemory([]);
    }
  }, [setPeopleMemory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PEOPLE_MEMORY_STORAGE_KEY, JSON.stringify(peopleMemory));
    } catch {
      setStatusMessage("JARVIS could not persist people memory locally.");
    }
  }, [peopleMemory, setStatusMessage]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TRAVEL_MEMORY_STORAGE_KEY);
      if (saved) {
        setTravelMemory(JSON.parse(saved) as TravelMemoryRecord[]);
      }
    } catch {
      setTravelMemory([]);
    }
  }, [setTravelMemory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(TRAVEL_MEMORY_STORAGE_KEY, JSON.stringify(travelMemory));
    } catch {
      setStatusMessage("JARVIS could not persist travel memory locally.");
    }
  }, [setStatusMessage, travelMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(EXPENSE_MEMORY_STORAGE_KEY);
      if (saved) {
        setExpenseMemory(JSON.parse(saved) as ExpenseMemoryRecord[]);
      }
    } catch {
      setExpenseMemory([]);
    }
  }, [setExpenseMemory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(EXPENSE_MEMORY_STORAGE_KEY, JSON.stringify(expenseMemory));
    } catch {
      setStatusMessage("JARVIS could not persist expense memory locally.");
    }
  }, [expenseMemory, setStatusMessage]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PACKAGE_MEMORY_STORAGE_KEY);
      if (saved) {
        setPackageMemory(JSON.parse(saved) as PackageMemoryRecord[]);
      }
    } catch {
      setPackageMemory([]);
    }
  }, [setPackageMemory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PACKAGE_MEMORY_STORAGE_KEY, JSON.stringify(packageMemory));
    } catch {
      setStatusMessage("JARVIS could not persist package memory locally.");
    }
  }, [packageMemory, setStatusMessage]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MEETING_PREP_MEMORY_STORAGE_KEY);
      if (saved) {
        setMeetingPrepMemory(JSON.parse(saved) as MeetingPrepMemoryRecord[]);
      }
    } catch {
      setMeetingPrepMemory([]);
    }
  }, [setMeetingPrepMemory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MEETING_PREP_MEMORY_STORAGE_KEY,
        JSON.stringify(meetingPrepMemory),
      );
    } catch {
      setStatusMessage("JARVIS could not persist meeting prep memory locally.");
    }
  }, [meetingPrepMemory, setStatusMessage]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SCHOOL_PLAN_MEMORY_STORAGE_KEY);
      if (saved) {
        setSchoolPlanMemory(JSON.parse(saved) as SchoolPlanMemoryRecord[]);
      }
    } catch {
      setSchoolPlanMemory([]);
    }
  }, [setSchoolPlanMemory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SCHOOL_PLAN_MEMORY_STORAGE_KEY,
        JSON.stringify(schoolPlanMemory),
      );
    } catch {
      setStatusMessage("JARVIS could not persist school plan memory locally.");
    }
  }, [schoolPlanMemory, setStatusMessage]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DESKTOP_PERMISSION_SETTINGS_STORAGE_KEY);
      if (saved) {
        setDesktopPermissionSettings({
          ...DEFAULT_DESKTOP_PERMISSION_SETTINGS,
          ...(JSON.parse(saved) as Partial<DesktopPermissionSettings>),
        });
      }
    } catch {
      setDesktopPermissionSettings(DEFAULT_DESKTOP_PERMISSION_SETTINGS);
    }
  }, [setDesktopPermissionSettings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DESKTOP_PERMISSION_SETTINGS_STORAGE_KEY,
        JSON.stringify(desktopPermissionSettings),
      );
    } catch {
      setStatusMessage("JARVIS could not persist desktop permission settings locally.");
    }
  }, [desktopPermissionSettings, setStatusMessage]);
}

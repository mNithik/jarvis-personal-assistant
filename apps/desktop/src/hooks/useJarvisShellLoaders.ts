import { useCallback } from "react";

import type {
  CommandIntent,
  PlannerTaskRecord,
  SemanticIntentFeedbackRecord,
} from "../features/command/jarvisCommandTypes";
import type { CommandResult } from "../features/command/commandRouterDepTypes";
import type {
  BrowserAliasRecord,
  FileRecord,
  GoogleCalendarStatus,
  HistoryRecord,
  LearnedIntentRecord,
  NoteRecord,
  NotionStatus,
  ProposalRecord,
  ProposalStepRecord,
  RoutineRecord,
  SpotifyStatus,
} from "../types/jarvis";
import type { ExecutorStatus, OllamaStatus } from "../types/voice";
import {
  deleteLearnedIntentEntry,
  getBrowserAliases,
  getExecutorStatus,
  getGoogleCalendarStatus,
  getLearnedIntents,
  getNotionStatus,
  getOllamaStatus,
  getProposalSteps,
  getProposals,
  getRecentHistory,
  getRoutines,
  getSpotifyStatus,
  listNotionNotes,
  listRecentLocalFiles,
  saveLearnedIntentEntry,
  searchNotionNotes,
} from "../services/jarvisApi";
import {
  describeCommandIntent,
  encodeLearnedIntent,
  findLearnedIntentFamilySummary,
  normalizeLearnedPhrase,
  parseTaskNoteRecord,
  resolveTeachableIntent,
} from "../features/legacy/appHelpers";
import type { Dispatch, SetStateAction } from "react";

export type JarvisShellLoadersConfig = {
  setStatusMessage: (message: string) => void;
  setCommandResult: Dispatch<SetStateAction<CommandResult | null>>;
  setStoredRoutines: Dispatch<SetStateAction<RoutineRecord[]>>;
  setRecentHistory: Dispatch<SetStateAction<HistoryRecord[]>>;
  setProposals: Dispatch<SetStateAction<ProposalRecord[]>>;
  setProposalSteps: Dispatch<SetStateAction<Record<number, ProposalStepRecord[]>>>;
  setBrowserAliases: Dispatch<SetStateAction<BrowserAliasRecord[]>>;
  setLearnedIntentMappings: Dispatch<SetStateAction<LearnedIntentRecord[]>>;
  setSemanticIntentFeedback: Dispatch<SetStateAction<SemanticIntentFeedbackRecord[]>>;
  setLearnedIntentRenameDrafts: Dispatch<SetStateAction<Record<number, string>>>;
  setGoogleCalendarStatus: Dispatch<SetStateAction<GoogleCalendarStatus | null>>;
  setGoogleCalendarClientId: Dispatch<SetStateAction<string>>;
  setGoogleCalendarApiKey: Dispatch<SetStateAction<string>>;
  setNotionStatus: Dispatch<SetStateAction<NotionStatus | null>>;
  setNotionDatabaseId: Dispatch<SetStateAction<string>>;
  setSpotifyStatus: Dispatch<SetStateAction<SpotifyStatus | null>>;
  setSpotifyClientId: Dispatch<SetStateAction<string>>;
  setRecentNotes: Dispatch<SetStateAction<NoteRecord[]>>;
  setPlannerTasks: Dispatch<SetStateAction<PlannerTaskRecord[]>>;
  setRecentFiles: Dispatch<SetStateAction<FileRecord[]>>;
  setOllamaStatus: Dispatch<SetStateAction<OllamaStatus | null>>;
  setOllamaBaseUrl: Dispatch<SetStateAction<string>>;
  setOllamaModelName: Dispatch<SetStateAction<string>>;
  setExecutorStatus: Dispatch<SetStateAction<ExecutorStatus | null>>;
  setExecutorCommandPath: Dispatch<SetStateAction<string>>;
  setExecutorWorkingDirectory: Dispatch<SetStateAction<string>>;
  browserAliases: BrowserAliasRecord[];
  learnedIntentMappings: LearnedIntentRecord[];
  learnedIntentRenameDrafts: Record<number, string>;
};

/** Wave A: data loaders + learned-intent CRUD peeled from JarvisAppRoot.logic. */
export function useJarvisShellLoaders(config: JarvisShellLoadersConfig) {
  const {
    setStatusMessage,
    setCommandResult,
    setStoredRoutines,
    setRecentHistory,
    setProposals,
    setProposalSteps,
    setBrowserAliases,
    setLearnedIntentMappings,
    setSemanticIntentFeedback,
    setLearnedIntentRenameDrafts,
    setGoogleCalendarStatus,
    setGoogleCalendarClientId,
    setGoogleCalendarApiKey,
    setNotionStatus,
    setNotionDatabaseId,
    setSpotifyStatus,
    setSpotifyClientId,
    setRecentNotes,
    setPlannerTasks,
    setRecentFiles,
    setOllamaStatus,
    setOllamaBaseUrl,
    setOllamaModelName,
    setExecutorStatus,
    setExecutorCommandPath,
    setExecutorWorkingDirectory,
    browserAliases,
    learnedIntentMappings,
    learnedIntentRenameDrafts,
  } = config;

  const loadLearnedIntents = useCallback(async () => {
    try {
      const mappings = await getLearnedIntents();
      setLearnedIntentMappings(mappings);
    } catch {
      setStatusMessage("Personal language memory could not be loaded.");
    }
  }, [setLearnedIntentMappings, setStatusMessage]);

  const loadMemoryView = useCallback(async () => {
    try {
      const [routines, history, loadedProposals] = await Promise.all([
        getRoutines(),
        getRecentHistory(),
        getProposals(),
      ]);
      setStoredRoutines(routines);
      setRecentHistory(history);
      setProposals(loadedProposals);
    } catch {
      setStatusMessage(
        "Memory layer is not available yet. Once Tauri is connected, routines and history will appear here.",
      );
    }
  }, [setProposals, setRecentHistory, setStatusMessage, setStoredRoutines]);

  const loadProposalSteps = useCallback(
    async (proposalId: number) => {
      try {
        const steps = await getProposalSteps(proposalId);
        setProposalSteps((current) => ({ ...current, [proposalId]: steps }));
      } catch {
        setCommandResult({
          title: "Could not load proposal steps",
          detail: "JARVIS could not fetch the draft steps for that proposal.",
        });
      }
    },
    [setCommandResult, setProposalSteps],
  );

  const loadBrowserAliases = useCallback(async () => {
    try {
      const aliases = await getBrowserAliases();
      setBrowserAliases(aliases);
    } catch {
      setStatusMessage("Browser alias memory could not be loaded.");
    }
  }, [setBrowserAliases, setStatusMessage]);

  const rememberSuccessfulPhrase = useCallback(
    async (phrase: string, intent: CommandIntent) => {
      const normalizedPhrase = normalizeLearnedPhrase(phrase);
      if (!normalizedPhrase) {
        return;
      }

      try {
        await saveLearnedIntentEntry(
          phrase.trim(),
          normalizedPhrase,
          intent.kind,
          encodeLearnedIntent(intent),
        );
        await loadLearnedIntents();
      } catch {
        setStatusMessage("JARVIS could not update personal language memory.");
      }
    },
    [loadLearnedIntents, setStatusMessage],
  );

  const handleDeleteLearnedIntent = useCallback(
    async (record: LearnedIntentRecord) => {
      try {
        await deleteLearnedIntentEntry(record.id);
        setSemanticIntentFeedback((current) =>
          current.filter((entry) => entry.candidateId !== `learned.${record.id}`),
        );
        setLearnedIntentRenameDrafts((current) => {
          const next = { ...current };
          delete next[record.id];
          return next;
        });
        await loadLearnedIntents();
        setCommandResult({
          title: "Training phrase deleted",
          detail: `Removed "${record.phrase}" from JARVIS language memory.`,
        });
        setStatusMessage("Deleted learned phrase.");
      } catch {
        setStatusMessage("JARVIS could not delete that learned phrase.");
      }
    },
    [
      loadLearnedIntents,
      setCommandResult,
      setLearnedIntentRenameDrafts,
      setSemanticIntentFeedback,
      setStatusMessage,
    ],
  );

  const handleRenameLearnedIntent = useCallback(
    async (record: LearnedIntentRecord) => {
      const nextPhrase = learnedIntentRenameDrafts[record.id]?.trim();
      if (!nextPhrase || normalizeLearnedPhrase(nextPhrase) === record.normalizedPhrase) {
        return;
      }

      try {
        await saveLearnedIntentEntry(
          nextPhrase,
          normalizeLearnedPhrase(nextPhrase),
          record.intentKind,
          record.intentPayload,
        );
        await deleteLearnedIntentEntry(record.id);
        setSemanticIntentFeedback((current) =>
          current.filter((entry) => entry.candidateId !== `learned.${record.id}`),
        );
        setLearnedIntentRenameDrafts((current) => {
          const next = { ...current };
          delete next[record.id];
          return next;
        });
        await loadLearnedIntents();
        setCommandResult({
          title: "Training phrase renamed",
          detail: `Renamed "${record.phrase}" to "${nextPhrase}".`,
        });
        setStatusMessage("Renamed learned phrase.");
      } catch {
        setStatusMessage("JARVIS could not rename that learned phrase.");
      }
    },
    [
      learnedIntentRenameDrafts,
      loadLearnedIntents,
      setCommandResult,
      setLearnedIntentRenameDrafts,
      setSemanticIntentFeedback,
      setStatusMessage,
    ],
  );

  const teachJarvisMeaning = useCallback(
    async (phrase: string, meaning: string) => {
      const resolvedIntent = resolveTeachableIntent(meaning, browserAliases);
      if (!resolvedIntent) {
        throw new Error(
          `I could not turn "${meaning}" into a reliable action yet. Try teaching it with a clearer action like "open coding workspace" or "play blinding lights on spotify".`,
        );
      }

      await rememberSuccessfulPhrase(phrase, resolvedIntent);
      const family = findLearnedIntentFamilySummary(resolvedIntent, learnedIntentMappings);
      return {
        resolvedIntent,
        familyLabel: family?.label ?? describeCommandIntent(resolvedIntent),
      };
    },
    [browserAliases, learnedIntentMappings, rememberSuccessfulPhrase],
  );

  const loadGoogleCalendarStatus = useCallback(async () => {
    try {
      const status = await getGoogleCalendarStatus();
      setGoogleCalendarStatus(status);
      setGoogleCalendarClientId(status.clientId ?? "");
      setGoogleCalendarApiKey(status.apiKey ?? "");
    } catch {
      setStatusMessage("Google Calendar status could not be loaded.");
    }
  }, [
    setGoogleCalendarApiKey,
    setGoogleCalendarClientId,
    setGoogleCalendarStatus,
    setStatusMessage,
  ]);

  const loadNotionStatus = useCallback(async () => {
    try {
      const status = await getNotionStatus();
      setNotionStatus(status);
      setNotionDatabaseId(status.databaseId ?? "");
    } catch {
      setStatusMessage("Notion status could not be loaded.");
    }
  }, [setNotionDatabaseId, setNotionStatus, setStatusMessage]);

  const loadSpotifyStatus = useCallback(async () => {
    try {
      const status = await getSpotifyStatus();
      setSpotifyStatus(status);
      setSpotifyClientId(status.clientId ?? "");
    } catch {
      setStatusMessage("Spotify status could not be loaded.");
    }
  }, [setSpotifyClientId, setSpotifyStatus, setStatusMessage]);

  const loadRecentNotes = useCallback(async () => {
    try {
      const notes = await listNotionNotes();
      setRecentNotes(notes);
      setPlannerTasks(notes.map(parseTaskNoteRecord).filter(Boolean) as PlannerTaskRecord[]);
    } catch {
      setRecentNotes([]);
      setPlannerTasks([]);
    }
  }, [setPlannerTasks, setRecentNotes]);

  const loadPlannerTaskRecords = useCallback(async () => {
    const taskNotes = await searchNotionNotes("Task:");
    const parsedTasks = taskNotes
      .map(parseTaskNoteRecord)
      .filter(Boolean) as PlannerTaskRecord[];
    setPlannerTasks(parsedTasks);
    setRecentNotes(taskNotes);
    return parsedTasks;
  }, [setPlannerTasks, setRecentNotes]);

  const loadRecentFiles = useCallback(async () => {
    try {
      const files = await listRecentLocalFiles();
      setRecentFiles(files);
    } catch {
      setRecentFiles([]);
    }
  }, [setRecentFiles]);

  const loadOllamaStatus = useCallback(async () => {
    try {
      const status = await getOllamaStatus();
      setOllamaStatus(status);
      setOllamaBaseUrl(status.baseUrl ?? "http://127.0.0.1:11434");
      setOllamaModelName(status.modelName ?? "");
    } catch {
      setStatusMessage("Ollama status could not be loaded.");
    }
  }, [setOllamaBaseUrl, setOllamaModelName, setOllamaStatus, setStatusMessage]);

  const loadExecutorStatus = useCallback(async () => {
    try {
      const status = await getExecutorStatus();
      setExecutorStatus(status);
      setExecutorCommandPath(status.commandPath ?? "");
      setExecutorWorkingDirectory(status.workingDirectory ?? "");
    } catch {
      setStatusMessage("Executor bridge status could not be loaded.");
    }
  }, [
    setExecutorCommandPath,
    setExecutorStatus,
    setExecutorWorkingDirectory,
    setStatusMessage,
  ]);

  return {
    loadMemoryView,
    loadProposalSteps,
    loadBrowserAliases,
    loadLearnedIntents,
    rememberSuccessfulPhrase,
    handleDeleteLearnedIntent,
    handleRenameLearnedIntent,
    teachJarvisMeaning,
    loadGoogleCalendarStatus,
    loadNotionStatus,
    loadSpotifyStatus,
    loadRecentNotes,
    loadPlannerTaskRecords,
    loadRecentFiles,
    loadOllamaStatus,
    loadExecutorStatus,
  };
}

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  approveLearningProposal,
  createBuildHandoffArtifact,
  createNotionNote,
  createNotionTask,
  extractPdfText,
  generateLearningProposal,
  getBrowserAliases,
  getGoogleCalendarStatus,
  getLearnedIntents,
  getExecutorStatus,
  getLocalSpeechOutputStatus,
  getLocalVoiceBackendStatus,
  getNotionStatus,
  getOllamaStatus,
  generateMissingSkillPlanWithOllama,
  listNotionNotes,
  listRecentLocalFiles,
  openBrowserUrl,
  openLocalFile,
  getProposals,
  getProposalSteps,
  getRecentHistory,
  getRoutines,
  searchLocalFiles,
  searchNotionNotes,
  getVoiceCorrections,
  getWakeModeStatus,
  interpretConversationWithOllama,
  launchStudySetup,
  pingJarvis,
  rejectLearningProposal,
  saveBrowserAliasEntry,
  saveExecutorStatus,
  saveGoogleCalendarStatus,
  saveLearnedIntentEntry,
  saveLocalSpeechOutputPaths,
  saveLocalVoiceBackendPaths,
  saveNotionStatus,
  saveOllamaStatus,
  saveSpotifyStatus,
  saveVoiceCorrectionEntry,
  saveWakeModeStatus,
  searchGoogle,
  speakLocalText,
  transcribeLocalAudio,
  updateNotionTask,
  updateLearningProposal,
  launchExecutorHandoff,
  getSpotifyStatus,
} from "./services/jarvisApi";
import { startLocalAudioRecorder } from "./services/localAudioRecorder";
import {
  beginGoogleRedirectAuthorization,
  clearStoredGoogleAccessToken,
  completeGoogleRedirectAuthorizationIfNeeded,
  createGoogleCalendarEvent,
  getStoredGoogleAccessToken,
  listTodayGoogleCalendarEvents,
  GoogleCalendarEventRecord,
} from "./services/googleCalendar";
import {
  listUnreadGmailMessages,
  requestGmailAccessToken,
  searchGmailMessages,
} from "./services/gmail";
import {
  beginSpotifyAuthorization,
  clearSpotifySession,
  completeSpotifyAuthorizationIfNeeded,
  getSpotifyPlaybackState,
  getStoredSpotifyAccessToken,
  spotifyPausePlayback,
  spotifyResumePlayback,
  spotifySkipToNext,
  spotifySkipToPrevious,
  SpotifyPlaybackState,
} from "./services/spotify";
import { speakText } from "./services/speechSynthesis";
import { createVoiceRecognition } from "./services/voiceRecognition";
import {
  BrowserAliasRecord,
  ConversationInterpretation,
  FileRecord,
  GoogleCalendarStatus,
  HistoryRecord,
  LearnedIntentRecord,
  AutonomousBuildStatus,
  BuildHandoffArtifact,
  EmailRecord,
  MissingSkillPlan,
  NoteRecord,
  NotionStatus,
  ProposalRecord,
  ProposalStepRecord,
  RoutineRecord,
  SkillBuildRequest,
  SpotifyStatus,
  SkillImplementationRequest,
  VoiceCorrectionRecord,
} from "./types/jarvis";
import {
  ConversationBackend,
  ExecutorStatus,
  LocalSpeechOutputStatus,
  LocalVoiceBackendStatus,
  OllamaStatus,
  SpeechOutputBackend,
  SpeechRecognitionState,
  VoiceBackend,
  VoiceSessionPhase,
  WakeModeStatus,
} from "./types/voice";

type BrowserRecognitionHandle = ReturnType<typeof createVoiceRecognition>;

type SkillStatus = "ready" | "planned";

type Skill = {
  name: string;
  description: string;
  status: SkillStatus;
};

const skills: Skill[] = [
  {
    name: "Study Setup",
    description: "Launch your preferred learning stack in one command.",
    status: "ready",
  },
  {
    name: "Web Actions",
    description: "Open websites, route searches, and summarize pages later.",
    status: "ready",
  },
  {
    name: "Notion Notes",
    description: "Create, list, and search external notes through Notion.",
    status: "ready",
  },
  {
    name: "Calendar",
    description: "Create Google Calendar event drafts from natural language.",
    status: "ready",
  },
  {
    name: "Reminders",
    description: "Capture reminder drafts in Google Calendar from natural language.",
    status: "ready",
  },
  {
    name: "File Search",
    description: "Find and open local files from your Documents area.",
    status: "ready",
  },
  {
    name: "Spotify Control",
    description: "Connect Spotify and control playback from natural voice or text commands.",
    status: "ready",
  },
  {
    name: "Gmail",
    description: "Read unread mail and search your inbox through Gmail.",
    status: "ready",
  },
];

const quickPrompts = [
  "Open my study apps",
  "Search machine learning on Google",
  "Open YouTube",
  "Make a note to review calculus tonight",
  "Add gym tomorrow at 6 PM to my calendar",
  "Remind me to call mom tomorrow at 5 PM",
  "Find my resume",
  "Find PDFs",
  "Open PDF 1",
  "Read PDF 1",
  "Summarize PDF 1",
  "Make tasks from PDF 1",
  "What's playing on Spotify",
  "Show unread emails",
  "Analyze email 1",
  "Save this email to Notion",
  "Read email 1",
  "Open email 1",
  "Show today's tasks",
  "Show upcoming tasks",
  "Complete task 1",
  "Complete task about report",
  "Move task 1 to tomorrow",
  "Reopen task 1",
  "Show done tasks",
  "Create daily brief",
];

const skillAutopilotAvailable = false;

type CommandResult = {
  title: string;
  detail: string;
};

type ConversationTurn = {
  id: number;
  role: "user" | "jarvis";
  text: string;
};

type VoiceReplyMode = "quiet" | "brief" | "normal" | "detailed";

type PersonMemoryRecord = {
  id: string;
  name: string;
  birthdayLabel: string;
  month: number;
  day: number;
  source: "manual" | "gmail";
  createdAt: string;
  updatedAt: string;
};

type TravelMemoryRecord = {
  id: string;
  title: string;
  sourceEmailSubject: string;
  summary: string;
  createdAt: string;
};

type TravelExtraction = {
  transport: string[];
  stays: string[];
  bookings: string[];
  addresses: string[];
  dates: string[];
  confirmationCodes: string[];
};

type ExpenseMemoryRecord = {
  id: string;
  title: string;
  sourceEmailSubject: string;
  merchant: string | null;
  amount: string | null;
  summary: string;
  createdAt: string;
};

type ExpenseExtraction = {
  merchants: string[];
  amounts: string[];
  categories: string[];
  dates: string[];
  orderNumbers: string[];
  notes: string[];
};

type PackageMemoryRecord = {
  id: string;
  title: string;
  sourceEmailSubject: string;
  carrier: string | null;
  status: string | null;
  deliveryDate: string | null;
  summary: string;
  createdAt: string;
};

type PackageExtraction = {
  carriers: string[];
  statuses: string[];
  deliveryDates: string[];
  trackingNumbers: string[];
  addresses: string[];
  notes: string[];
};

type MeetingPrepMemoryRecord = {
  id: string;
  eventTitle: string;
  summaryTitle: string;
  summary: string;
  createdAt: string;
};

type SchoolPlanMemoryRecord = {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
};

type CommandIntent =
  | { kind: "study_setup" }
  | { kind: "google_search"; query: string }
  | { kind: "open_url"; url: string }
  | { kind: "create_note"; content: string }
  | { kind: "remember_person_birthday"; name: string; birthdayLabel: string; month: number; day: number }
  | { kind: "list_birthdays" }
  | { kind: "list_upcoming_birthdays" }
  | { kind: "show_person_birthday"; query: string }
  | { kind: "create_task_note"; title: string; dueLabel: string | null }
  | { kind: "list_notes" }
  | { kind: "search_notes"; query: string }
  | { kind: "read_current_note" }
  | { kind: "read_note_by_index"; index: number }
  | { kind: "open_current_note" }
  | { kind: "open_note_by_index"; index: number }
  | { kind: "list_today_tasks" }
  | { kind: "list_upcoming_tasks" }
  | { kind: "list_overdue_tasks" }
  | { kind: "create_calendar_event"; title: string; start: Date; end: Date }
  | { kind: "create_reminder"; title: string; start: Date; end: Date }
  | { kind: "search_files"; query: string }
  | { kind: "list_pdfs" }
  | { kind: "search_pdfs"; query: string }
  | { kind: "open_current_pdf" }
  | { kind: "open_pdf_by_index"; index: number }
  | { kind: "open_pdf_by_query"; query: string }
  | { kind: "read_current_pdf" }
  | { kind: "read_pdf_by_index"; index: number }
  | { kind: "read_pdf_by_query"; query: string }
  | { kind: "summarize_current_pdf" }
  | { kind: "summarize_pdf_by_index"; index: number }
  | { kind: "summarize_pdf_by_query"; query: string }
  | { kind: "summarize_pdf_range"; indices: number[] }
  | { kind: "save_current_pdf_summary_to_notion" }
  | { kind: "save_pdf_summary_to_notion_by_index"; index: number }
  | { kind: "save_pdf_summary_to_notion_by_query"; query: string }
  | { kind: "create_tasks_from_current_pdf" }
  | { kind: "create_tasks_from_pdf_by_index"; index: number }
  | { kind: "create_tasks_from_pdf_by_query"; query: string }
  | { kind: "list_recent_files" }
  | { kind: "open_file"; path: string }
  | { kind: "spotify_play" }
  | { kind: "spotify_pause" }
  | { kind: "spotify_next" }
  | { kind: "spotify_previous" }
  | { kind: "spotify_status" }
  | { kind: "list_unread_emails" }
  | { kind: "search_emails"; query: string }
  | { kind: "save_latest_email_to_notion" }
  | { kind: "save_current_email_to_notion" }
  | { kind: "save_email_digest_to_notion" }
  | { kind: "save_first_emails_to_notion"; count: number }
  | { kind: "save_email_range_to_notion"; indices: number[] }
  | { kind: "save_email_to_notion_by_index"; index: number }
  | { kind: "save_email_to_notion_by_query"; query: string }
  | { kind: "extract_email_signals"; index: number | null }
  | { kind: "extract_current_email_signals" }
  | { kind: "extract_email_signals_by_query"; query: string }
  | { kind: "save_birthdays_from_current_email" }
  | { kind: "save_birthdays_from_email_index"; index: number }
  | { kind: "save_birthdays_from_email_query"; query: string }
  | { kind: "save_birthdays_from_loaded_emails" }
  | { kind: "extract_current_email_travel" }
  | { kind: "extract_email_travel"; index: number | null }
  | { kind: "extract_email_travel_by_query"; query: string }
  | { kind: "save_current_email_travel_to_notion" }
  | { kind: "save_email_travel_to_notion_by_index"; index: number }
  | { kind: "save_email_travel_to_notion_by_query"; query: string }
  | { kind: "extract_current_email_expense" }
  | { kind: "extract_email_expense"; index: number | null }
  | { kind: "extract_email_expense_by_query"; query: string }
  | { kind: "save_current_email_expense_to_notion" }
  | { kind: "save_email_expense_to_notion_by_index"; index: number }
  | { kind: "save_email_expense_to_notion_by_query"; query: string }
  | { kind: "extract_current_email_package" }
  | { kind: "extract_email_package"; index: number | null }
  | { kind: "extract_email_package_by_query"; query: string }
  | { kind: "save_current_email_package_to_notion" }
  | { kind: "save_email_package_to_notion_by_index"; index: number }
  | { kind: "save_email_package_to_notion_by_query"; query: string }
  | { kind: "read_current_email" }
  | { kind: "read_email_by_index"; index: number }
  | { kind: "read_email_by_query"; query: string }
  | { kind: "open_current_email" }
  | { kind: "open_email_by_index"; index: number }
  | { kind: "open_email_by_query"; query: string }
  | { kind: "create_calendar_event_from_current_email" }
  | { kind: "create_calendar_event_from_email"; index: number | null }
  | { kind: "create_calendar_event_from_email_query"; query: string }
  | { kind: "complete_task_by_index"; index: number }
  | { kind: "complete_task_by_query"; query: string }
  | { kind: "complete_task_range"; indices: number[] }
  | { kind: "update_task_by_index"; index: number; title: string; dueLabel: string | null }
  | { kind: "update_task_by_query"; query: string; title: string; dueLabel: string | null }
  | { kind: "reopen_task_by_index"; index: number }
  | { kind: "reopen_task_by_query"; query: string }
  | { kind: "move_task_by_index"; index: number; dueLabel: string }
  | { kind: "move_task_by_query"; query: string; dueLabel: string }
  | { kind: "list_done_tasks" }
  | { kind: "list_open_tasks" }
  | { kind: "filter_tasks_by_query"; query: string }
  | { kind: "summarize_all_loaded_pdfs" }
  | { kind: "complete_all_overdue_tasks" }
  | { kind: "create_daily_brief" }
  | { kind: "list_travel_memory" }
  | { kind: "list_expense_memory" }
  | { kind: "list_package_memory" }
  | { kind: "create_meeting_prep"; query: string | null }
  | { kind: "save_meeting_prep_to_notion"; query: string | null }
  | { kind: "list_meeting_prep_memory" }
  | { kind: "create_school_plan" }
  | { kind: "save_school_plan_to_notion" }
  | { kind: "list_school_memory" }
  | { kind: "complete_current_task" }
  | { kind: "reopen_current_task" }
  | { kind: "move_current_task"; dueLabel: string }
  | { kind: "open_current_browser_target" }
  | { kind: "set_voice_reply_mode"; mode: VoiceReplyMode }
  | { kind: "report_voice_reply_mode" }
  | { kind: "standby_mode" }
  | { kind: "sleep_mode" }
  | { kind: "shutdown_app" };

type ClarificationChoice = {
  label: string;
  intent: CommandIntent;
};

type PendingClarification = {
  prompt: string;
  choices: ClarificationChoice[];
  originalPhrase?: string;
  suggestedLearning?: {
    originalPhrase: string;
    sourcePhrase: string;
    intent: CommandIntent;
  };
};

type FollowUpWindow = {
  active: boolean;
  reason: "wake" | "reply" | "clarification";
};

const FOLLOW_UP_WINDOW_MS = 12000;

type PlannerTaskRecord = {
  id: string;
  title: string;
  dueLabel: string | null;
  dueDate: Date | null;
  status: "today" | "upcoming" | "overdue" | "unscheduled" | "done";
  sourceNote: NoteRecord;
};

type EmailSignals = {
  deadlines: string[];
  birthdays: string[];
  meetings: string[];
  addresses: string[];
  reminders: string[];
};

type PdfTaskCandidate = {
  title: string;
  dueLabel: string | null;
};

type ActiveConversationContext =
  | {
      kind: "email";
      emailId: string;
      threadId: string;
      label: string;
    }
  | {
      kind: "pdf";
      path: string;
      label: string;
    }
  | {
      kind: "note";
      noteId: string;
      label: string;
      url: string;
    }
  | {
      kind: "task";
      noteId: string;
      label: string;
      dueLabel: string | null;
    }
  | {
      kind: "browser";
      url: string;
      label: string;
    };

type PresentedCollectionContext =
  | {
      kind: "emails";
      emailIds: string[];
    }
  | {
      kind: "pdfs";
      paths: string[];
    }
  | {
      kind: "notes";
      noteIds: string[];
    }
  | {
      kind: "tasks";
      noteIds: string[];
    };

type ModelInterpretationResult =
  | { kind: "intent"; intent: CommandIntent }
  | { kind: "clarification"; prompt: string }
  | { kind: "unsupported" };

type RunCommandOutcome =
  | { status: "completed" }
  | { status: "empty" }
  | { status: "clarification" }
  | { status: "missing_skill" }
  | { status: "failed" };

type SavedWorkflowRecord = {
  id: string;
  name: string;
  triggerPhrase: string;
  steps: string[];
  createdAt: string;
  basedOnCount: number;
};

type WorkflowSuggestionRecord = {
  signature: string;
  name: string;
  triggerPhrase: string;
  steps: string[];
  basedOnCount: number;
  sampleCommand: string;
};

type WorkflowTemplateRecord = {
  id: string;
  name: string;
  description: string;
  triggerPhrase: string;
  steps: string[];
};

type WorkflowStepResolution =
  | { action: "run"; step: string }
  | { action: "skip" }
  | { action: "stop" };

type PendingWorkflowExecution =
  | {
      workflowId: string;
      workflowName: string;
      inputText: string;
      currentStepIndex: number;
      rawSteps: string[];
      missingPlaceholder: "input";
    }
  | {
      workflowId: string;
      workflowName: string;
      inputText: string;
      currentStepIndex: number;
      rawSteps: string[];
      missingPlaceholder: "current_email" | "current_pdf" | "current_note" | "current_task";
    };

const builtInBrowserAliases: Record<string, string> = {
  google: "https://www.google.com",
  gmail: "https://mail.google.com",
  youtube: "https://www.youtube.com",
  docs: "https://docs.google.com",
  "google docs": "https://docs.google.com",
  calendar: "https://calendar.google.com",
  "google calendar": "https://calendar.google.com",
  drive: "https://drive.google.com",
  "google drive": "https://drive.google.com",
  notion: "https://www.notion.so",
  spotify: "https://open.spotify.com",
  github: "https://github.com",
};

const canonicalHostRoots: Record<string, string> = {
  "google.com": "https://www.google.com/",
  "www.google.com": "https://www.google.com/",
  "mail.google.com": "https://mail.google.com/",
  "youtube.com": "https://www.youtube.com/",
  "www.youtube.com": "https://www.youtube.com/",
  "docs.google.com": "https://docs.google.com/",
  "calendar.google.com": "https://calendar.google.com/",
  "drive.google.com": "https://drive.google.com/",
  "github.com": "https://github.com/",
  "www.github.com": "https://github.com/",
  "open.spotify.com": "https://open.spotify.com/",
  "spotify.com": "https://open.spotify.com/",
  "www.notion.so": "https://www.notion.so/",
  "notion.so": "https://www.notion.so/",
};

function isStudyAppsCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.includes("study apps") ||
    normalized.includes("study stuff") ||
    normalized.includes("study setup") ||
    normalized.includes("study mode") ||
    normalized.includes("study session") ||
    normalized.includes("focus setup") ||
    normalized.includes("focus mode") ||
    normalized.includes("get my study") ||
    normalized.includes("ready for study")
  );
}

function cleanConversationalCommand(command: string) {
  return command
    .trim()
    .replace(/^jarvis[\s,:-]*/i, "")
    .replace(/^(hey|hi|hello)\s+jarvis[\s,:-]*/i, "")
    .replace(/\bplease\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeControlCommand(command: string) {
  return cleanConversationalCommand(command)
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, "")
    .trim();
}

function normalizeLearnedPhrase(command: string) {
  return normalizeControlCommand(command);
}

function normalizeWakeTranscript(transcript: string) {
  return transcript
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wakeTranscriptMatchesAssistant(transcript: string, assistantName: string) {
  const normalizedTranscript = normalizeWakeTranscript(transcript);
  const wakeName = assistantName.trim().toLowerCase();

  if (!normalizedTranscript || !wakeName) {
    return false;
  }

  const escapedWakeName = escapeRegExp(wakeName);
  const wakePatterns = [
    new RegExp(`\\b${escapedWakeName}\\b`, "i"),
    new RegExp(`\\b(?:hey|hi|hello|okay|ok)\\s+${escapedWakeName}\\b`, "i"),
  ];

  return wakePatterns.some((pattern) => pattern.test(normalizedTranscript));
}

function extractWakeCommand(transcript: string, assistantName: string) {
  const wakeName = assistantName.trim();
  if (!wakeName) {
    return null;
  }

  const escapedWakeName = escapeRegExp(wakeName);
  const wakeCommandPatterns = [
    new RegExp(`^(?:hey|hi|hello|okay|ok)?\\s*${escapedWakeName}[\\s,:-]+(.+)$`, "i"),
  ];

  for (const pattern of wakeCommandPatterns) {
    const match = transcript.trim().match(pattern);
    const command = match?.[1]?.trim();
    if (command) {
      return cleanConversationalCommand(command);
    }
  }

  return null;
}

function parseWakeControlIntent(command: string, aliases: BrowserAliasRecord[]) {
  const intent = parseConversationalCommandIntent(command, aliases);
  if (
    intent?.kind === "standby_mode" ||
    intent?.kind === "sleep_mode" ||
    intent?.kind === "shutdown_app"
  ) {
    return intent;
  }

  return null;
}

function encodeLearnedIntent(intent: CommandIntent) {
  if (intent.kind === "create_calendar_event" || intent.kind === "create_reminder") {
    return JSON.stringify({
      ...intent,
      start: intent.start.toISOString(),
      end: intent.end.toISOString(),
    });
  }

  return JSON.stringify(intent);
}

function decodeLearnedIntent(record: LearnedIntentRecord): CommandIntent | null {
  try {
    const parsed = JSON.parse(record.intentPayload) as CommandIntent & {
      start?: string;
      end?: string;
    };

    if (parsed.kind === "create_calendar_event" || parsed.kind === "create_reminder") {
      if (!parsed.start || !parsed.end) {
        return null;
      }

      return {
        ...parsed,
        start: new Date(parsed.start),
        end: new Date(parsed.end),
      };
    }

    return parsed;
  } catch {
    return null;
  }
}

function resolveLearnedIntent(
  command: string,
  learnedIntentMappings: LearnedIntentRecord[],
): CommandIntent | null {
  const normalizedPhrase = normalizeLearnedPhrase(command);
  const record = learnedIntentMappings.find(
    (entry) => entry.normalizedPhrase === normalizedPhrase,
  );

  return record ? decodeLearnedIntent(record) : null;
}

function tokenizeLearnedPhrase(command: string) {
  return normalizeLearnedPhrase(command)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function scoreLearnedPhraseSimilarity(left: string, right: string) {
  const leftTokens = tokenizeLearnedPhrase(left);
  const rightTokens = tokenizeLearnedPhrase(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  const jaccard = union > 0 ? overlap / union : 0;
  const leftLastToken = leftTokens[leftTokens.length - 1];
  const rightLastToken = rightTokens[rightTokens.length - 1];
  const prefixBonus =
    leftTokens[0] === rightTokens[0] || leftLastToken === rightLastToken ? 0.15 : 0;

  return Math.min(1, jaccard + prefixBonus);
}

function findLearnedIntentSuggestion(
  command: string,
  learnedIntentMappings: LearnedIntentRecord[],
) {
  const normalizedPhrase = normalizeLearnedPhrase(command);
  let bestMatch:
    | {
        record: LearnedIntentRecord;
        intent: CommandIntent;
        score: number;
      }
    | null = null;

  for (const record of learnedIntentMappings) {
    const intent = decodeLearnedIntent(record);
    if (!intent) {
      continue;
    }

    const score = scoreLearnedPhraseSimilarity(normalizedPhrase, record.normalizedPhrase);
    if (score < 0.58) {
      continue;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        record,
        intent,
        score,
      };
    }
  }

  return bestMatch;
}

function resolveContextualFollowUpIntent(
  command: string,
  activeContext: ActiveConversationContext | null,
): CommandIntent | null {
  if (!activeContext) {
    return null;
  }

  const normalized = normalizeControlCommand(command);

  if (activeContext.kind === "email") {
    if (["save it to notion", "save that to notion", "save it as a note"].includes(normalized)) {
      return { kind: "save_current_email_to_notion" };
    }

    if (["read it", "show it", "read that", "show that"].includes(normalized)) {
      return { kind: "read_current_email" };
    }

    if (["open it", "open that"].includes(normalized)) {
      return { kind: "open_current_email" };
    }

    if (
      [
        "analyze it",
        "analyze that",
        "extract details from it",
        "extract details from that",
      ].includes(normalized)
    ) {
      return { kind: "extract_current_email_signals" };
    }

    if (
      [
        "add it to calendar",
        "turn it into a calendar event",
        "make a calendar event from it",
      ].includes(normalized)
    ) {
      return { kind: "create_calendar_event_from_current_email" };
    }
  }

  if (activeContext.kind === "pdf") {
    if (["open it", "open that"].includes(normalized)) {
      return { kind: "open_current_pdf" };
    }

    if (["read it", "show it", "read that", "show that"].includes(normalized)) {
      return { kind: "read_current_pdf" };
    }

    if (["summarize it", "summarize that", "summarize it first"].includes(normalized)) {
      return { kind: "summarize_current_pdf" };
    }

    if (["save it to notion", "save that to notion", "save its summary to notion"].includes(normalized)) {
      return { kind: "save_current_pdf_summary_to_notion" };
    }

    if (["make tasks from it", "create tasks from it", "make tasks from that"].includes(normalized)) {
      return { kind: "create_tasks_from_current_pdf" };
    }
  }

  if (activeContext.kind === "note") {
    if (["read it", "show it", "read that", "show that"].includes(normalized)) {
      return { kind: "read_current_note" };
    }

    if (["open it", "open that"].includes(normalized)) {
      return { kind: "open_current_note" };
    }
  }

  if (activeContext.kind === "task") {
    if (["complete it", "complete that", "mark it done", "mark that done"].includes(normalized)) {
      return { kind: "complete_current_task" };
    }

    if (["reopen it", "reopen that"].includes(normalized)) {
      return { kind: "reopen_current_task" };
    }

    if (["move it to today", "move that to today"].includes(normalized)) {
      return { kind: "move_current_task", dueLabel: "today" };
    }

    if (["move it to tomorrow", "move that to tomorrow"].includes(normalized)) {
      return { kind: "move_current_task", dueLabel: "tomorrow" };
    }
  }

  if (activeContext.kind === "browser") {
    if (["open it", "open it again", "open that", "open that again"].includes(normalized)) {
      return { kind: "open_current_browser_target" };
    }
  }

  return null;
}

function resolveOrdinalIndex(command: string) {
  const normalized = normalizeControlCommand(command);
  if (normalized.includes("first one")) {
    return 1;
  }

  if (normalized.includes("second one")) {
    return 2;
  }

  if (normalized.includes("third one")) {
    return 3;
  }

  return null;
}

function resolveOrdinalFollowUpIntent(
  command: string,
  collection: PresentedCollectionContext | null,
  emails: EmailRecord[],
  files: FileRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
): CommandIntent | null {
  if (!collection) {
    return null;
  }

  const index = resolveOrdinalIndex(command);
  if (!index) {
    return null;
  }

  const normalized = normalizeControlCommand(command);

  if (collection.kind === "emails") {
    const emailId = collection.emailIds[index - 1];
    const resolvedIndex = emailId
      ? emails.findIndex((email) => email.id === emailId) + 1
      : 0;
    if (resolvedIndex < 1) {
      return null;
    }

    if (normalized.startsWith("open the")) {
      return { kind: "open_email_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("read the") || normalized.startsWith("show the")) {
      return { kind: "read_email_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("save the")) {
      return { kind: "save_email_to_notion_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("analyze the") || normalized.startsWith("extract details from the")) {
      return { kind: "extract_email_signals", index: resolvedIndex };
    }

    if (normalized.startsWith("add the")) {
      return { kind: "create_calendar_event_from_email", index: resolvedIndex };
    }
  }

  if (collection.kind === "pdfs") {
    const path = collection.paths[index - 1];
    const resolvedIndex = path ? getLoadedPdfFiles(files).findIndex((file) => file.path === path) + 1 : 0;
    if (resolvedIndex < 1) {
      return null;
    }

    if (normalized.startsWith("open the")) {
      return { kind: "open_pdf_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("read the") || normalized.startsWith("show the")) {
      return { kind: "read_pdf_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("summarize the")) {
      return { kind: "summarize_pdf_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("save the")) {
      return { kind: "save_pdf_summary_to_notion_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("make tasks from the") || normalized.startsWith("create tasks from the")) {
      return { kind: "create_tasks_from_pdf_by_index", index: resolvedIndex };
    }
  }

  if (collection.kind === "notes") {
    const noteId = collection.noteIds[index - 1];
    const resolvedIndex = noteId ? notes.findIndex((note) => note.id === noteId) + 1 : 0;
    if (resolvedIndex < 1) {
      return null;
    }

    if (normalized.startsWith("open the")) {
      return { kind: "open_note_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("read the") || normalized.startsWith("show the")) {
      return { kind: "read_note_by_index", index: resolvedIndex };
    }
  }

  if (collection.kind === "tasks") {
    const noteId = collection.noteIds[index - 1];
    const resolvedIndex = noteId ? tasks.findIndex((task) => task.id === noteId) + 1 : 0;
    if (resolvedIndex < 1) {
      return null;
    }

    if (normalized.startsWith("complete the")) {
      return { kind: "complete_task_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("reopen the")) {
      return { kind: "reopen_task_by_index", index: resolvedIndex };
    }

    if (normalized === "move the first one to today" || normalized === "move the second one to today" || normalized === "move the third one to today") {
      return { kind: "move_task_by_index", index: resolvedIndex, dueLabel: "today" };
    }

    if (normalized === "move the first one to tomorrow" || normalized === "move the second one to tomorrow" || normalized === "move the third one to tomorrow") {
      return { kind: "move_task_by_index", index: resolvedIndex, dueLabel: "tomorrow" };
    }
  }

  return null;
}

function resolveReferenceQuery(command: string) {
  const trimmed = cleanConversationalCommand(command);
  const match = trimmed.match(
    /^(?:open|read|show|save|analyze|extract details from|add|summarize|make tasks from|create tasks from|complete|reopen|move)\s+(?:the\s+)?(?:email|pdf|note|task|one)\s+(?:about|called|named)\s+(.+)$/i,
  );
  return match?.[1]?.trim() ?? null;
}

function getPresentedCollectionSize(collection: PresentedCollectionContext | null) {
  if (!collection) {
    return 0;
  }

  if (collection.kind === "emails") {
    return collection.emailIds.length;
  }

  if (collection.kind === "pdfs") {
    return collection.paths.length;
  }

  return collection.noteIds.length;
}

function mapCollectionIntent(
  kind: PresentedCollectionContext["kind"],
  normalized: string,
  resolvedIndex: number,
): CommandIntent | null {
  if (kind === "emails") {
    if (normalized.startsWith("open ")) {
      return { kind: "open_email_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("read ") || normalized.startsWith("show ")) {
      return { kind: "read_email_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("save ")) {
      return { kind: "save_email_to_notion_by_index", index: resolvedIndex };
    }

    if (
      normalized.startsWith("analyze ") ||
      normalized.startsWith("extract details from ")
    ) {
      return { kind: "extract_email_signals", index: resolvedIndex };
    }

    if (normalized.startsWith("add ")) {
      return { kind: "create_calendar_event_from_email", index: resolvedIndex };
    }
  }

  if (kind === "pdfs") {
    if (normalized.startsWith("open ")) {
      return { kind: "open_pdf_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("read ") || normalized.startsWith("show ")) {
      return { kind: "read_pdf_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("summarize ")) {
      return { kind: "summarize_pdf_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("save ")) {
      return { kind: "save_pdf_summary_to_notion_by_index", index: resolvedIndex };
    }

    if (
      normalized.startsWith("make tasks from ") ||
      normalized.startsWith("create tasks from ")
    ) {
      return { kind: "create_tasks_from_pdf_by_index", index: resolvedIndex };
    }
  }

  if (kind === "notes") {
    if (normalized.startsWith("open ")) {
      return { kind: "open_note_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("read ") || normalized.startsWith("show ")) {
      return { kind: "read_note_by_index", index: resolvedIndex };
    }
  }

  if (kind === "tasks") {
    if (normalized.startsWith("complete ")) {
      return { kind: "complete_task_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("reopen ")) {
      return { kind: "reopen_task_by_index", index: resolvedIndex };
    }

    if (normalized.includes(" to today")) {
      return { kind: "move_task_by_index", index: resolvedIndex, dueLabel: "today" };
    }

    if (normalized.includes(" to tomorrow")) {
      return { kind: "move_task_by_index", index: resolvedIndex, dueLabel: "tomorrow" };
    }
  }

  return null;
}

function getActivePresentedCollectionIndex(
  collection: PresentedCollectionContext,
  activeContext: ActiveConversationContext | null,
) {
  if (collection.kind === "emails") {
    const activeId = activeContext?.kind === "email" ? activeContext.emailId : null;
    return activeId ? collection.emailIds.findIndex((id) => id === activeId) + 1 : 0;
  }

  if (collection.kind === "pdfs") {
    const activePath = activeContext?.kind === "pdf" ? activeContext.path : null;
    return activePath ? collection.paths.findIndex((path) => path === activePath) + 1 : 0;
  }

  if (collection.kind === "notes") {
    const activeId = activeContext?.kind === "note" ? activeContext.noteId : null;
    return activeId ? collection.noteIds.findIndex((id) => id === activeId) + 1 : 0;
  }

  const activeId = activeContext?.kind === "task" ? activeContext.noteId : null;
  return activeId ? collection.noteIds.findIndex((id) => id === activeId) + 1 : 0;
}

function resolveCollectionPositions(
  collection: PresentedCollectionContext,
  activeContext: ActiveConversationContext | null,
  mode: "first" | "next" | "rest",
  count: number | null,
) {
  const size = getPresentedCollectionSize(collection);
  if (size < 1) {
    return [];
  }

  if (mode === "first") {
    const limitedCount = Math.max(1, Math.min(count ?? 1, size));
    return Array.from({ length: limitedCount }, (_, offset) => offset + 1);
  }

  const activeIndex = getActivePresentedCollectionIndex(collection, activeContext);
  const startIndex = activeIndex > 0 ? activeIndex + 1 : 1;
  if (startIndex > size) {
    return [];
  }

  if (mode === "next") {
    const limitedCount = Math.max(1, Math.min(count ?? 1, size - startIndex + 1));
    return Array.from({ length: limitedCount }, (_, offset) => startIndex + offset);
  }

  return Array.from({ length: size - startIndex + 1 }, (_, offset) => startIndex + offset);
}

function resolveCollectionGlobalIndices(
  collection: PresentedCollectionContext,
  positions: number[],
  emails: EmailRecord[],
  files: FileRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
) {
  if (positions.length === 0) {
    return [];
  }

  if (collection.kind === "emails") {
    return positions
      .map((position) => collection.emailIds[position - 1])
      .map((emailId) => (emailId ? emails.findIndex((email) => email.id === emailId) + 1 : 0))
      .filter((index) => index > 0);
  }

  if (collection.kind === "pdfs") {
    const loadedPdfs = getLoadedPdfFiles(files);
    return positions
      .map((position) => collection.paths[position - 1])
      .map((path) => (path ? loadedPdfs.findIndex((file) => file.path === path) + 1 : 0))
      .filter((index) => index > 0);
  }

  if (collection.kind === "notes") {
    return positions
      .map((position) => collection.noteIds[position - 1])
      .map((noteId) => (noteId ? notes.findIndex((note) => note.id === noteId) + 1 : 0))
      .filter((index) => index > 0);
  }

  return positions
    .map((position) => collection.noteIds[position - 1])
    .map((noteId) => (noteId ? tasks.findIndex((task) => task.id === noteId) + 1 : 0))
    .filter((index) => index > 0);
}

function resolveBatchReferenceFollowUpIntent(
  command: string,
  collection: PresentedCollectionContext | null,
  activeContext: ActiveConversationContext | null,
  emails: EmailRecord[],
  files: FileRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
): CommandIntent | null {
  if (!collection) {
    return null;
  }

  const normalized = normalizeControlCommand(command);
  const firstMatch = normalized.match(/\bfirst (\d+)(?: of (?:those|them))?\b/);
  const nextMatch = normalized.match(/\bnext (\d+)(?: of (?:those|them))?\b/);
  const wantsRest = /\b(?:the )?rest(?: of (?:those|them))?\b/.test(normalized);

  let mode: "first" | "next" | "rest" | null = null;
  let count: number | null = null;

  if (firstMatch) {
    mode = "first";
    count = Number(firstMatch[1]);
  } else if (nextMatch) {
    mode = "next";
    count = Number(nextMatch[1]);
  } else if (wantsRest) {
    mode = "rest";
  }

  if (!mode) {
    return null;
  }

  const positions = resolveCollectionPositions(collection, activeContext, mode, count);
  const indices = resolveCollectionGlobalIndices(collection, positions, emails, files, notes, tasks);
  if (indices.length === 0) {
    return null;
  }

  if (collection.kind === "emails") {
    if (normalized.startsWith("save ")) {
      return { kind: "save_email_range_to_notion", indices };
    }
    return null;
  }

  if (collection.kind === "pdfs") {
    if (normalized.startsWith("summarize ")) {
      return { kind: "summarize_pdf_range", indices };
    }
    return null;
  }

  if (collection.kind === "tasks") {
    if (normalized.startsWith("complete ")) {
      return { kind: "complete_task_range", indices };
    }
    return null;
  }

  return null;
}

function resolveReferenceFollowUpIntent(
  command: string,
  collection: PresentedCollectionContext | null,
  activeContext: ActiveConversationContext | null,
  emails: EmailRecord[],
  files: FileRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
): CommandIntent | null {
  if (!collection) {
    return null;
  }

  const normalized = normalizeControlCommand(command);
  let resolvedIndex = 0;

  if (/\b(last one|last email|last pdf|last note|last task)\b/.test(normalized)) {
    resolvedIndex = getPresentedCollectionSize(collection);
  } else if (/\b(other one|other email|other pdf|other note|other task)\b/.test(normalized)) {
    if (collection.kind === "emails") {
      const activeId = activeContext?.kind === "email" ? activeContext.emailId : null;
      const activeIndex = activeId ? collection.emailIds.findIndex((id) => id === activeId) : -1;
      resolvedIndex =
        activeIndex === 0 && collection.emailIds.length > 1
          ? 2
          : collection.emailIds.length > 0
            ? 1
            : 0;
    } else if (collection.kind === "pdfs") {
      const activePath = activeContext?.kind === "pdf" ? activeContext.path : null;
      const activeIndex = activePath ? collection.paths.findIndex((path) => path === activePath) : -1;
      resolvedIndex =
        activeIndex === 0 && collection.paths.length > 1
          ? 2
          : collection.paths.length > 0
            ? 1
            : 0;
    } else {
      const activeId =
        activeContext?.kind === "note" || activeContext?.kind === "task"
          ? activeContext.noteId
          : null;
      const ids = collection.noteIds;
      const activeIndex = activeId ? ids.findIndex((id) => id === activeId) : -1;
      resolvedIndex = activeIndex === 0 && ids.length > 1 ? 2 : ids.length > 0 ? 1 : 0;
    }
  } else {
    const query = resolveReferenceQuery(command);
    if (!query) {
      return null;
    }

    if (collection.kind === "emails") {
      const matched = collection.emailIds.find((emailId) => {
        const email = emails.find((entry) => entry.id === emailId);
        if (!email) {
          return false;
        }

        return `${email.subject} ${email.from} ${email.snippet}`.toLowerCase().includes(query.toLowerCase());
      });
      resolvedIndex = matched ? emails.findIndex((entry) => entry.id === matched) + 1 : 0;
    } else if (collection.kind === "pdfs") {
      const matched = collection.paths.find((path) => {
        const file = getLoadedPdfFiles(files).find((entry) => entry.path === path);
        return file ? file.name.toLowerCase().includes(query.toLowerCase()) : false;
      });
      resolvedIndex = matched
        ? getLoadedPdfFiles(files).findIndex((entry) => entry.path === matched) + 1
        : 0;
    } else if (collection.kind === "notes") {
      const matched = collection.noteIds.find((noteId) => {
        const note = notes.find((entry) => entry.id === noteId);
        return note ? `${note.title} ${note.summary}`.toLowerCase().includes(query.toLowerCase()) : false;
      });
      resolvedIndex = matched ? notes.findIndex((entry) => entry.id === matched) + 1 : 0;
    } else if (collection.kind === "tasks") {
      const matched = collection.noteIds.find((noteId) => {
        const task = tasks.find((entry) => entry.id === noteId);
        return task
          ? `${task.title} ${task.dueLabel ?? ""} ${task.sourceNote.summary}`.toLowerCase().includes(query.toLowerCase())
          : false;
      });
      resolvedIndex = matched ? tasks.findIndex((entry) => entry.id === matched) + 1 : 0;
    }
  }

  if (resolvedIndex < 1) {
    return null;
  }

  return mapCollectionIntent(collection.kind, normalized, resolvedIndex);
}

function normalizeUrlTarget(value: string) {
  const normalized = value.trim().toLowerCase();
  if (builtInBrowserAliases[normalized]) {
    return builtInBrowserAliases[normalized];
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.includes(".")) {
    return `https://${value}`;
  }

  return `https://${value}.com`;
}

function buildSpotifySearchUrl(query: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(query.trim())}`;
}

function canonicalizeBrowserUrl(value: string) {
  try {
    const parsed = new URL(normalizeUrlTarget(value));
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname || "/";
    const canonicalRoot = canonicalHostRoots[hostname];
    const isKnownHomePath =
      pathname === "/" ||
      pathname === "/home" ||
      pathname === "/feed" ||
      pathname === "/mail" ||
      pathname === "/inbox";

    const paramsToDrop = [
      "fbclid",
      "gclid",
      "feature",
      "mc_cid",
      "mc_eid",
      "si",
      "ref",
      "source",
      "sourceid",
      "utm_campaign",
      "utm_content",
      "utm_medium",
      "utm_source",
      "utm_term",
      "ved",
      "zx",
    ];

    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || paramsToDrop.includes(key)) {
        parsed.searchParams.delete(key);
      }
    }

    if (canonicalRoot && isKnownHomePath) {
      const hasMeaningfulSearch =
        (hostname === "google.com" || hostname === "www.google.com") &&
        parsed.pathname === "/search" &&
        parsed.searchParams.has("q");

      if (!hasMeaningfulSearch) {
        return canonicalRoot;
      }
    }

    parsed.hash = "";

    if (!parsed.search) {
      return `${parsed.origin}${parsed.pathname}`;
    }

    return parsed.toString();
  } catch {
    return normalizeUrlTarget(value);
  }
}

function formatBrowserTargetLabel(url: string) {
  try {
    const parsed = new URL(canonicalizeBrowserUrl(url));
    const hostname = parsed.hostname.toLowerCase();

    const knownLabels: Record<string, string> = {
      "www.google.com": "Google",
      "google.com": "Google",
      "mail.google.com": "Gmail",
      "www.youtube.com": "YouTube",
      "youtube.com": "YouTube",
      "docs.google.com": "Google Docs",
      "calendar.google.com": "Google Calendar",
      "drive.google.com": "Google Drive",
      "github.com": "GitHub",
      "www.github.com": "GitHub",
      "open.spotify.com": "Spotify",
      "spotify.com": "Spotify",
      "www.notion.so": "Notion",
      "notion.so": "Notion",
    };

    if (knownLabels[hostname]) {
      return knownLabels[hostname];
    }

    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function buildStudySetupReply() {
  return "Alright, getting your study setup ready.";
}

function buildGoogleSearchReply(query: string) {
  return `Sure, searching Google for ${query}.`;
}

function buildOpenSiteReply(label: string) {
  return `Yeah, opening ${label}.`;
}

function buildCreateNoteReply(title: string) {
  return `Alright, I saved that to Notion as ${title}.`;
}

function buildCreateTaskReply(title: string) {
  return `Alright, I saved that task to Notion as ${title}.`;
}

function buildListNotesReply(count: number) {
  return count === 0
    ? "I checked Notion, but I did not find any notes yet."
    : `I found ${count} recent Notion notes.`;
}

function buildSearchNotesReply(query: string, count: number) {
  return count === 0
    ? `I did not find any Notion notes about ${query}.`
    : `I found ${count} Notion notes about ${query}.`;
}

function buildReadNoteReply(title: string) {
  return `Alright, here is ${title}.`;
}

function buildOpenNoteReply(title: string) {
  return `Alright, opening ${title} in Notion.`;
}

function buildTodayTasksReply(count: number) {
  return count === 0
    ? "I did not find any task notes due today in Notion."
    : `I found ${count} task notes due today.`;
}

function buildUpcomingTasksReply(count: number) {
  return count === 0
    ? "I did not find any upcoming task notes in Notion."
    : `I found ${count} upcoming task notes.`;
}

function buildOverdueTasksReply(count: number) {
  return count === 0
    ? "I did not find any overdue task notes in Notion."
    : `I found ${count} overdue task notes.`;
}

function buildCalendarEventReply(title: string) {
  return `Alright, I opened a calendar draft for ${title}.`;
}

function buildReminderReply(title: string) {
  return `Alright, I opened a reminder draft for ${title}.`;
}

function buildFileSearchReply(query: string, count: number) {
  return count === 0
    ? `I did not find any files matching ${query}.`
    : `I found ${count} files matching ${query}.`;
}

function buildRecentFilesReply(count: number) {
  return count === 0
    ? "I could not find any recent files in your Documents folder."
    : `I found ${count} recent files in your Documents folder.`;
}

function buildOpenFileReply(name: string) {
  return `Alright, opening ${name}.`;
}

function buildPdfSummaryReply(name: string) {
  return `Alright, I summarized ${name}.`;
}

function buildPdfTasksReply(name: string, count: number) {
  return `Alright, I created ${count} task${count === 1 ? "" : "s"} from ${name}.`;
}

function buildReadPdfReply(name: string) {
  return `Alright, here is the extracted text from ${name}.`;
}

function buildSpotifyPlayReply() {
  return "Alright, resuming Spotify.";
}

function buildSpotifyPauseReply() {
  return "Okay, pausing Spotify.";
}

function buildSpotifySkipReply(direction: "next" | "previous") {
  return direction === "next"
    ? "Alright, skipping to the next track."
    : "Okay, going back to the previous track.";
}

function buildSpotifyStatusReply(playback: SpotifyPlaybackState | null) {
  if (!playback?.title) {
    return "Spotify is connected, but nothing is actively playing right now.";
  }

  const action = playback.isPlaying ? "playing" : "paused on";
  return `Spotify is ${action} ${playback.title} by ${playback.artist ?? "an unknown artist"}.`;
}

function buildUnreadEmailReply(count: number) {
  return count === 0
    ? "I checked Gmail, but there are no unread emails right now."
    : `I found ${count} unread emails in Gmail.`;
}

function buildSearchEmailReply(query: string, count: number) {
  return count === 0
    ? `I did not find any Gmail messages matching ${query}.`
    : `I found ${count} Gmail messages matching ${query}.`;
}

function buildSaveLatestEmailToNotionReply(title: string) {
  return `Alright, I saved the latest email to Notion as ${title}.`;
}

function buildSaveEmailDigestToNotionReply(title: string, count: number) {
  return `Alright, I saved a Notion digest for ${count} emails as ${title}.`;
}

function buildBatchEmailSaveReply(count: number) {
  return `Alright, I saved the first ${count} email${count === 1 ? "" : "s"} to Notion.`;
}

function buildSaveIndexedEmailToNotionReply(title: string, index: number) {
  return `Alright, I saved email ${index} to Notion as ${title}.`;
}

function buildSaveQueriedEmailToNotionReply(title: string, query: string) {
  return `Alright, I saved the email about ${query} to Notion as ${title}.`;
}

function buildEmailToCalendarReply(title: string) {
  return `Alright, I opened a calendar item from the email about ${title}.`;
}

function buildReadEmailReply(title: string) {
  return `Alright, here is the email about ${title}.`;
}

function buildOpenEmailReply(title: string) {
  return `Alright, I opened the email about ${title}.`;
}

function buildEmailSignalsReply(title: string) {
  return `Alright, I pulled the important details out of the email about ${title}.`;
}

function buildCompleteTaskReply(title: string) {
  return `Alright, I marked ${title} as done in Notion.`;
}

function buildUpdateTaskReply(title: string) {
  return `Alright, I updated that task in Notion to ${title}.`;
}

function buildReopenTaskReply(title: string) {
  return `Alright, I reopened ${title} in Notion.`;
}

function buildMoveTaskReply(title: string, dueLabel: string) {
  return `Alright, I moved ${title} to ${dueLabel}.`;
}

function buildBatchPdfSummaryReply(count: number) {
  return `Alright, I summarized ${count} loaded PDF${count === 1 ? "" : "s"}.`;
}

function buildBatchOverdueTaskReply(count: number) {
  return count === 0
    ? "I didn't find any overdue tasks to complete."
    : `Alright, I completed ${count} overdue task${count === 1 ? "" : "s"}.`;
}

function buildDailyBriefReply(title: string) {
  return `Alright, I put together your daily brief and saved it to Notion as ${title}.`;
}

function buildSleepReply(assistantName: string) {
  return `${assistantName} is going to sleep. Wake mode is off for this session.`;
}

function buildStandbyReply(assistantName: string) {
  return `${assistantName} is standing by. Wake mode is armed again.`;
}

function buildShutdownReply(assistantName: string) {
  return `Shutting down ${assistantName} now.`;
}

function formatVoiceReplyModeLabel(mode: VoiceReplyMode) {
  switch (mode) {
    case "quiet":
      return "quiet";
    case "brief":
      return "brief";
    case "detailed":
      return "detailed";
    default:
      return "normal";
  }
}

function buildVoiceReplyModeReply(mode: VoiceReplyMode) {
  switch (mode) {
    case "quiet":
      return "Okay. I will stay quiet unless you read the screen.";
    case "brief":
      return "Okay. I will keep my spoken replies brief.";
    case "detailed":
      return "Alright. I will use fuller spoken replies when I can.";
    default:
      return "Okay. I am back to my normal reply style.";
  }
}

function buildVoiceReplyModeDetail(mode: VoiceReplyMode) {
  switch (mode) {
    case "quiet":
      return "JARVIS will keep listening, but it will stop speaking replies out loud.";
    case "brief":
      return "JARVIS will shorten spoken replies to the essential part when possible.";
    case "detailed":
      return "JARVIS will avoid shortening spoken replies and keep fuller voice confirmations.";
    default:
      return "JARVIS will use its standard spoken reply style.";
  }
}

function formatBirthdayLabel(month: number, day: number) {
  const monthName = new Date(2000, month - 1, day).toLocaleString("en-US", {
    month: "long",
  });
  return `${monthName} ${day}`;
}

function buildBirthdaySavedReply(name: string, birthdayLabel: string) {
  return `Okay. I saved ${name}'s birthday as ${birthdayLabel}.`;
}

function buildBirthdayLookupReply(name: string, birthdayLabel: string) {
  return `${name}'s birthday is saved as ${birthdayLabel}.`;
}

function buildBirthdayImportReply(count: number) {
  return count === 0
    ? "I didn't find any clear birthdays to save from that email yet."
    : `Alright. I saved ${count} birthday${count === 1 ? "" : "s"} to people memory.`;
}

function buildTravelExtractionReply(title: string) {
  return `Alright. I pulled the travel details I could find from ${title}.`;
}

function buildTravelSavedReply(title: string) {
  return `Okay. I saved the travel summary from ${title} to Notion.`;
}

function buildExpenseExtractionReply(title: string) {
  return `Alright. I pulled the expense details I could find from ${title}.`;
}

function buildExpenseSavedReply(title: string) {
  return `Okay. I saved the expense summary from ${title} to Notion.`;
}

function buildPackageExtractionReply(title: string) {
  return `Alright. I pulled the package details I could find from ${title}.`;
}

function buildPackageSavedReply(title: string) {
  return `Okay. I saved the package summary from ${title} to Notion.`;
}

function buildMeetingPrepReply(title: string) {
  return `Alright. I put together a meeting prep summary for ${title}.`;
}

function buildMeetingPrepSavedReply(title: string) {
  return `Okay. I saved the meeting prep note for ${title} to Notion.`;
}

function buildSchoolPlanReply() {
  return "Alright. I put together a school mode study plan for you.";
}

function buildSchoolPlanSavedReply(title: string) {
  return `Okay. I saved your school mode plan to Notion as ${title}.`;
}

function formatEmailForNotion(email: EmailRecord) {
  return [
    `Email: ${email.subject}`,
    "",
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    email.body ? email.body.slice(0, 4000) : "",
    email.body ? "" : "",
    email.snippet || "No preview available.",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatEmailForReading(email: EmailRecord) {
  return [
    `Subject: ${email.subject}`,
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    email.body?.trim() || email.snippet || "No email body was available.",
  ]
    .filter(Boolean)
    .join("\n");
}

function isPdfFile(file: FileRecord) {
  return file.path.toLowerCase().endsWith(".pdf") || file.name.toLowerCase().endsWith(".pdf");
}

function getLoadedPdfFiles(files: FileRecord[]) {
  return files.filter(isPdfFile);
}

function getPdfByIndex(files: FileRecord[], index: number) {
  if (!Number.isFinite(index) || index < 1) {
    return null;
  }

  return getLoadedPdfFiles(files)[index - 1] ?? null;
}

function getCurrentPdf(files: FileRecord[]) {
  return getLoadedPdfFiles(files)[0] ?? null;
}

function createActivePdfContext(file: FileRecord): ActiveConversationContext {
  return {
    kind: "pdf",
    path: file.path,
    label: file.name,
  };
}

function findPdfByQuery(files: FileRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    getLoadedPdfFiles(files).find((file) =>
      `${file.name} ${file.path}`.toLowerCase().includes(normalized),
    ) ?? null
  );
}

function buildGmailThreadUrl(threadId: string) {
  return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
}

function extractUniqueMatches(text: string, pattern: RegExp, formatter?: (value: string) => string) {
  const matches = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const raw = (match[1] ?? match[0] ?? "").trim();
    if (!raw) {
      continue;
    }

    matches.add(formatter ? formatter(raw) : raw);
  }

  return Array.from(matches);
}

function extractSentenceMatches(text: string, pattern: RegExp) {
  const normalized = text.replace(/\r/g, " ");
  const sentences = normalized
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return Array.from(
    new Set(sentences.filter((sentence) => pattern.test(sentence)).map((sentence) => sentence.slice(0, 220))),
  );
}

function extractEmailSignals(email: EmailRecord): EmailSignals {
  const text = `${email.subject}\n${email.snippet}\n${email.body}`.replace(/\s+/g, " ").trim();

  const dateFragments = extractUniqueMatches(
    text,
    /\b((?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
  );
  const monthDayFragments = extractUniqueMatches(
    text,
    /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?(?:\s+(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
  );
  const numericDateFragments = extractUniqueMatches(
    text,
    /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
  );

  const deadlines = extractSentenceMatches(
    text,
    /\b(deadline|due|submit|submission|expires|expiration|last date|complete by|pay by)\b/i,
  );

  const birthdays = extractSentenceMatches(
    text,
    /\b(birthday|born on|turns?\s+\d+|anniversary)\b/i,
  ).concat(
    extractSentenceMatches(
      text,
      /\b(happy birthday)\b/i,
    ),
  );

  const meetings = extractSentenceMatches(
    text,
    /\b(meeting|meet|call|zoom|teams|interview|appointment|session|invite)\b/i,
  );

  const addresses = extractUniqueMatches(
    text,
    /\b(\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct|way|parkway|pkwy))\b/gi,
    (value) => value.replace(/\s+/g, " "),
  );

  const reminders = extractSentenceMatches(
    text,
    /\b(reminder|remind|don't forget|do not forget|follow up|remember to|need to)\b/i,
  );

  const enrichedDeadlines = Array.from(
    new Set(
      deadlines.concat(
        dateFragments.map((fragment) => `Date mention: ${fragment}`),
        monthDayFragments.map((fragment) => `Date mention: ${fragment}`),
        numericDateFragments.map((fragment) => `Date mention: ${fragment}`),
      ),
    ),
  );

  return {
    deadlines: enrichedDeadlines.slice(0, 6),
    birthdays: birthdays.slice(0, 6),
    meetings: meetings.slice(0, 6),
    addresses: addresses.slice(0, 6),
    reminders: reminders.slice(0, 6),
  };
}

function parseBirthdayMonthDay(text: string) {
  const normalized = text.trim();
  const monthMatch = normalized.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i,
  );
  if (monthMatch) {
    const monthNames = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];
    const month = monthNames.indexOf(monthMatch[1].toLowerCase()) + 1;
    const day = Number(monthMatch[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        month,
        day,
        birthdayLabel: formatBirthdayLabel(month, day),
      };
    }
  }

  const numericMatch = normalized.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (numericMatch) {
    const month = Number(numericMatch[1]);
    const day = Number(numericMatch[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        month,
        day,
        birthdayLabel: formatBirthdayLabel(month, day),
      };
    }
  }

  return null;
}

type BirthdayCandidate = {
  name: string;
  birthdayLabel: string;
  month: number;
  day: number;
};

function extractBirthdayCandidatesFromText(text: string) {
  const normalized = text.replace(/\r/g, " ");
  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})['’]s birthday is ((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2})/gi,
    /birthday for ([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}) is ((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2})/gi,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}) turns?\s+\d+\s+on ((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2})/gi,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})['’]s birthday(?: is| falls on)?\s+((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2})/gi,
  ];

  const candidates = new Map<string, BirthdayCandidate>();
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const name = match[1]?.trim();
      const dateText = match[2]?.trim();
      if (!name || !dateText) {
        continue;
      }

      const parsed = parseBirthdayMonthDay(dateText);
      if (!parsed) {
        continue;
      }

      candidates.set(name.toLowerCase(), {
        name,
        birthdayLabel: parsed.birthdayLabel,
        month: parsed.month,
        day: parsed.day,
      });
    }
  }

  return Array.from(candidates.values());
}

function extractBirthdayCandidatesFromEmail(email: EmailRecord) {
  return extractBirthdayCandidatesFromText(`${email.subject}\n${email.snippet}\n${email.body ?? ""}`);
}

function extractTravelDetails(email: EmailRecord): TravelExtraction {
  const text = `${email.subject}\n${email.snippet}\n${email.body ?? ""}`.replace(/\s+/g, " ").trim();

  const transport = extractSentenceMatches(
    text,
    /\b(flight|airline|departure|arrival|boarding|gate|terminal|train|rail|platform|bus|ferry)\b/i,
  );

  const stays = extractSentenceMatches(
    text,
    /\b(hotel|check-in|check in|check-out|check out|reservation|stay|room|lodging|hostel)\b/i,
  );

  const bookings = extractSentenceMatches(
    text,
    /\b(booking|booked|itinerary|reservation|trip|confirmation|check-in|boarding pass)\b/i,
  );

  const addresses = extractUniqueMatches(
    text,
    /\b(\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,6}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct|way|parkway|pkwy))\b/gi,
    (value) => value.replace(/\s+/g, " "),
  );

  const dates = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b((?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
      ).concat(
        extractUniqueMatches(
          text,
          /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?(?:\s+(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
        ),
        extractUniqueMatches(
          text,
          /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
        ),
      ),
    ),
  );

  const confirmationCodes = extractUniqueMatches(
    text,
    /\b(?:confirmation|booking|reservation|reference|pnr)(?:\s*(?:code|number|#))?[:\s-]*([A-Z0-9]{5,10})\b/gi,
    (value) => value.toUpperCase(),
  );

  return {
    transport: transport.slice(0, 6),
    stays: stays.slice(0, 6),
    bookings: bookings.slice(0, 6),
    addresses: addresses.slice(0, 6),
    dates: dates.slice(0, 8),
    confirmationCodes: confirmationCodes.slice(0, 6),
  };
}

function formatTravelExtraction(email: EmailRecord, details: TravelExtraction) {
  const sections: Array<[string, string[]]> = [
    ["Transport", details.transport],
    ["Stays", details.stays],
    ["Bookings", details.bookings],
    ["Dates", details.dates],
    ["Addresses", details.addresses],
    ["Confirmation codes", details.confirmationCodes],
  ];

  return [
    `Travel extraction: ${email.subject}`,
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    ...sections.flatMap(([label, items]) => [
      label,
      ...(items.length > 0 ? items.map((item) => `- ${item}`) : ["- None detected"]),
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

function formatTravelForNotion(email: EmailRecord, details: TravelExtraction) {
  return [
    `Travel Summary: ${email.subject}`,
    "",
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    "Transport",
    ...(details.transport.length > 0 ? details.transport.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Stays",
    ...(details.stays.length > 0 ? details.stays.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Bookings",
    ...(details.bookings.length > 0 ? details.bookings.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Dates",
    ...(details.dates.length > 0 ? details.dates.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Addresses",
    ...(details.addresses.length > 0 ? details.addresses.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Confirmation codes",
    ...(details.confirmationCodes.length > 0
      ? details.confirmationCodes.map((item) => `- ${item}`)
      : ["- None detected"]),
    "",
    "Email preview",
    email.body ? email.body.slice(0, 2500) : email.snippet || "No email preview available.",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractExpenseDetails(email: EmailRecord): ExpenseExtraction {
  const text = `${email.subject}\n${email.snippet}\n${email.body ?? ""}`.replace(/\s+/g, " ").trim();

  const merchants = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b(?:from|at|merchant|seller|store)[:\s-]*([A-Z][A-Za-z0-9&.' -]{2,40})\b/g,
      ).concat(
        extractUniqueMatches(
          text,
          /\b(?:receipt|invoice|order confirmation|payment confirmation) (?:from|for) ([A-Z][A-Za-z0-9&.' -]{2,40})\b/gi,
        ),
      ),
    ),
  ).slice(0, 6);

  const amounts = extractUniqueMatches(
    text,
    /\b((?:USD|usd|\$)\s?\d+(?:,\d{3})*(?:\.\d{2})?)\b/g,
    (value) => value.replace(/\s+/g, ""),
  ).slice(0, 6);

  const categories = extractSentenceMatches(
    text,
    /\b(receipt|invoice|order|payment|charged|purchase|subscription|bill|tax|total)\b/i,
  ).slice(0, 6);

  const dates = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b((?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
      ).concat(
        extractUniqueMatches(
          text,
          /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?)\b/gi,
        ),
        extractUniqueMatches(
          text,
          /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/gi,
        ),
      ),
    ),
  ).slice(0, 8);

  const orderNumbers = extractUniqueMatches(
    text,
    /\b(?:order|invoice|receipt|transaction|payment)(?:\s*(?:number|no|#|id))?[:\s-]*([A-Z0-9-]{5,20})\b/gi,
    (value) => value.toUpperCase(),
  ).slice(0, 6);

  const notes = extractSentenceMatches(
    text,
    /\b(receipt|invoice|order|paid|charged|total|subtotal|tax|delivery fee|subscription|renewal)\b/i,
  ).slice(0, 6);

  return {
    merchants,
    amounts,
    categories,
    dates,
    orderNumbers,
    notes,
  };
}

function formatExpenseExtraction(email: EmailRecord, details: ExpenseExtraction) {
  const sections: Array<[string, string[]]> = [
    ["Merchants", details.merchants],
    ["Amounts", details.amounts],
    ["Dates", details.dates],
    ["Order numbers", details.orderNumbers],
    ["Receipt notes", details.notes],
    ["Category cues", details.categories],
  ];

  return [
    `Expense extraction: ${email.subject}`,
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    ...sections.flatMap(([label, items]) => [
      label,
      ...(items.length > 0 ? items.map((item) => `- ${item}`) : ["- None detected"]),
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

function formatExpenseForNotion(email: EmailRecord, details: ExpenseExtraction) {
  return [
    `Expense Summary: ${email.subject}`,
    "",
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    "Merchants",
    ...(details.merchants.length > 0 ? details.merchants.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Amounts",
    ...(details.amounts.length > 0 ? details.amounts.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Dates",
    ...(details.dates.length > 0 ? details.dates.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Order numbers",
    ...(details.orderNumbers.length > 0 ? details.orderNumbers.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Receipt notes",
    ...(details.notes.length > 0 ? details.notes.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Email preview",
    email.body ? email.body.slice(0, 2500) : email.snippet || "No email preview available.",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractPackageDetails(email: EmailRecord): PackageExtraction {
  const text = `${email.subject}\n${email.snippet}\n${email.body ?? ""}`.replace(/\s+/g, " ").trim();

  const carriers = Array.from(
    new Set(
      [
        ...extractUniqueMatches(text, /\b(UPS|FedEx|USPS|DHL|Amazon Logistics|Amazon)\b/gi, (value) =>
          value
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\bUsps\b/i, "USPS")
            .replace(/\bUps\b/i, "UPS"),
        ),
      ],
    ),
  ).slice(0, 5);

  const statuses = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b(out for delivery|delivered|arriving today|arriving tomorrow|arriving|shipped|shipment delayed|in transit|ready for pickup|picked up)\b/gi,
        (value) => value.toLowerCase(),
      ).map((value) => value.charAt(0).toUpperCase() + value.slice(1)),
    ),
  ).slice(0, 8);

  const deliveryDates = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b((?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+by\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
      ).concat(
        extractUniqueMatches(
          text,
          /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?(?:\s+by\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
        ),
        extractUniqueMatches(
          text,
          /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+by\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
        ),
      ),
    ),
  ).slice(0, 8);

  const trackingNumbers = extractUniqueMatches(
    text,
    /\b(?:tracking|track|shipment|package)(?:\s*(?:number|no|#|id|code))?[:\s-]*([A-Z0-9-]{8,24})\b/gi,
    (value) => value.toUpperCase(),
  ).slice(0, 6);

  const addresses = extractUniqueMatches(
    text,
    /\b(\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,6}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct|way|parkway|pkwy))\b/gi,
    (value) => value.replace(/\s+/g, " "),
  ).slice(0, 6);

  const notes = extractSentenceMatches(
    text,
    /\b(package|shipment|delivery|arriving|tracking|delivered|carrier|pickup|drop[- ]off)\b/i,
  ).slice(0, 6);

  return {
    carriers,
    statuses,
    deliveryDates,
    trackingNumbers,
    addresses,
    notes,
  };
}

function formatPackageExtraction(email: EmailRecord, details: PackageExtraction) {
  const sections: Array<[string, string[]]> = [
    ["Carriers", details.carriers],
    ["Statuses", details.statuses],
    ["Delivery dates", details.deliveryDates],
    ["Tracking numbers", details.trackingNumbers],
    ["Addresses", details.addresses],
    ["Package notes", details.notes],
  ];

  return [
    `Package extraction: ${email.subject}`,
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    ...sections.flatMap(([label, items]) => [
      label,
      ...(items.length > 0 ? items.map((item) => `- ${item}`) : ["- None detected"]),
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

function formatPackageForNotion(email: EmailRecord, details: PackageExtraction) {
  return [
    `Package Summary: ${email.subject}`,
    "",
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    "Carriers",
    ...(details.carriers.length > 0 ? details.carriers.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Statuses",
    ...(details.statuses.length > 0 ? details.statuses.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Delivery dates",
    ...(details.deliveryDates.length > 0
      ? details.deliveryDates.map((item) => `- ${item}`)
      : ["- None detected"]),
    "",
    "Tracking numbers",
    ...(details.trackingNumbers.length > 0
      ? details.trackingNumbers.map((item) => `- ${item}`)
      : ["- None detected"]),
    "",
    "Addresses",
    ...(details.addresses.length > 0 ? details.addresses.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Package notes",
    ...(details.notes.length > 0 ? details.notes.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Email preview",
    email.body ? email.body.slice(0, 2500) : email.snippet || "No email preview available.",
  ]
    .filter(Boolean)
    .join("\n");
}

function tokenizePrepQuery(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function scoreMeetingPrepEvent(event: GoogleCalendarEventRecord, query: string | null) {
  if (!query) {
    return 1;
  }

  const haystack = `${event.summary} ${event.start ?? ""}`.toLowerCase();
  return tokenizePrepQuery(query).reduce(
    (score, token) => (haystack.includes(token) ? score + 1 : score),
    0,
  );
}

function findMeetingPrepEvent(events: GoogleCalendarEventRecord[], query: string | null) {
  if (events.length === 0) {
    return null;
  }

  if (!query) {
    return events[0];
  }

  const scored = events
    .map((event) => ({ event, score: scoreMeetingPrepEvent(event, query) }))
    .sort((left, right) => right.score - left.score);

  return scored[0]?.score > 0 ? scored[0].event : null;
}

function findRelatedMeetingEmails(event: GoogleCalendarEventRecord, emails: EmailRecord[]) {
  const tokens = tokenizePrepQuery(event.summary);
  return emails.filter((email) => {
    const haystack = `${email.subject} ${email.snippet} ${email.body}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  }).slice(0, 3);
}

function findRelatedMeetingNotes(event: GoogleCalendarEventRecord, notes: NoteRecord[]) {
  const tokens = tokenizePrepQuery(event.summary);
  return notes.filter((note) => {
    const haystack = `${note.title} ${note.summary}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  }).slice(0, 3);
}

function findRelatedMeetingTasks(event: GoogleCalendarEventRecord, tasks: PlannerTaskRecord[]) {
  const tokens = tokenizePrepQuery(event.summary);
  return tasks.filter((task) => {
    const haystack = `${task.title} ${task.dueLabel ?? ""} ${task.sourceNote.summary}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  }).slice(0, 4);
}

function buildMeetingPrepContent(
  event: GoogleCalendarEventRecord,
  emails: EmailRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
) {
  return [
    `Meeting Prep: ${event.summary}`,
    "",
    `Time: ${formatCalendarEventTimeLabel(event.start)}${
      event.end ? ` to ${formatCalendarEventTimeLabel(event.end)}` : ""
    }`,
    event.htmlLink ? `Calendar link: ${event.htmlLink}` : "",
    "",
    "Related email",
    ...(emails.length > 0
      ? emails.map((email) => `- ${email.subject} - ${email.from}`)
      : ["- No related loaded emails found."]),
    "",
    "Related notes",
    ...(notes.length > 0
      ? notes.map((note) => `- ${note.title}`)
      : ["- No related notes found."]),
    "",
    "Related tasks",
    ...(tasks.length > 0
      ? tasks.map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No related tasks found."]),
    "",
    "Prep focus",
    emails.length > 0 || notes.length > 0 || tasks.length > 0
      ? "- Review the related items above before the meeting."
      : "- No linked context was found yet, so review the calendar event details directly.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSchoolFocusSummary(
  urgentEmails: Array<{ email: EmailRecord; signals: EmailSignals; score: number }>,
  studyTasks: PlannerTaskRecord[],
  loadedPdfs: FileRecord[],
) {
  const focusPoints: string[] = [];

  if (studyTasks.filter((task) => task.status === "overdue").length > 0) {
    focusPoints.push(
      `clear ${studyTasks.filter((task) => task.status === "overdue").length} overdue school task${
        studyTasks.filter((task) => task.status === "overdue").length === 1 ? "" : "s"
      }`,
    );
  }

  if (studyTasks.filter((task) => task.status === "today").length > 0) {
    focusPoints.push(
      `finish ${studyTasks.filter((task) => task.status === "today").length} school task${
        studyTasks.filter((task) => task.status === "today").length === 1 ? "" : "s"
      } due today`,
    );
  }

  if (urgentEmails.length > 0) {
    focusPoints.push(
      `review ${urgentEmails.length} study-related email${urgentEmails.length === 1 ? "" : "s"}`,
    );
  }

  if (loadedPdfs.length > 0) {
    focusPoints.push(`use ${loadedPdfs.length} loaded PDF${loadedPdfs.length === 1 ? "" : "s"} as study material`);
  }

  if (focusPoints.length === 0) {
    return "School mode focus: keep momentum steady and load a PDF or school task to plan around.";
  }

  return `School mode focus: ${focusPoints.join(", ")}.`;
}

function buildSchoolPlanContent(
  emails: EmailRecord[],
  tasks: PlannerTaskRecord[],
  files: FileRecord[],
) {
  const loadedPdfs = getLoadedPdfFiles(files);
  const urgentStudyEmails = emails
    .map(scoreEmailUrgency)
    .filter(({ email, signals, score }) => {
      const text = `${email.subject} ${email.snippet} ${email.body}`.toLowerCase();
      return (
        /\b(class|course|assignment|exam|quiz|study|homework|syllabus|lecture|project)\b/i.test(text) ||
        signals.deadlines.length > 0 ||
        score > 0
      );
    })
    .slice(0, 5);
  const studyTasks = tasks.filter((task) =>
    /\b(class|course|assignment|exam|quiz|study|homework|syllabus|lecture|project|school)\b/i.test(
      `${task.title} ${task.sourceNote.summary}`,
    ) || task.status === "today" || task.status === "overdue",
  );
  const focusSummary = buildSchoolFocusSummary(urgentStudyEmails, studyTasks, loadedPdfs);

  return [
    `School Mode Plan: ${new Date().toLocaleString()}`,
    "",
    focusSummary,
    "",
    "Loaded study PDFs",
    ...(loadedPdfs.length > 0
      ? loadedPdfs.slice(0, 8).map((file) => `- ${file.name}`)
      : ["- No PDFs are loaded yet."]),
    "",
    "School-related tasks",
    ...(studyTasks.length > 0
      ? studyTasks.slice(0, 8).map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No school-related tasks are loaded yet."]),
    "",
    "School-related email",
    ...(urgentStudyEmails.length > 0
      ? urgentStudyEmails.map(({ email, signals }) => {
          const cues = [
            signals.deadlines.length > 0 ? `${signals.deadlines.length} deadline cue${signals.deadlines.length === 1 ? "" : "s"}` : "",
            signals.reminders.length > 0 ? `${signals.reminders.length} reminder cue${signals.reminders.length === 1 ? "" : "s"}` : "",
          ]
            .filter(Boolean)
            .join(", ");
          return `- ${email.subject} - ${email.from}${cues ? ` (${cues})` : ""}`;
        })
      : ["- No school-related loaded emails right now."]),
    "",
    "Suggested next moves",
    studyTasks.filter((task) => task.status === "overdue").length > 0
      ? `- Clear overdue work first: ${studyTasks
          .filter((task) => task.status === "overdue")
          .slice(0, 3)
          .map((task) => task.title)
          .join(", ")}`
      : "- No overdue school tasks detected.",
    loadedPdfs.length > 0
      ? `- Review ${loadedPdfs[0].name} next and make tasks from it if needed.`
      : "- Load a class PDF so JARVIS can summarize it or create tasks from it.",
    urgentStudyEmails.length > 0
      ? `- Check ${urgentStudyEmails[0].email.subject} for new deadlines or changes.`
      : "- Check recent school email for deadline updates if needed.",
  ].join("\n");
}

function getNextBirthdayDate(person: PersonMemoryRecord, now = new Date()) {
  const year = now.getFullYear();
  const thisYear = new Date(year, person.month - 1, person.day);
  if (thisYear >= new Date(year, now.getMonth(), now.getDate())) {
    return thisYear;
  }

  return new Date(year + 1, person.month - 1, person.day);
}

function formatUpcomingBirthday(person: PersonMemoryRecord, now = new Date()) {
  const nextBirthday = getNextBirthdayDate(person, now);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (nextBirthday.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );
  const suffix =
    diffDays === 0 ? "today" : diffDays === 1 ? "tomorrow" : `in ${diffDays} days`;
  return `${person.name} - ${person.birthdayLabel} (${suffix})`;
}

function formatEmailSignals(email: EmailRecord, signals: EmailSignals) {
  const sections: Array<[string, string[]]> = [
    ["Deadlines", signals.deadlines],
    ["Birthdays", signals.birthdays],
    ["Meetings", signals.meetings],
    ["Addresses", signals.addresses],
    ["Reminders", signals.reminders],
  ];

  return [
    `Email extraction: ${email.subject}`,
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    ...sections.flatMap(([label, items]) => [
      label,
      ...(items.length > 0 ? items.map((item) => `- ${item}`) : ["- None detected"]),
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

function cleanPdfText(text: string) {
  return text
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function summarizePdfText(fileName: string, text: string) {
  const cleaned = cleanPdfText(text);
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
  const selected = sentences.slice(0, 5);

  return [
    `PDF Summary: ${fileName}`,
    "",
    ...(selected.length > 0
      ? selected.map((sentence, index) => `${index + 1}. ${sentence}`)
      : ["No readable summary content was extracted."]),
  ].join("\n");
}

function extractTasksFromPdfText(text: string): PdfTaskCandidate[] {
  const cleaned = cleanPdfText(text);
  const chunks = cleaned
    .split(/\n+|(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const taskCandidates = chunks.filter((sentence) =>
    /\b(submit|review|read|finish|complete|prepare|email|call|schedule|bring|study|revise|practice|write|update|upload)\b/i.test(sentence),
  );

  return Array.from(
    new Map(
      taskCandidates
        .slice(0, 6)
        .map((sentence) => sentence.replace(/^[\-\u2022\d.)\s]+/, "").replace(/\s+/g, " ").trim())
        .filter((sentence) => sentence.length > 8)
        .map((sentence) => {
          const dueLabel = extractDueLabel(sentence);
          const title = dueLabel
            ? sentence.replace(new RegExp(escapeRegExp(dueLabel), "i"), "").replace(/\s+/g, " ").trim()
            : sentence;

          const normalizedTitle = title.replace(/\bby\b$/i, "").trim();
          return [
            normalizedTitle.toLowerCase(),
            {
              title: normalizedTitle,
              dueLabel,
            } satisfies PdfTaskCandidate,
          ] as const;
        }),
    ).values(),
  ).filter((candidate) => candidate.title.length > 0);
}

function formatPdfTextPreview(fileName: string, text: string) {
  const cleaned = cleanPdfText(text);
  return [
    `PDF Text: ${fileName}`,
    "",
    cleaned.slice(0, 4000) || "No readable PDF text was extracted.",
  ].join("\n");
}

function getEmailByIndex(emails: EmailRecord[], index: number) {
  if (!Number.isFinite(index) || index < 1) {
    return null;
  }

  return emails[index - 1] ?? null;
}

function getCurrentEmail(emails: EmailRecord[]) {
  return emails[0] ?? null;
}

function createActiveEmailContext(email: EmailRecord): ActiveConversationContext {
  return {
    kind: "email",
    emailId: email.id,
    threadId: email.threadId,
    label: email.subject,
  };
}

function getNoteByIndex(notes: NoteRecord[], index: number) {
  if (!Number.isFinite(index) || index < 1) {
    return null;
  }

  return notes[index - 1] ?? null;
}

function createActiveNoteContext(note: NoteRecord): ActiveConversationContext {
  return {
    kind: "note",
    noteId: note.id,
    label: note.title,
    url: note.url,
  };
}

function resolveActiveNote(
  context: ActiveConversationContext | null,
  notes: NoteRecord[],
) {
  if (!context || context.kind !== "note") {
    return null;
  }

  return notes.find((note) => note.id === context.noteId) ?? null;
}

function createActiveTaskContext(task: PlannerTaskRecord): ActiveConversationContext {
  return {
    kind: "task",
    noteId: task.id,
    label: task.title,
    dueLabel: task.dueLabel,
  };
}

function resolveActiveTask(
  context: ActiveConversationContext | null,
  tasks: PlannerTaskRecord[],
) {
  if (!context || context.kind !== "task") {
    return null;
  }

  return tasks.find((task) => task.id === context.noteId) ?? null;
}

function createActiveBrowserContext(url: string): ActiveConversationContext {
  return {
    kind: "browser",
    url,
    label: formatBrowserTargetLabel(url),
  };
}

function resolveActiveBrowserContext(context: ActiveConversationContext | null) {
  return context?.kind === "browser" ? context : null;
}

function resolveActiveEmail(
  context: ActiveConversationContext | null,
  emails: EmailRecord[],
) {
  if (!context || context.kind !== "email") {
    return null;
  }

  return emails.find((email) => email.id === context.emailId) ?? null;
}

function resolveActivePdf(
  context: ActiveConversationContext | null,
  files: FileRecord[],
) {
  if (!context || context.kind !== "pdf") {
    return null;
  }

  return getLoadedPdfFiles(files).find((file) => file.path === context.path) ?? null;
}

function findEmailByQuery(emails: EmailRecord[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return null;
  }

  return (
    emails.find((email) =>
      `${email.subject} ${email.from} ${email.snippet} ${email.body}`.toLowerCase().includes(normalizedQuery),
    ) ?? null
  );
}

function parseDateFromEmailText(text: string) {
  const now = new Date();
  const relativeMatch = text.match(
    /\b(?:on\s+)?(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s+(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );

  if (relativeMatch) {
    const day = resolveDayReference(relativeMatch[1], now);
    const clock = parseClockTime(relativeMatch[2]);
    if (day && clock) {
      return new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        clock.hours,
        clock.minutes,
        0,
        0,
      );
    }
  }

  const explicitMatch = text.match(
    /\b(?:on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,\s*(\d{4}))?(?:\s+(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i,
  );

  if (explicitMatch) {
    const monthNames = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];
    const monthIndex = monthNames.indexOf(explicitMatch[1].toLowerCase());
    const dayNumber = Number(explicitMatch[2]);
    const yearNumber = Number(explicitMatch[3] ?? now.getFullYear().toString());
    const clock = explicitMatch[4] ? parseClockTime(explicitMatch[4]) : { hours: 9, minutes: 0 };

    if (monthIndex >= 0 && clock) {
      return new Date(
        yearNumber,
        monthIndex,
        dayNumber,
        clock.hours,
        clock.minutes,
        0,
        0,
      );
    }
  }

  const numericMatch = text.match(
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i,
  );
  if (numericMatch) {
    const monthNumber = Number(numericMatch[1]) - 1;
    const dayNumber = Number(numericMatch[2]);
    const rawYear = numericMatch[3];
    const yearNumber = rawYear
      ? Number(rawYear.length === 2 ? `20${rawYear}` : rawYear)
      : now.getFullYear();
    const clock = numericMatch[4] ? parseClockTime(numericMatch[4]) : { hours: 9, minutes: 0 };

    if (monthNumber >= 0 && monthNumber <= 11 && clock) {
      return new Date(
        yearNumber,
        monthNumber,
        dayNumber,
        clock.hours,
        clock.minutes,
        0,
        0,
      );
    }
  }

  return null;
}

function parseDateFromFlexibleText(text: string) {
  const direct = new Date(text.trim());
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  return parseDateFromEmailText(text);
}

function parseTaskNoteRecord(note: NoteRecord): PlannerTaskRecord | null {
  const combined = `${note.title}\n${note.summary}`.trim();
  if (!combined.toLowerCase().includes("task:")) {
    return null;
  }

  const titleMatch =
    combined.match(/task:\s*(.+?)(?:\s*\|\s*due:|$)/i) ??
    combined.match(/task:\s*(.+)/i);
  const dueMatch = combined.match(/due:\s*(.+?)(?:\n|$)/i);
  const statusMatch = combined.match(/status:\s*(.+?)(?:\n|$)/i);
  const dueLabel = dueMatch?.[1]?.trim() ?? null;
  const dueDate = dueLabel ? parseDateFromFlexibleText(dueLabel) : null;
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addMinutes(todayStart, 24 * 60);

  let status: PlannerTaskRecord["status"] = "unscheduled";
  if (statusMatch?.[1]?.trim().toLowerCase() === "done") {
    status = "done";
  } else if (dueDate) {
    const dueDayStart = startOfDay(dueDate);
    if (dueDayStart.getTime() < todayStart.getTime()) {
      status = "overdue";
    } else if (dueDayStart.getTime() === todayStart.getTime()) {
      status = "today";
    } else if (dueDayStart.getTime() >= tomorrowStart.getTime()) {
      status = "upcoming";
    }
  }

  return {
    id: note.id,
    title: titleMatch?.[1]?.trim() || note.title,
    dueLabel,
    dueDate,
    status,
    sourceNote: note,
  };
}

function buildCalendarIntentFromEmail(email: EmailRecord) {
  const combined = `${email.subject} ${email.snippet} ${email.body}`.trim();
  const start = parseDateFromEmailText(combined);
  if (!start) {
    return null;
  }

  const rangeMatch = combined.match(
    /\bfrom\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  let end = addMinutes(start, 60);
  if (rangeMatch) {
    const endClock = parseClockTime(rangeMatch[2]);
    if (endClock) {
      end = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        endClock.hours,
        endClock.minutes,
        0,
        0,
      );
      if (end <= start) {
        end = addMinutes(start, 60);
      }
    }
  }

  const cleanedTitle = email.subject
    .replace(/\b(invite|invitation|event|meeting)\b[:\-\s]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    kind: "create_calendar_event" as const,
    title: cleanedTitle || email.subject || "Email event",
    start,
    end,
  };
}

function formatEmailDigestForNotion(emails: EmailRecord[]) {
  return [
    `Email Digest: ${new Date().toLocaleString()}`,
    "",
    ...emails.flatMap((email, index) => [
      `${index + 1}. ${email.subject}`,
      `From: ${email.from}`,
      email.date ? `Date: ${email.date}` : "",
      email.snippet || "No preview available.",
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

function getDueIsoFromLabel(dueLabel: string | null) {
  if (!dueLabel) {
    return null;
  }

  const parsed = parseDateFromFlexibleText(dueLabel);
  if (!parsed) {
    return null;
  }

  return parsed.toISOString();
}

function getPlannerTaskByIndex(tasks: PlannerTaskRecord[], index: number) {
  if (!Number.isFinite(index) || index < 1) {
    return null;
  }

  return tasks[index - 1] ?? null;
}

function findPlannerTaskByQuery(tasks: PlannerTaskRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    tasks.find((task) =>
      `${task.title} ${task.dueLabel ?? ""} ${task.sourceNote.summary}`.toLowerCase().includes(normalized),
    ) ?? null
  );
}

function formatPlannerTaskList(tasks: PlannerTaskRecord[], emptyMessage: string) {
  return tasks.length > 0
    ? tasks
        .map((task) => `${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
        .join(" | ")
    : emptyMessage;
}

function buildClarificationReply(prompt: string) {
  return prompt;
}

function buildMissingSkillReply() {
  return "I get what you're asking, but I do not have that skill wired yet. Right now I can handle study setup, website opening, Google searches, Notion notes, calendar actions, reminder drafts, local file search, Spotify playback control, and Gmail inbox reads.";
}

function formatCalendarEventTimeLabel(value: string | null) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getEventBucketLabel(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const hour = date.getHours();
  if (hour < 12) {
    return "Morning";
  }

  if (hour < 17) {
    return "Afternoon";
  }

  return "Evening";
}

function scoreEmailUrgency(email: EmailRecord) {
  const signals = extractEmailSignals(email);
  const lowered = `${email.subject} ${email.snippet} ${email.body}`.toLowerCase();
  let score = 0;

  score += signals.deadlines.length * 3;
  score += signals.meetings.length * 2;
  score += signals.reminders.length * 2;
  score += signals.birthdays.length;

  if (/\b(urgent|asap|important|action required|deadline|overdue|final reminder)\b/i.test(lowered)) {
    score += 4;
  }

  return { email, signals, score };
}

function buildFocusSummary(
  urgentEmails: Array<{ email: EmailRecord; signals: EmailSignals; score: number }>,
  overdueTasks: PlannerTaskRecord[],
  todayTasks: PlannerTaskRecord[],
  events: GoogleCalendarEventRecord[],
) {
  const focusPoints: string[] = [];

  if (overdueTasks.length > 0) {
    focusPoints.push(
      `clear ${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"} first`,
    );
  }

  if (urgentEmails.length > 0) {
    focusPoints.push(
      `review ${urgentEmails.length} urgent email${urgentEmails.length === 1 ? "" : "s"}`,
    );
  }

  if (events.length > 0) {
    focusPoints.push(
      `prepare for ${events.length} calendar event${events.length === 1 ? "" : "s"} today`,
    );
  }

  if (todayTasks.length > 0) {
    focusPoints.push(
      `finish ${todayTasks.length} task${todayTasks.length === 1 ? "" : "s"} due today`,
    );
  }

  if (focusPoints.length === 0) {
    return "Focus today: keep momentum steady. There are no urgent blockers showing right now.";
  }

  return `Focus today: ${focusPoints.join(", ")}.`;
}

function buildDailyBriefContent(
  emails: EmailRecord[],
  tasks: PlannerTaskRecord[],
  events: GoogleCalendarEventRecord[],
) {
  const todayTasks = tasks.filter((task) => task.status === "today");
  const upcomingTasks = tasks.filter((task) => task.status === "upcoming").slice(0, 5);

  return [
    `Daily Brief: ${new Date().toLocaleString()}`,
    "",
    "Calendar",
    ...(events.length > 0
      ? events.map(
          (event) =>
            `- ${event.summary} (${formatCalendarEventTimeLabel(event.start)}${
              event.end ? ` to ${formatCalendarEventTimeLabel(event.end)}` : ""
            })`,
        )
      : ["- No events scheduled today."]),
    "",
    "Unread / loaded email",
    ...(emails.length > 0
      ? emails.slice(0, 5).map((email) => `- ${email.subject} — ${email.from}`)
      : ["- No unread or loaded emails right now."]),
    "",
    "Today's tasks",
    ...(todayTasks.length > 0
      ? todayTasks.map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No tasks due today."]),
    "",
    "Upcoming tasks",
    ...(upcomingTasks.length > 0
      ? upcomingTasks.map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No upcoming tasks loaded."]),
  ].join("\n");
}

function buildDailyBriefContentV2(
  emails: EmailRecord[],
  tasks: PlannerTaskRecord[],
  events: GoogleCalendarEventRecord[],
) {
  const overdueTasks = tasks.filter((task) => task.status === "overdue");
  const todayTasks = tasks.filter((task) => task.status === "today");
  const upcomingTasks = tasks.filter((task) => task.status === "upcoming").slice(0, 5);
  const prioritizedEmails = emails
    .map(scoreEmailUrgency)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  const urgentEmails = prioritizedEmails.filter((entry) => entry.score > 0);
  const groupedEvents = {
    Morning: events.filter((event) => getEventBucketLabel(event.start) === "Morning"),
    Afternoon: events.filter((event) => getEventBucketLabel(event.start) === "Afternoon"),
    Evening: events.filter((event) => getEventBucketLabel(event.start) === "Evening"),
  };
  const focusSummary = buildFocusSummary(urgentEmails, overdueTasks, todayTasks, events);

  return [
    `Daily Brief: ${new Date().toLocaleString()}`,
    "",
    focusSummary,
    "",
    "Urgent email",
    ...(prioritizedEmails.length > 0
      ? prioritizedEmails.map(({ email, signals, score }) => {
          const reasons = [
            signals.deadlines.length > 0
              ? `${signals.deadlines.length} deadline signal${signals.deadlines.length === 1 ? "" : "s"}`
              : "",
            signals.meetings.length > 0
              ? `${signals.meetings.length} meeting signal${signals.meetings.length === 1 ? "" : "s"}`
              : "",
            signals.reminders.length > 0
              ? `${signals.reminders.length} reminder signal${signals.reminders.length === 1 ? "" : "s"}`
              : "",
          ]
            .filter(Boolean)
            .join(", ");

          return `- ${email.subject} — ${email.from}${reasons ? ` (${reasons})` : score > 0 ? " (priority)" : ""}`;
        })
      : ["- No unread or loaded emails right now."]),
    "",
    "Calendar",
    ...(events.length > 0
      ? (["Morning", "Afternoon", "Evening"] as const).flatMap((bucket) => [
          bucket,
          ...(groupedEvents[bucket].length > 0
            ? groupedEvents[bucket].map(
                (event) =>
                  `- ${event.summary} (${formatCalendarEventTimeLabel(event.start)}${
                    event.end ? ` to ${formatCalendarEventTimeLabel(event.end)}` : ""
                  })`,
              )
            : ["- Nothing scheduled."]),
          "",
        ])
      : ["- No events scheduled today."]),
    "Overdue tasks",
    ...(overdueTasks.length > 0
      ? overdueTasks.map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No overdue tasks."]),
    "",
    "Tasks due today",
    ...(todayTasks.length > 0
      ? todayTasks.map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No tasks due today."]),
    "",
    "Upcoming tasks",
    ...(upcomingTasks.length > 0
      ? upcomingTasks.map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No upcoming tasks loaded."]),
  ].join("\n");
}

function buildFailureReply() {
  return "I tried that, but I could not complete the action through the desktop bridge.";
}

function mapOllamaInterpretationToResult(
  interpretation: ConversationInterpretation,
): ModelInterpretationResult {
  if (interpretation.kind === "study_setup") {
    return { kind: "intent", intent: { kind: "study_setup" } };
  }

  if (interpretation.kind === "google_search") {
    return {
      kind: "intent",
      intent: { kind: "google_search", query: interpretation.query ?? "" },
    };
  }

  if (interpretation.kind === "open_url" && interpretation.url) {
    return {
      kind: "intent",
      intent: { kind: "open_url", url: interpretation.url },
    };
  }

  if (interpretation.kind === "needs_clarification") {
    return {
      kind: "clarification",
      prompt:
        interpretation.clarificationPrompt ??
        "I need a little clarification before I do that.",
    };
  }

  return { kind: "unsupported" };
}

function resolveBrowserAliasTarget(target: string, aliases: BrowserAliasRecord[]) {
  const normalizedTarget = target.trim().toLowerCase();
  const learnedAlias = aliases.find(
    (alias) => alias.phrase.trim().toLowerCase() === normalizedTarget,
  );

  if (learnedAlias) {
    return canonicalizeBrowserUrl(learnedAlias.url);
  }

  return builtInBrowserAliases[normalizedTarget] ?? null;
}

function isKnownBrowserTarget(target: string, aliases: BrowserAliasRecord[]) {
  const normalizedTarget = target.trim().toLowerCase();
  if (!normalizedTarget) {
    return false;
  }

  return (
    Boolean(builtInBrowserAliases[normalizedTarget]) ||
    aliases.some((alias) => alias.phrase.trim().toLowerCase() === normalizedTarget)
  );
}

function hasExplicitSearchLanguage(command: string) {
  return /\b(search|look up|find .* on google)\b/i.test(command);
}

function hasExplicitOpenLanguage(command: string) {
  return /\b(open|launch)\b/i.test(command);
}

function parseExplicitCommandIntent(
  command: string,
  aliases: BrowserAliasRecord[],
): CommandIntent | null {
  const trimmed = command.trim();
  const normalized = trimmed.toLowerCase();

  if (isStudyAppsCommand(trimmed)) {
    return { kind: "study_setup" };
  }

  if (normalized.startsWith("search ")) {
    const query = trimmed.slice(7).trim();
    if (query) {
      return { kind: "google_search", query };
    }
  }

  if (normalized.includes("search this on google")) {
    return { kind: "google_search", query: trimmed.replace(/search this on google/i, "").trim() };
  }

  if (normalized.startsWith("search google for ")) {
    const query = trimmed.slice("search google for ".length).trim();
    if (query) {
      return { kind: "google_search", query };
    }
  }

  if (normalized.startsWith("open ")) {
    const target = trimmed.slice(5).trim();
    if (target) {
      const resolvedAlias = resolveBrowserAliasTarget(target, aliases);
      if (resolvedAlias) {
        return { kind: "open_url", url: resolvedAlias };
      }

      if (target.includes("\\") || target.includes(":\\") || target.includes("/")) {
        return { kind: "open_file", path: target };
      }

      return { kind: "open_url", url: normalizeUrlTarget(target) };
    }
  }

  const reminderIntent = parseReminderCommandIntent(trimmed);
  if (reminderIntent) {
    return reminderIntent;
  }

  const taskIntent = parseTaskCommandIntent(trimmed);
  if (taskIntent) {
    return taskIntent;
  }

  const calendarIntent = parseCalendarCommandIntent(trimmed);
  if (calendarIntent) {
    return calendarIntent;
  }

  if (normalized.startsWith("make a note ")) {
    const content = trimmed.slice("make a note ".length).trim();
    if (content) {
      return { kind: "create_note", content };
    }
  }

  const rememberBirthdayMatch = trimmed.match(
    /^remember(?: that)?\s+(.+?)['’]s birthday is\s+(.+)$/i,
  );
  if (rememberBirthdayMatch) {
    const parsed = parseBirthdayMonthDay(rememberBirthdayMatch[2]);
    if (parsed) {
      return {
        kind: "remember_person_birthday",
        name: rememberBirthdayMatch[1].trim(),
        birthdayLabel: parsed.birthdayLabel,
        month: parsed.month,
        day: parsed.day,
      };
    }
  }

  const saveBirthdayMatch = trimmed.match(
    /^save\s+(.+?)['’]s birthday as\s+(.+)$/i,
  );
  if (saveBirthdayMatch) {
    const parsed = parseBirthdayMonthDay(saveBirthdayMatch[2]);
    if (parsed) {
      return {
        kind: "remember_person_birthday",
        name: saveBirthdayMatch[1].trim(),
        birthdayLabel: parsed.birthdayLabel,
        month: parsed.month,
        day: parsed.day,
      };
    }
  }

  if (
    normalized === "show birthdays" ||
    normalized === "list birthdays" ||
    normalized === "show my birthdays"
  ) {
    return { kind: "list_birthdays" };
  }

  if (
    normalized === "show upcoming birthdays" ||
    normalized === "upcoming birthdays" ||
    normalized === "who has a birthday soon"
  ) {
    return { kind: "list_upcoming_birthdays" };
  }

  const lookupBirthdayMatch = trimmed.match(
    /^(?:when is|did i save)\s+(.+?)['’]s birthday\??$/i,
  );
  if (lookupBirthdayMatch) {
    return { kind: "show_person_birthday", query: lookupBirthdayMatch[1].trim() };
  }

  if (normalized.startsWith("make me a note ")) {
    const content = trimmed.slice("make me a note ".length).trim();
    if (content) {
      return { kind: "create_note", content };
    }
  }

  if (normalized.startsWith("make a note to ")) {
    const content = trimmed.slice("make a note to ".length).trim();
    if (content) {
      return { kind: "create_note", content };
    }
  }

  if (normalized.startsWith("create a note ")) {
    const content = trimmed.slice("create a note ".length).trim();
    if (content) {
      return { kind: "create_note", content };
    }
  }

  if (normalized === "show my notes" || normalized === "list my notes" || normalized === "show notes") {
    return { kind: "list_notes" };
  }

  if (normalized.startsWith("find note about ")) {
    const query = trimmed.slice("find note about ".length).trim();
    if (query) {
      return { kind: "search_notes", query };
    }
  }

  if (normalized.startsWith("search notes for ")) {
    const query = trimmed.slice("search notes for ".length).trim();
    if (query) {
      return { kind: "search_notes", query };
    }
  }

  if (
    normalized === "show recent files" ||
    normalized === "recent files" ||
    normalized === "show my recent files"
  ) {
    return { kind: "list_recent_files" };
  }

  if (
    normalized === "find pdfs" ||
    normalized === "show pdfs" ||
    normalized === "list pdfs"
  ) {
    return { kind: "list_pdfs" };
  }

  if (normalized.startsWith("search pdfs for ")) {
    const query = trimmed.slice("search pdfs for ".length).trim();
    if (query) {
      return { kind: "search_pdfs", query };
    }
  }

  if (normalized.startsWith("find pdf about ")) {
    const query = trimmed.slice("find pdf about ".length).trim();
    if (query) {
      return { kind: "search_pdfs", query };
    }
  }

  const summarizePdfMatch = normalized.match(/^summarize pdf (\d+)$/i);
  if (summarizePdfMatch) {
    return { kind: "summarize_pdf_by_index", index: Number(summarizePdfMatch[1]) };
  }

  const openPdfMatch = normalized.match(/^open pdf (\d+)$/i);
  if (openPdfMatch) {
    return { kind: "open_pdf_by_index", index: Number(openPdfMatch[1]) };
  }

  const readPdfMatch = normalized.match(/^(?:read|show) pdf (\d+)$/i);
  if (readPdfMatch) {
    return { kind: "read_pdf_by_index", index: Number(readPdfMatch[1]) };
  }

  const summarizePdfQueryMatch = normalized.match(/^summarize (?:the )?pdf about (.+)$/i);
  if (summarizePdfQueryMatch) {
    return { kind: "summarize_pdf_by_query", query: summarizePdfQueryMatch[1].trim() };
  }

  const openPdfQueryMatch = normalized.match(/^open (?:the )?pdf about (.+)$/i);
  if (openPdfQueryMatch) {
    return { kind: "open_pdf_by_query", query: openPdfQueryMatch[1].trim() };
  }

  const readPdfQueryMatch = normalized.match(/^(?:read|show) (?:the )?pdf about (.+)$/i);
  if (readPdfQueryMatch) {
    return { kind: "read_pdf_by_query", query: readPdfQueryMatch[1].trim() };
  }

  const savePdfSummaryMatch = normalized.match(/^save pdf (\d+) summary to notion$/i);
  if (savePdfSummaryMatch) {
    return { kind: "save_pdf_summary_to_notion_by_index", index: Number(savePdfSummaryMatch[1]) };
  }

  const savePdfSummaryQueryMatch = normalized.match(/^save (?:the )?pdf about (.+) summary to notion$/i);
  if (savePdfSummaryQueryMatch) {
    return { kind: "save_pdf_summary_to_notion_by_query", query: savePdfSummaryQueryMatch[1].trim() };
  }

  const tasksFromPdfMatch = normalized.match(/^make tasks from pdf (\d+)$/i);
  if (tasksFromPdfMatch) {
    return { kind: "create_tasks_from_pdf_by_index", index: Number(tasksFromPdfMatch[1]) };
  }

  const tasksFromPdfQueryMatch = normalized.match(/^make tasks from (?:the )?pdf about (.+)$/i);
  if (tasksFromPdfQueryMatch) {
    return { kind: "create_tasks_from_pdf_by_query", query: tasksFromPdfQueryMatch[1].trim() };
  }

  if (
    normalized === "play spotify" ||
    normalized === "resume spotify" ||
    normalized === "play music" ||
    normalized === "resume music"
  ) {
    return { kind: "spotify_play" };
  }

  if (
    normalized === "pause spotify" ||
    normalized === "pause music" ||
    normalized === "stop spotify"
  ) {
    return { kind: "spotify_pause" };
  }

  if (
    normalized === "next song" ||
    normalized === "skip song" ||
    normalized === "skip track" ||
    normalized === "spotify next" ||
    normalized === "next track"
  ) {
    return { kind: "spotify_next" };
  }

  if (
    normalized === "previous song" ||
    normalized === "last song" ||
    normalized === "spotify previous" ||
    normalized === "previous track"
  ) {
    return { kind: "spotify_previous" };
  }

  if (
    normalized === "what's playing on spotify" ||
    normalized === "whats playing on spotify" ||
    normalized === "what is playing on spotify" ||
    normalized === "what's playing" ||
    normalized === "whats playing"
  ) {
    return { kind: "spotify_status" };
  }

  if (
    normalized === "show unread emails" ||
    normalized === "show my unread emails" ||
    normalized === "check my email" ||
    normalized === "check my emails" ||
    normalized === "show unread mail"
  ) {
    return { kind: "list_unread_emails" };
  }

  if (
    normalized === "analyze this email" ||
    normalized === "extract details from this email" ||
    normalized === "pull details from this email"
  ) {
    return { kind: "extract_email_signals", index: null };
  }

  if (
    normalized === "extract travel from this email" ||
    normalized === "analyze this email for travel" ||
    normalized === "show travel from this email"
  ) {
    return { kind: "extract_current_email_travel" };
  }

  if (
    normalized === "extract expense from this email" ||
    normalized === "analyze this email for expenses" ||
    normalized === "show expense from this email"
  ) {
    return { kind: "extract_current_email_expense" };
  }

  if (
    normalized === "extract package from this email" ||
    normalized === "analyze this email for package" ||
    normalized === "analyze this email for packages" ||
    normalized === "show package from this email"
  ) {
    return { kind: "extract_current_email_package" };
  }

  if (
    normalized === "show travel memory" ||
    normalized === "list travel memory" ||
    normalized === "show my travel plans"
  ) {
    return { kind: "list_travel_memory" };
  }

  if (
    normalized === "show expense memory" ||
    normalized === "list expense memory" ||
    normalized === "show my expenses"
  ) {
    return { kind: "list_expense_memory" };
  }

  if (
    normalized === "show package memory" ||
    normalized === "list package memory" ||
    normalized === "show my packages"
  ) {
    return { kind: "list_package_memory" };
  }

  if (
    normalized === "show meeting prep memory" ||
    normalized === "list meeting prep memory"
  ) {
    return { kind: "list_meeting_prep_memory" };
  }

  if (
    normalized === "start school mode" ||
    normalized === "school mode" ||
    normalized === "what should i study today"
  ) {
    return { kind: "create_school_plan" };
  }

  if (
    normalized === "save school mode to notion" ||
    normalized === "save study plan to notion"
  ) {
    return { kind: "save_school_plan_to_notion" };
  }

  if (
    normalized === "show school memory" ||
    normalized === "list school memory"
  ) {
    return { kind: "list_school_memory" };
  }

  if (
    normalized === "save birthdays from this email" ||
    normalized === "remember birthdays from this email" ||
    normalized === "add birthdays from this email"
  ) {
    return { kind: "save_birthdays_from_current_email" };
  }

  if (
    normalized === "save birthdays from loaded emails" ||
    normalized === "save birthdays from unread emails"
  ) {
    return { kind: "save_birthdays_from_loaded_emails" };
  }

  if (
    normalized === "create daily brief" ||
    normalized === "make my daily brief" ||
    normalized === "save daily brief to notion" ||
    normalized === "generate daily brief"
  ) {
    return { kind: "create_daily_brief" };
  }

  if (normalized.startsWith("search email for ")) {
    const query = trimmed.slice("search email for ".length).trim();
    if (query) {
      return { kind: "search_emails", query };
    }
  }

  if (normalized.startsWith("search gmail for ")) {
    const query = trimmed.slice("search gmail for ".length).trim();
    if (query) {
      return { kind: "search_emails", query };
    }
  }

  if (
    normalized === "save this email to notion" ||
    normalized === "save latest email to notion" ||
    normalized === "save this email as a note"
  ) {
    return { kind: "save_latest_email_to_notion" };
  }

  if (normalized.startsWith("prepare me for ")) {
    const query = trimmed.slice("prepare me for ".length).trim();
    return { kind: "create_meeting_prep", query: query || null };
  }

  if (normalized.startsWith("make a prep note for ")) {
    const query = trimmed.slice("make a prep note for ".length).trim();
    return { kind: "save_meeting_prep_to_notion", query: query || null };
  }

  if (normalized.startsWith("summarize what i need before ")) {
    const query = trimmed.slice("summarize what i need before ".length).trim();
    return { kind: "create_meeting_prep", query: query || null };
  }

  if (
    normalized === "save unread emails to notion" ||
    normalized === "summarize unread emails into notion" ||
    normalized === "save email digest to notion"
  ) {
    return { kind: "save_email_digest_to_notion" };
  }

  const saveFirstEmailsMatch = normalized.match(/^save first (\d+) emails to notion$/i);
  if (saveFirstEmailsMatch) {
    return { kind: "save_first_emails_to_notion", count: Number(saveFirstEmailsMatch[1]) };
  }

  const saveIndexedEmailMatch = normalized.match(/^save email (\d+) to notion$/i);
  if (saveIndexedEmailMatch) {
    return { kind: "save_email_to_notion_by_index", index: Number(saveIndexedEmailMatch[1]) };
  }

  const saveQueriedEmailMatch = normalized.match(/^save (?:the )?email about (.+) to notion$/i);
  if (saveQueriedEmailMatch) {
    return { kind: "save_email_to_notion_by_query", query: saveQueriedEmailMatch[1].trim() };
  }

  const extractIndexedEmailMatch = normalized.match(/^(?:analyze|extract details from|pull details from) email (\d+)$/i);
  if (extractIndexedEmailMatch) {
    return { kind: "extract_email_signals", index: Number(extractIndexedEmailMatch[1]) };
  }

  const extractTravelIndexedEmailMatch = normalized.match(
    /^(?:extract travel from|analyze) email (\d+)(?: for travel)?$/i,
  );
  if (extractTravelIndexedEmailMatch) {
    return { kind: "extract_email_travel", index: Number(extractTravelIndexedEmailMatch[1]) };
  }

  const extractExpenseIndexedEmailMatch = normalized.match(
    /^(?:extract expense from|analyze) email (\d+)(?: for expenses?)?$/i,
  );
  if (extractExpenseIndexedEmailMatch) {
    return { kind: "extract_email_expense", index: Number(extractExpenseIndexedEmailMatch[1]) };
  }

  const extractPackageIndexedEmailMatch = normalized.match(
    /^(?:extract package from|analyze) email (\d+)(?: for packages?)?$/i,
  );
  if (extractPackageIndexedEmailMatch) {
    return { kind: "extract_email_package", index: Number(extractPackageIndexedEmailMatch[1]) };
  }

  const saveBirthdaysIndexedEmailMatch = normalized.match(
    /^(?:save|remember|add) birthdays from email (\d+)$/i,
  );
  if (saveBirthdaysIndexedEmailMatch) {
    return { kind: "save_birthdays_from_email_index", index: Number(saveBirthdaysIndexedEmailMatch[1]) };
  }

  const extractQueriedEmailMatch = normalized.match(
    /^(?:analyze|extract details from|pull details from) (?:the )?email about (.+)$/i,
  );
  if (extractQueriedEmailMatch) {
    return { kind: "extract_email_signals_by_query", query: extractQueriedEmailMatch[1].trim() };
  }

  const extractTravelQueriedEmailMatch = normalized.match(
    /^(?:extract travel from|analyze) (?:the )?email about (.+?)(?: for travel)?$/i,
  );
  if (extractTravelQueriedEmailMatch) {
    return { kind: "extract_email_travel_by_query", query: extractTravelQueriedEmailMatch[1].trim() };
  }

  const extractExpenseQueriedEmailMatch = normalized.match(
    /^(?:extract expense from|analyze) (?:the )?email about (.+?)(?: for expenses?)?$/i,
  );
  if (extractExpenseQueriedEmailMatch) {
    return { kind: "extract_email_expense_by_query", query: extractExpenseQueriedEmailMatch[1].trim() };
  }

  const extractPackageQueriedEmailMatch = normalized.match(
    /^(?:extract package from|analyze) (?:the )?email about (.+?)(?: for packages?)?$/i,
  );
  if (extractPackageQueriedEmailMatch) {
    return { kind: "extract_email_package_by_query", query: extractPackageQueriedEmailMatch[1].trim() };
  }

  if (
    normalized === "save this travel to notion" ||
    normalized === "save travel from this email to notion"
  ) {
    return { kind: "save_current_email_travel_to_notion" };
  }

  if (
    normalized === "save this expense to notion" ||
    normalized === "save expense from this email to notion"
  ) {
    return { kind: "save_current_email_expense_to_notion" };
  }

  if (
    normalized === "save this package to notion" ||
    normalized === "save package from this email to notion"
  ) {
    return { kind: "save_current_email_package_to_notion" };
  }

  const saveTravelIndexedEmailMatch = normalized.match(
    /^save travel from email (\d+) to notion$/i,
  );
  if (saveTravelIndexedEmailMatch) {
    return { kind: "save_email_travel_to_notion_by_index", index: Number(saveTravelIndexedEmailMatch[1]) };
  }

  const saveExpenseIndexedEmailMatch = normalized.match(
    /^save expense from email (\d+) to notion$/i,
  );
  if (saveExpenseIndexedEmailMatch) {
    return { kind: "save_email_expense_to_notion_by_index", index: Number(saveExpenseIndexedEmailMatch[1]) };
  }

  const savePackageIndexedEmailMatch = normalized.match(
    /^save package from email (\d+) to notion$/i,
  );
  if (savePackageIndexedEmailMatch) {
    return { kind: "save_email_package_to_notion_by_index", index: Number(savePackageIndexedEmailMatch[1]) };
  }

  const saveTravelQueriedEmailMatch = normalized.match(
    /^save travel from (?:the )?email about (.+) to notion$/i,
  );
  if (saveTravelQueriedEmailMatch) {
    return { kind: "save_email_travel_to_notion_by_query", query: saveTravelQueriedEmailMatch[1].trim() };
  }

  const saveExpenseQueriedEmailMatch = normalized.match(
    /^save expense from (?:the )?email about (.+) to notion$/i,
  );
  if (saveExpenseQueriedEmailMatch) {
    return { kind: "save_email_expense_to_notion_by_query", query: saveExpenseQueriedEmailMatch[1].trim() };
  }

  const savePackageQueriedEmailMatch = normalized.match(
    /^save package from (?:the )?email about (.+) to notion$/i,
  );
  if (savePackageQueriedEmailMatch) {
    return { kind: "save_email_package_to_notion_by_query", query: savePackageQueriedEmailMatch[1].trim() };
  }

  const saveBirthdaysQueriedEmailMatch = normalized.match(
    /^(?:save|remember|add) birthdays from (?:the )?email about (.+)$/i,
  );
  if (saveBirthdaysQueriedEmailMatch) {
    return { kind: "save_birthdays_from_email_query", query: saveBirthdaysQueriedEmailMatch[1].trim() };
  }

  const readIndexedEmailMatch = normalized.match(/^(?:read|show) email (\d+)$/i);
  if (readIndexedEmailMatch) {
    return { kind: "read_email_by_index", index: Number(readIndexedEmailMatch[1]) };
  }

  const readQueriedEmailMatch = normalized.match(/^(?:read|show) (?:the )?email about (.+)$/i);
  if (readQueriedEmailMatch) {
    return { kind: "read_email_by_query", query: readQueriedEmailMatch[1].trim() };
  }

  const openIndexedEmailMatch = normalized.match(/^(?:open) email (\d+)$/i);
  if (openIndexedEmailMatch) {
    return { kind: "open_email_by_index", index: Number(openIndexedEmailMatch[1]) };
  }

  const openQueriedEmailMatch = normalized.match(/^(?:open) (?:the )?email about (.+)$/i);
  if (openQueriedEmailMatch) {
    return { kind: "open_email_by_query", query: openQueriedEmailMatch[1].trim() };
  }

  if (
    normalized === "add this email to calendar" ||
    normalized === "turn this email into a calendar event" ||
    normalized === "make a calendar event from this email"
  ) {
    return { kind: "create_calendar_event_from_email", index: null };
  }

  const emailToCalendarMatch = normalized.match(
    /^(?:add|turn|make) email (\d+) (?:to|into) (?:my )?calendar(?: event)?$/i,
  );
  if (emailToCalendarMatch) {
    return {
      kind: "create_calendar_event_from_email",
      index: Number(emailToCalendarMatch[1]),
    };
  }

  const emailQueryToCalendarMatch = normalized.match(
    /^(?:add|turn|make) (?:the )?email about (.+) (?:to|into) (?:my )?calendar(?: event)?$/i,
  );
  if (emailQueryToCalendarMatch) {
    return {
      kind: "create_calendar_event_from_email_query",
      query: emailQueryToCalendarMatch[1].trim(),
    };
  }

  const completeTaskMatch = normalized.match(/^complete task (\d+)$/i);
  if (completeTaskMatch) {
    return { kind: "complete_task_by_index", index: Number(completeTaskMatch[1]) };
  }

  const updateTaskMatch = trimmed.match(/^update task (\d+)\s+to\s+(.+)$/i);
  if (updateTaskMatch) {
    const remainder = updateTaskMatch[2].trim();
    const dueLabel = extractDueLabel(remainder);
    const title = dueLabel
      ? remainder.replace(new RegExp(escapeRegExp(dueLabel), "i"), "").replace(/\s+/g, " ").trim()
      : remainder;
    return {
      kind: "update_task_by_index",
      index: Number(updateTaskMatch[1]),
      title: title.replace(/\bfor\b$/i, "").trim(),
      dueLabel,
    };
  }

  if (normalized.startsWith("find my ")) {
    const query = trimmed.slice("find my ".length).trim();
    if (query) {
      return { kind: "search_files", query };
    }
  }

  if (normalized.startsWith("find file ")) {
    const query = trimmed.slice("find file ".length).trim();
    if (query) {
      return { kind: "search_files", query };
    }
  }

  if (normalized.startsWith("search files for ")) {
    const query = trimmed.slice("search files for ".length).trim();
    if (query) {
      return { kind: "search_files", query };
    }
  }

  if (
    normalized === "summarize all loaded pdfs" ||
    normalized === "summarize all pdfs" ||
    normalized === "summarize loaded pdfs"
  ) {
    return { kind: "summarize_all_loaded_pdfs" };
  }

  return null;
}

function parseConversationalCommandIntent(
  command: string,
  aliases: BrowserAliasRecord[],
): CommandIntent | null {
  const cleaned = cleanConversationalCommand(command);
  const normalized = cleaned.toLowerCase();
  const normalizedControl = normalizeControlCommand(command);

  if (
    [
      "stand by",
      "standby",
      "go to standby",
      "go back to standby",
      "arm wake mode",
      "arm yourself",
      "wait there",
    ].includes(normalizedControl)
  ) {
    return { kind: "standby_mode" };
  }

  if (
    [
      "go to sleep",
      "sleep now",
      "sleep",
      "stop listening",
      "stop wake mode",
      "go quiet",
      "be quiet",
    ].includes(normalizedControl)
  ) {
    return { kind: "sleep_mode" };
  }

  if (
    [
      "quiet mode",
      "use quiet mode",
      "switch to quiet mode",
      "set voice mode to quiet",
      "set reply mode to quiet",
    ].includes(normalizedControl)
  ) {
    return { kind: "set_voice_reply_mode", mode: "quiet" };
  }

  if (
    [
      "brief mode",
      "use brief mode",
      "switch to brief mode",
      "be brief",
      "set voice mode to brief",
      "set reply mode to brief",
    ].includes(normalizedControl)
  ) {
    return { kind: "set_voice_reply_mode", mode: "brief" };
  }

  if (
    [
      "normal mode",
      "use normal mode",
      "switch to normal mode",
      "set voice mode to normal",
      "set reply mode to normal",
    ].includes(normalizedControl)
  ) {
    return { kind: "set_voice_reply_mode", mode: "normal" };
  }

  if (
    [
      "detailed mode",
      "use detailed mode",
      "switch to detailed mode",
      "be more detailed",
      "set voice mode to detailed",
      "set reply mode to detailed",
    ].includes(normalizedControl)
  ) {
    return { kind: "set_voice_reply_mode", mode: "detailed" };
  }

  if (
    [
      "what is my voice mode",
      "what's my voice mode",
      "whats my voice mode",
      "what is your voice mode",
      "what's your voice mode",
      "whats your voice mode",
      "what reply mode are you using",
    ].includes(normalizedControl)
  ) {
    return { kind: "report_voice_reply_mode" };
  }

  if (
    [
      "shut down",
      "shutdown",
      "close jarvis",
      "exit jarvis",
      "quit jarvis",
      "close app",
      "exit app",
      "quit app",
      "close",
      "exit",
      "quit",
    ].includes(normalizedControl)
  ) {
    return { kind: "shutdown_app" };
  }

  const explicitIntent = parseExplicitCommandIntent(cleaned, aliases);
  if (explicitIntent) {
    return explicitIntent;
  }

  if (isStudyAppsCommand(cleaned)) {
    return { kind: "study_setup" };
  }

  const reminderIntent = parseReminderCommandIntent(cleaned);
  if (reminderIntent) {
    return reminderIntent;
  }

  const taskIntent = parseTaskCommandIntent(cleaned);
  if (taskIntent) {
    return taskIntent;
  }

  const calendarIntent = parseCalendarCommandIntent(cleaned);
  if (calendarIntent) {
    return calendarIntent;
  }

  const searchPatterns = [
    /(?:can you |could you |would you )?search(?: google)? for (.+)/i,
    /(?:can you |could you |would you )?look up (.+)/i,
    /(?:can you |could you |would you )?find (.+) on google/i,
    /(?:can you |could you |would you )?search (.+) on google/i,
  ];

  for (const pattern of searchPatterns) {
    const match = cleaned.match(pattern);
    const query = match?.[1]?.trim();
    if (query) {
      return { kind: "google_search", query };
    }
  }

  const createNotePatterns = [
    /(?:can you |could you |would you )?make a note(?: to)? (.+)/i,
    /(?:can you |could you |would you )?make me a note(?: to)? (.+)/i,
    /(?:can you |could you |would you )?create a note(?: to)? (.+)/i,
    /note this down[:\s]+(.+)/i,
    /remember this[:\s]+(.+)/i,
  ];

  for (const pattern of createNotePatterns) {
    const match = cleaned.match(pattern);
    const content = match?.[1]?.trim();
    if (content) {
      return { kind: "create_note", content };
    }
  }

  if (
    normalized === "show my notes" ||
    normalized === "list my notes" ||
    normalized === "show notes" ||
    normalized === "what are my notes"
  ) {
    return { kind: "list_notes" };
  }

  if (normalized === "read this note" || normalized === "show this note") {
    return { kind: "read_current_note" };
  }

  if (normalized === "open this note") {
    return { kind: "open_current_note" };
  }

  const openNoteMatch = normalized.match(/^open note (\d+)$/i);
  if (openNoteMatch) {
    return { kind: "open_note_by_index", index: Number(openNoteMatch[1]) };
  }

  const readNoteMatch = normalized.match(/^(?:read|show) note (\d+)$/i);
  if (readNoteMatch) {
    return { kind: "read_note_by_index", index: Number(readNoteMatch[1]) };
  }

  const searchNotePatterns = [
    /(?:can you |could you |would you )?find note about (.+)/i,
    /(?:can you |could you |would you )?search notes for (.+)/i,
    /show notes about (.+)/i,
  ];

  for (const pattern of searchNotePatterns) {
    const match = cleaned.match(pattern);
    const query = match?.[1]?.trim();
    if (query) {
      return { kind: "search_notes", query };
    }
  }

  if (
    normalized === "show recent files" ||
    normalized === "recent files" ||
    normalized === "show my recent files"
  ) {
    return { kind: "list_recent_files" };
  }

  if (
    normalized === "find pdfs" ||
    normalized === "show pdfs" ||
    normalized === "list pdfs"
  ) {
    return { kind: "list_pdfs" };
  }

  const pdfPatterns = [
    /(?:can you |could you |would you )?search pdfs for (.+)/i,
    /(?:can you |could you |would you )?find pdf about (.+)/i,
  ];

  for (const pattern of pdfPatterns) {
    const match = cleaned.match(pattern);
    const query = match?.[1]?.trim();
    if (query) {
      return { kind: "search_pdfs", query };
    }
  }

  const summarizePdfConversationalMatch = normalized.match(/^summarize pdf (\d+)$/i);
  if (summarizePdfConversationalMatch) {
    return {
      kind: "summarize_pdf_by_index",
      index: Number(summarizePdfConversationalMatch[1]),
    };
  }

  const openPdfConversationalMatch = normalized.match(/^open pdf (\d+)$/i);
  if (openPdfConversationalMatch) {
    return {
      kind: "open_pdf_by_index",
      index: Number(openPdfConversationalMatch[1]),
    };
  }

  const readPdfConversationalMatch = normalized.match(/^(?:read|show) pdf (\d+)$/i);
  if (readPdfConversationalMatch) {
    return {
      kind: "read_pdf_by_index",
      index: Number(readPdfConversationalMatch[1]),
    };
  }

  const summarizePdfConversationalQueryMatch = normalized.match(/^summarize (?:the )?pdf about (.+)$/i);
  if (summarizePdfConversationalQueryMatch) {
    return {
      kind: "summarize_pdf_by_query",
      query: summarizePdfConversationalQueryMatch[1].trim(),
    };
  }

  const openPdfConversationalQueryMatch = normalized.match(/^open (?:the )?pdf about (.+)$/i);
  if (openPdfConversationalQueryMatch) {
    return {
      kind: "open_pdf_by_query",
      query: openPdfConversationalQueryMatch[1].trim(),
    };
  }

  const readPdfConversationalQueryMatch = normalized.match(/^(?:read|show) (?:the )?pdf about (.+)$/i);
  if (readPdfConversationalQueryMatch) {
    return {
      kind: "read_pdf_by_query",
      query: readPdfConversationalQueryMatch[1].trim(),
    };
  }

  const savePdfSummaryConversationalMatch = normalized.match(/^save pdf (\d+) summary to notion$/i);
  if (savePdfSummaryConversationalMatch) {
    return {
      kind: "save_pdf_summary_to_notion_by_index",
      index: Number(savePdfSummaryConversationalMatch[1]),
    };
  }

  const savePdfSummaryConversationalQueryMatch = normalized.match(/^save (?:the )?pdf about (.+) summary to notion$/i);
  if (savePdfSummaryConversationalQueryMatch) {
    return {
      kind: "save_pdf_summary_to_notion_by_query",
      query: savePdfSummaryConversationalQueryMatch[1].trim(),
    };
  }

  const tasksFromPdfConversationalMatch = normalized.match(/^make tasks from pdf (\d+)$/i);
  if (tasksFromPdfConversationalMatch) {
    return {
      kind: "create_tasks_from_pdf_by_index",
      index: Number(tasksFromPdfConversationalMatch[1]),
    };
  }

  const tasksFromPdfConversationalQueryMatch = normalized.match(/^make tasks from (?:the )?pdf about (.+)$/i);
  if (tasksFromPdfConversationalQueryMatch) {
    return {
      kind: "create_tasks_from_pdf_by_query",
      query: tasksFromPdfConversationalQueryMatch[1].trim(),
    };
  }

  if (normalized === "open this pdf") {
    return { kind: "open_current_pdf" };
  }

  if (normalized === "read this pdf" || normalized === "show this pdf") {
    return { kind: "read_current_pdf" };
  }

  if (normalized === "summarize this pdf") {
    return { kind: "summarize_current_pdf" };
  }

  if (normalized === "save this pdf summary to notion" || normalized === "save this pdf to notion") {
    return { kind: "save_current_pdf_summary_to_notion" };
  }

  if (normalized === "make tasks from this pdf" || normalized === "create tasks from this pdf") {
    return { kind: "create_tasks_from_current_pdf" };
  }

  if (
    normalized === "play spotify" ||
    normalized === "resume spotify" ||
    normalized === "play music" ||
    normalized === "resume music"
  ) {
    return { kind: "spotify_play" };
  }

  if (
    normalized === "pause spotify" ||
    normalized === "pause music" ||
    normalized === "stop spotify"
  ) {
    return { kind: "spotify_pause" };
  }

  if (
    normalized === "next song" ||
    normalized === "skip song" ||
    normalized === "skip track" ||
    normalized === "spotify next" ||
    normalized === "next track"
  ) {
    return { kind: "spotify_next" };
  }

  if (
    normalized === "previous song" ||
    normalized === "last song" ||
    normalized === "spotify previous" ||
    normalized === "previous track"
  ) {
    return { kind: "spotify_previous" };
  }

  if (
    normalized === "what's playing on spotify" ||
    normalized === "whats playing on spotify" ||
    normalized === "what is playing on spotify" ||
    normalized === "what's playing" ||
    normalized === "whats playing"
  ) {
    return { kind: "spotify_status" };
  }

  const spotifySearchPatterns = [
    /(?:can you |could you |would you )?play (.+) on spotify/i,
    /(?:can you |could you |would you )?search spotify for (.+)/i,
    /(?:can you |could you |would you )?find (.+) on spotify/i,
  ];

  for (const pattern of spotifySearchPatterns) {
    const match = cleaned.match(pattern);
    const query = match?.[1]?.trim();
    if (query) {
      return { kind: "open_url", url: buildSpotifySearchUrl(query) };
    }
  }

  if (
    normalized === "show unread emails" ||
    normalized === "show my unread emails" ||
    normalized === "check my email" ||
    normalized === "check my emails" ||
    normalized === "show unread mail"
  ) {
    return { kind: "list_unread_emails" };
  }

  if (
    normalized === "analyze this email" ||
    normalized === "extract details from this email" ||
    normalized === "pull details from this email"
  ) {
    return { kind: "extract_email_signals", index: null };
  }

  if (normalized === "read this email" || normalized === "show this email") {
    return { kind: "read_current_email" };
  }

  if (normalized === "open this email") {
    return { kind: "open_current_email" };
  }

  if (
    normalized === "create daily brief" ||
    normalized === "make my daily brief" ||
    normalized === "save daily brief to notion" ||
    normalized === "generate daily brief"
  ) {
    return { kind: "create_daily_brief" };
  }

  const searchEmailPatterns = [
    /(?:can you |could you |would you )?search email for (.+)/i,
    /(?:can you |could you |would you )?search gmail for (.+)/i,
    /(?:can you |could you |would you )?find emails about (.+)/i,
    /(?:can you |could you |would you )?look for emails about (.+)/i,
  ];

  for (const pattern of searchEmailPatterns) {
    const match = cleaned.match(pattern);
    const query = match?.[1]?.trim();
    if (query) {
      return { kind: "search_emails", query };
    }
  }

  if (
    normalized === "save this email to notion" ||
    normalized === "save latest email to notion" ||
    normalized === "save this email as a note"
  ) {
    return { kind: "save_latest_email_to_notion" };
  }

  if (
    normalized === "save unread emails to notion" ||
    normalized === "summarize unread emails into notion" ||
    normalized === "save email digest to notion"
  ) {
    return { kind: "save_email_digest_to_notion" };
  }

  const saveIndexedEmailConversationalMatch = normalized.match(/^save email (\d+) to notion$/i);
  if (saveIndexedEmailConversationalMatch) {
    return {
      kind: "save_email_to_notion_by_index",
      index: Number(saveIndexedEmailConversationalMatch[1]),
    };
  }

  const saveQueriedEmailConversationalMatch = normalized.match(
    /^save (?:the )?email about (.+) to notion$/i,
  );
  if (saveQueriedEmailConversationalMatch) {
    return {
      kind: "save_email_to_notion_by_query",
      query: saveQueriedEmailConversationalMatch[1].trim(),
    };
  }

  const extractIndexedEmailConversationalMatch = normalized.match(
    /^(?:analyze|extract details from|pull details from) email (\d+)$/i,
  );
  if (extractIndexedEmailConversationalMatch) {
    return {
      kind: "extract_email_signals",
      index: Number(extractIndexedEmailConversationalMatch[1]),
    };
  }

  const extractQueriedEmailConversationalMatch = normalized.match(
    /^(?:analyze|extract details from|pull details from) (?:the )?email about (.+)$/i,
  );
  if (extractQueriedEmailConversationalMatch) {
    return {
      kind: "extract_email_signals_by_query",
      query: extractQueriedEmailConversationalMatch[1].trim(),
    };
  }

  const readIndexedEmailConversationalMatch = normalized.match(/^(?:read|show) email (\d+)$/i);
  if (readIndexedEmailConversationalMatch) {
    return {
      kind: "read_email_by_index",
      index: Number(readIndexedEmailConversationalMatch[1]),
    };
  }

  const readQueriedEmailConversationalMatch = normalized.match(
    /^(?:read|show) (?:the )?email about (.+)$/i,
  );
  if (readQueriedEmailConversationalMatch) {
    return {
      kind: "read_email_by_query",
      query: readQueriedEmailConversationalMatch[1].trim(),
    };
  }

  const openIndexedEmailConversationalMatch = normalized.match(/^(?:open) email (\d+)$/i);
  if (openIndexedEmailConversationalMatch) {
    return {
      kind: "open_email_by_index",
      index: Number(openIndexedEmailConversationalMatch[1]),
    };
  }

  const openQueriedEmailConversationalMatch = normalized.match(
    /^(?:open) (?:the )?email about (.+)$/i,
  );
  if (openQueriedEmailConversationalMatch) {
    return {
      kind: "open_email_by_query",
      query: openQueriedEmailConversationalMatch[1].trim(),
    };
  }

  if (
    normalized === "add this email to calendar" ||
    normalized === "turn this email into a calendar event" ||
    normalized === "make a calendar event from this email"
  ) {
    return { kind: "create_calendar_event_from_email", index: null };
  }

  const emailToCalendarConversationalMatch = normalized.match(
    /^(?:add|turn|make) email (\d+) (?:to|into) (?:my )?calendar(?: event)?$/i,
  );
  if (emailToCalendarConversationalMatch) {
    return {
      kind: "create_calendar_event_from_email",
      index: Number(emailToCalendarConversationalMatch[1]),
    };
  }

  const emailQueryToCalendarConversationalMatch = normalized.match(
    /^(?:add|turn|make) (?:the )?email about (.+) (?:to|into) (?:my )?calendar(?: event)?$/i,
  );
  if (emailQueryToCalendarConversationalMatch) {
    return {
      kind: "create_calendar_event_from_email_query",
      query: emailQueryToCalendarConversationalMatch[1].trim(),
    };
  }

  const completeTaskConversationalMatch = normalized.match(/^complete task (\d+)$/i);
  if (completeTaskConversationalMatch) {
    return {
      kind: "complete_task_by_index",
      index: Number(completeTaskConversationalMatch[1]),
    };
  }

  const updateTaskConversationalMatch = cleaned.match(/^update task (\d+)\s+to\s+(.+)$/i);
  if (updateTaskConversationalMatch) {
    const remainder = updateTaskConversationalMatch[2].trim();
    const dueLabel = extractDueLabel(remainder);
    const title = dueLabel
      ? remainder.replace(new RegExp(escapeRegExp(dueLabel), "i"), "").replace(/\s+/g, " ").trim()
      : remainder;
    return {
      kind: "update_task_by_index",
      index: Number(updateTaskConversationalMatch[1]),
      title: title.replace(/\bfor\b$/i, "").trim(),
      dueLabel,
    };
  }

  const filePatterns = [
    /(?:can you |could you |would you )?find my (.+)/i,
    /(?:can you |could you |would you )?find file (.+)/i,
    /(?:can you |could you |would you )?search files for (.+)/i,
    /show me my (.+) file/i,
  ];

  for (const pattern of filePatterns) {
    const match = cleaned.match(pattern);
    const query = match?.[1]?.trim();
    if (query) {
      return { kind: "search_files", query };
    }
  }

  const openPatterns = [
    /(?:can you |could you |would you )?open (.+)/i,
    /(?:can you |could you |would you )?launch (.+)/i,
    /(?:also |and )open (.+)/i,
  ];

  for (const pattern of openPatterns) {
    const match = cleaned.match(pattern);
    const target = match?.[1]?.trim();
    if (!target) {
      continue;
    }

    const resolvedAlias = resolveBrowserAliasTarget(target, aliases);
    if (resolvedAlias) {
      return { kind: "open_url", url: resolvedAlias };
    }

    if (target.includes(".") || /^[a-z0-9-]+$/i.test(target)) {
      return { kind: "open_url", url: normalizeUrlTarget(target) };
    }
  }

  return null;
}

function buildClarificationForCommand(
  command: string,
  aliases: BrowserAliasRecord[],
): PendingClarification | null {
  const cleaned = cleanConversationalCommand(command);
  const normalized = cleaned.toLowerCase();

  if (isKnownBrowserTarget(normalized, aliases) && !hasExplicitOpenLanguage(cleaned) && !hasExplicitSearchLanguage(cleaned)) {
    const resolvedTarget = resolveBrowserAliasTarget(normalized, aliases) ?? normalizeUrlTarget(normalized);
    const titleTarget = normalized
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    return {
      prompt: `Be explicit with ${titleTarget}. Say "open ${normalized}" to open it, or "search google for ..." if you want a search.`,
      choices: [
        {
          label: `open ${normalized}`,
          intent: { kind: "open_url", url: resolvedTarget },
        },
      ],
    };
  }

  if (normalized === "google" || normalized === "open google") {
    return {
      prompt: "Do you want the Google homepage or a Google search?",
      choices: [
        {
          label: "Open Google homepage",
          intent: { kind: "open_url", url: resolveBrowserAliasTarget("google", aliases) ?? "https://www.google.com/" },
        },
        {
          label: "Start a Google search",
          intent: { kind: "google_search", query: "" },
        },
      ],
    };
  }

  if (normalized.includes("google stuff")) {
    return {
      prompt: "Do you want Google Calendar, Google Docs, or Google Drive?",
      choices: [
        {
          label: "Open Google Calendar",
          intent: { kind: "open_url", url: resolveBrowserAliasTarget("google calendar", aliases) ?? "https://calendar.google.com/" },
        },
        {
          label: "Open Google Docs",
          intent: { kind: "open_url", url: resolveBrowserAliasTarget("google docs", aliases) ?? "https://docs.google.com/" },
        },
        {
          label: "Open Google Drive",
          intent: { kind: "open_url", url: resolveBrowserAliasTarget("google drive", aliases) ?? "https://drive.google.com/" },
        },
      ],
    };
  }

  return null;
}

function resolveClarificationReply(
  reply: string,
  clarification: PendingClarification,
): CommandIntent | null {
  const normalized = cleanConversationalCommand(reply).toLowerCase();

  if (["yes", "yeah", "yep", "sure", "okay", "ok", "first one", "first"].includes(normalized)) {
    return clarification.choices[0]?.intent ?? null;
  }

  if (["second", "second one", "option two", "2"].includes(normalized)) {
    return clarification.choices[1]?.intent ?? null;
  }

  if (["third", "third one", "option three", "3"].includes(normalized)) {
    return clarification.choices[2]?.intent ?? null;
  }

  const matchedChoice = clarification.choices.find((choice) =>
    normalized.includes(choice.label.toLowerCase().replace(/^open /, "").replace(/^start /, "")),
  );

  return matchedChoice?.intent ?? null;
}

function getErrorDetail(
  error: unknown,
  fallback: string,
) {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function parseClockTime(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const meridiem = match[3]?.toLowerCase();

  if (minutes > 59 || hours > 24 || hours < 0) {
    return null;
  }

  if (meridiem) {
    if (hours === 12) {
      hours = meridiem === "am" ? 0 : 12;
    } else if (meridiem === "pm") {
      hours += 12;
    }
  }

  if (!meridiem && hours === 24) {
    hours = 0;
  }

  if (hours > 23) {
    return null;
  }

  return { hours, minutes };
}

function resolveDayReference(dayToken: string, now: Date) {
  const normalized = dayToken.trim().toLowerCase();
  const base = startOfDay(now);

  if (normalized === "today") {
    return base;
  }

  if (normalized === "tomorrow") {
    return addMinutes(base, 24 * 60);
  }

  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const targetIndex = weekdays.findIndex((weekday) => weekday === normalized);
  if (targetIndex === -1) {
    return null;
  }

  const currentIndex = base.getDay();
  let diff = (targetIndex - currentIndex + 7) % 7;
  if (diff === 0) {
    diff = 7;
  }

  return addMinutes(base, diff * 24 * 60);
}

function parseDurationMinutes(command: string) {
  const hourMatch = command.match(/\bfor\s+(\d+)\s+hour/i);
  if (hourMatch) {
    return Number(hourMatch[1]) * 60;
  }

  const minuteMatch = command.match(/\bfor\s+(\d+)\s+minute/i);
  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  return 60;
}

function extractDueLabel(text: string) {
  const relativeMatch = text.match(
    /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i,
  );
  if (relativeMatch) {
    return relativeMatch[0].trim();
  }

  const explicitMatch = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i,
  );
  if (explicitMatch) {
    return explicitMatch[0].trim();
  }

  return null;
}

function parseTaskCommandIntent(command: string) {
  const trimmed = cleanConversationalCommand(command);
  const normalized = trimmed.toLowerCase();

  if (
    normalized === "complete this task" ||
    normalized === "complete that task" ||
    normalized === "mark this task done"
  ) {
    return { kind: "complete_current_task" as const };
  }

  if (normalized === "reopen this task" || normalized === "reopen that task") {
    return { kind: "reopen_current_task" as const };
  }

  if (normalized === "move this task to today" || normalized === "move that task to today") {
    return { kind: "move_current_task" as const, dueLabel: "today" };
  }

  if (
    normalized === "move this task to tomorrow" ||
    normalized === "move that task to tomorrow"
  ) {
    return { kind: "move_current_task" as const, dueLabel: "tomorrow" };
  }

  if (
    normalized === "show today's tasks" ||
    normalized === "show today tasks" ||
    normalized === "what are my tasks today" ||
    normalized === "list today's tasks" ||
    normalized === "list my tasks for today"
  ) {
    return { kind: "list_today_tasks" as const };
  }

  if (
    normalized === "show upcoming tasks" ||
    normalized === "list upcoming tasks" ||
    normalized === "what are my upcoming tasks"
  ) {
    return { kind: "list_upcoming_tasks" as const };
  }

  if (
    normalized === "show overdue tasks" ||
    normalized === "list overdue tasks" ||
    normalized === "what are my overdue tasks"
  ) {
    return { kind: "list_overdue_tasks" as const };
  }

  if (normalized === "complete all overdue tasks") {
    return { kind: "complete_all_overdue_tasks" as const };
  }

  if (
    normalized === "show done tasks" ||
    normalized === "list done tasks" ||
    normalized === "show completed tasks"
  ) {
    return { kind: "list_done_tasks" as const };
  }

  if (
    normalized === "show open tasks" ||
    normalized === "list open tasks" ||
    normalized === "show active tasks"
  ) {
    return { kind: "list_open_tasks" as const };
  }

  const taskPatterns = [
    /^make a task(?: to)? (.+)$/i,
    /^make me a task(?: to)? (.+)$/i,
    /^create a task(?: to)? (.+)$/i,
    /^add a task(?: to)? (.+)$/i,
    /^add task(?: to)? (.+)$/i,
  ];

  for (const pattern of taskPatterns) {
    const match = trimmed.match(pattern);
    const remainder = match?.[1]?.trim();
    if (!remainder) {
      continue;
    }

    const dueLabel = extractDueLabel(remainder);
    const title = dueLabel
      ? remainder.replace(new RegExp(escapeRegExp(dueLabel), "i"), "").replace(/\s+/g, " ").trim()
      : remainder;

    return {
      kind: "create_task_note" as const,
      title: title.replace(/\bfor\b$/i, "").trim(),
      dueLabel,
    };
  }

  const completeTaskByQueryMatch = trimmed.match(/^complete task (?:about |called |named )?(.+)$/i);
  if (completeTaskByQueryMatch && !/^\d+$/.test(completeTaskByQueryMatch[1].trim())) {
    return { kind: "complete_task_by_query" as const, query: completeTaskByQueryMatch[1].trim() };
  }

  const reopenTaskByIndexMatch = trimmed.match(/^reopen task (\d+)$/i);
  if (reopenTaskByIndexMatch) {
    return { kind: "reopen_task_by_index" as const, index: Number(reopenTaskByIndexMatch[1]) };
  }

  const reopenTaskByQueryMatch = trimmed.match(/^reopen task (?:about |called |named )?(.+)$/i);
  if (reopenTaskByQueryMatch && !/^\d+$/.test(reopenTaskByQueryMatch[1].trim())) {
    return { kind: "reopen_task_by_query" as const, query: reopenTaskByQueryMatch[1].trim() };
  }

  const moveTaskByIndexMatch = trimmed.match(/^move task (\d+) to (today|tomorrow)$/i);
  if (moveTaskByIndexMatch) {
    return {
      kind: "move_task_by_index" as const,
      index: Number(moveTaskByIndexMatch[1]),
      dueLabel: moveTaskByIndexMatch[2].toLowerCase(),
    };
  }

  const moveTaskByQueryMatch = trimmed.match(/^move task (?:about |called |named )?(.+?) to (today|tomorrow)$/i);
  if (moveTaskByQueryMatch) {
    return {
      kind: "move_task_by_query" as const,
      query: moveTaskByQueryMatch[1].trim(),
      dueLabel: moveTaskByQueryMatch[2].toLowerCase(),
    };
  }

  const updateTaskByQueryMatch = trimmed.match(/^update task (?:about |called |named )?(.+?)\s+to\s+(.+)$/i);
  if (updateTaskByQueryMatch && !/^\d+$/.test(updateTaskByQueryMatch[1].trim())) {
    const remainder = updateTaskByQueryMatch[2].trim();
    const dueLabel = extractDueLabel(remainder);
    const title = dueLabel
      ? remainder.replace(new RegExp(escapeRegExp(dueLabel), "i"), "").replace(/\s+/g, " ").trim()
      : remainder;
    return {
      kind: "update_task_by_query" as const,
      query: updateTaskByQueryMatch[1].trim(),
      title: title.replace(/\bfor\b$/i, "").trim(),
      dueLabel,
    };
  }

  const filterTasksByQueryMatch = trimmed.match(/^(?:show|list|filter) tasks (?:about|tagged) (.+)$/i);
  if (filterTasksByQueryMatch) {
    return { kind: "filter_tasks_by_query" as const, query: filterTasksByQueryMatch[1].trim() };
  }

  return null;
}

function parseCalendarCommandIntent(command: string) {
  const trimmed = cleanConversationalCommand(command);
  const normalized = trimmed.toLowerCase();
  const triggerPatterns = [
    "add ",
    "schedule ",
    "create an event ",
    "create event ",
    "put ",
  ];

  const hasCalendarIntent =
    normalized.includes("calendar") ||
    normalized.includes("schedule") ||
    normalized.startsWith("add ") ||
    normalized.startsWith("schedule ");

  if (!hasCalendarIntent) {
    return null;
  }

  const timeMatch = trimmed.match(
    /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );

  if (!timeMatch) {
    return null;
  }

  const dayToken = timeMatch[1];
  const timeToken = timeMatch[2];
  const day = resolveDayReference(dayToken, new Date());
  const clock = parseClockTime(timeToken);
  if (!day || !clock) {
    return null;
  }

  const start = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    clock.hours,
    clock.minutes,
    0,
    0,
  );
  const end = addMinutes(start, parseDurationMinutes(trimmed));

  let title = trimmed;
  for (const triggerPattern of triggerPatterns) {
    if (normalized.startsWith(triggerPattern)) {
      title = trimmed.slice(triggerPattern.length).trim();
      break;
    }
  }

  const timeFragmentPattern = new RegExp(
    `\\b${escapeRegExp(dayToken)}\\b\\s+at\\s+${escapeRegExp(timeToken)}`,
    "i",
  );
  title = title
    .replace(timeFragmentPattern, "")
    .replace(/\bto my calendar\b/gi, "")
    .replace(/\bin my calendar\b/gi, "")
    .replace(/\bfor \d+ (hour|hours|minute|minutes)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) {
    title = "New event";
  }

  return { kind: "create_calendar_event" as const, title, start, end };
}

function parseReminderCommandIntent(command: string) {
  const trimmed = cleanConversationalCommand(command);
  const normalized = trimmed.toLowerCase();
  const reminderIntent =
    normalized.startsWith("remind me to ") ||
    normalized.startsWith("set a reminder to ") ||
    normalized.startsWith("set a reminder for ") ||
    normalized.startsWith("remind me about ");

  if (!reminderIntent) {
    return null;
  }

  const timeMatch = trimmed.match(
    /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );

  if (!timeMatch) {
    return null;
  }

  const dayToken = timeMatch[1];
  const timeToken = timeMatch[2];
  const day = resolveDayReference(dayToken, new Date());
  const clock = parseClockTime(timeToken);
  if (!day || !clock) {
    return null;
  }

  const start = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    clock.hours,
    clock.minutes,
    0,
    0,
  );
  const end = addMinutes(start, 30);

  let title = trimmed
    .replace(/^remind me to\s+/i, "")
    .replace(/^set a reminder to\s+/i, "")
    .replace(/^set a reminder for\s+/i, "")
    .replace(/^remind me about\s+/i, "");

  const timeFragmentPattern = new RegExp(
    `\\b${escapeRegExp(dayToken)}\\b\\s+at\\s+${escapeRegExp(timeToken)}`,
    "i",
  );
  title = title
    .replace(timeFragmentPattern, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) {
    title = "Reminder";
  }

  return {
    kind: "create_reminder" as const,
    title: `Reminder: ${title}`,
    start,
    end,
  };
}

function formatGoogleCalendarDate(date: Date) {
  const parts = [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
    "T",
    date.getHours().toString().padStart(2, "0"),
    date.getMinutes().toString().padStart(2, "0"),
    date.getSeconds().toString().padStart(2, "0"),
  ];
  return parts.join("");
}

function buildGoogleCalendarEventUrl(title: string, start: Date, end: Date) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set(
    "dates",
    `${formatGoogleCalendarDate(start)}/${formatGoogleCalendarDate(end)}`,
  );
  url.searchParams.set("ctz", timezone);
  url.searchParams.set("details", "Created by JARVIS");
  return url.toString();
}

function buildGoogleSearchUrl(query: string) {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", query);
  return url.toString();
}

const workflowLeadPattern =
  /^(open|read|show|save|add|search|find|make|create|complete|reopen|move|summarize|analyze|extract|play|pause|launch|check|list|filter)\b/i;

const SAVED_WORKFLOWS_STORAGE_KEY = "jarvis_saved_workflows_v1";
const WORKFLOW_COUNTS_STORAGE_KEY = "jarvis_workflow_counts_v1";
const DISMISSED_WORKFLOWS_STORAGE_KEY = "jarvis_dismissed_workflows_v1";
const VOICE_REPLY_MODE_STORAGE_KEY = "jarvis_voice_reply_mode_v1";
const PEOPLE_MEMORY_STORAGE_KEY = "jarvis_people_memory_v1";
const TRAVEL_MEMORY_STORAGE_KEY = "jarvis_travel_memory_v1";
const EXPENSE_MEMORY_STORAGE_KEY = "jarvis_expense_memory_v1";
const PACKAGE_MEMORY_STORAGE_KEY = "jarvis_package_memory_v1";
const MEETING_PREP_MEMORY_STORAGE_KEY = "jarvis_meeting_prep_memory_v1";
const SCHOOL_PLAN_MEMORY_STORAGE_KEY = "jarvis_school_plan_memory_v1";

const workflowTemplates: WorkflowTemplateRecord[] = [
  {
    id: "email-capture",
    name: "Email Capture",
    description: "Search Gmail, open the first result, and save it to Notion.",
    triggerPhrase: "run email capture",
    steps: ["search email for {{input}}", "open the first one", "save it to notion"],
  },
  {
    id: "pdf-summary",
    name: "PDF Summary",
    description: "Summarize the current PDF and save that summary to Notion.",
    triggerPhrase: "run pdf summary",
    steps: ["summarize {{current_pdf}}", "save {{current_pdf}} summary to notion"],
  },
  {
    id: "task-reset",
    name: "Task Reset",
    description: "Show open tasks, complete the first one, then show done tasks.",
    triggerPhrase: "run task reset",
    steps: ["show open tasks", "complete the first one", "show done tasks"],
  },
  {
    id: "smart-pdf-summary",
    name: "Smart PDF Summary",
    description: "If a PDF is already active, summarize it. Otherwise stop cleanly.",
    triggerPhrase: "run smart pdf summary",
    steps: [
      "if has current pdf then summarize {{current_pdf}} else stop",
      "if has current pdf then save {{current_pdf}} summary to notion",
    ],
  },
  {
    id: "smart-email-capture",
    name: "Smart Email Capture",
    description: "If emails are loaded, open and save the first one. Otherwise search first.",
    triggerPhrase: "run smart email capture",
    steps: [
      "if no emails then search email for {{input}}",
      "if has emails then open the first one else stop",
      "if has current email then save {{current_email}} to notion",
    ],
  },
  {
    id: "batch-email-save",
    name: "Batch Email Save",
    description: "Save the first N currently loaded emails into Notion.",
    triggerPhrase: "run batch email save",
    steps: ["save first {{input}} emails to notion"],
  },
  {
    id: "overdue-task-cleanup",
    name: "Overdue Task Cleanup",
    description: "Complete all overdue tasks, then show done tasks.",
    triggerPhrase: "run overdue cleanup",
    steps: ["complete all overdue tasks", "show done tasks"],
  },
];

function splitWorkflowCommand(command: string) {
  const trimmed = cleanConversationalCommand(command);
  if (!trimmed) {
    return null;
  }

  const working = trimmed
    .replace(/,\s*(?=(open|read|show|save|add|search|find|make|create|complete|reopen|move|summarize|analyze|extract|play|pause|launch|check|list|filter)\b)/gi, " ||| ")
    .replace(/\s+and then\s+/gi, " ||| ")
    .replace(/\s+then\s+/gi, " ||| ")
    .replace(
      /\s+and\s+(?=(open|read|show|save|add|search|find|make|create|complete|reopen|move|summarize|analyze|extract|play|pause|launch|check|list|filter)\b)/gi,
      " ||| ",
    );

  const parts = working
    .split(/\s*\|\|\|\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  return parts.every((part) => workflowLeadPattern.test(part)) ? parts : null;
}

function normalizeWorkflowStep(step: string) {
  return normalizeControlCommand(step);
}

function buildWorkflowSignature(steps: string[]) {
  return steps.map(normalizeWorkflowStep).join(" -> ");
}

function generateWorkflowName(steps: string[]) {
  const firstStep = steps[0] ?? "workflow";
  const cleaned = cleanConversationalCommand(firstStep)
    .replace(/\b(the|this|that|my)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, 4);
  const label = words.length > 0 ? words.join(" ") : "workflow";
  return label.replace(/\b\w/g, (match) => match.toUpperCase());
}

function generateWorkflowTriggerPhrase(name: string) {
  return `run ${name.toLowerCase()}`;
}

function resolveSavedWorkflowInvocation(
  command: string,
  workflows: SavedWorkflowRecord[],
) {
  const normalizedCommand = normalizeControlCommand(command);

  for (const workflow of workflows) {
    const normalizedTrigger = normalizeControlCommand(workflow.triggerPhrase);
    if (normalizedCommand === normalizedTrigger) {
      return { workflow, inputText: "" };
    }

    if (normalizedCommand.startsWith(`${normalizedTrigger} `)) {
      return {
        workflow,
        inputText: command.trim().slice(workflow.triggerPhrase.trim().length).trim(),
      };
    }
  }

  return null;
}

function renderWorkflowStep(
  step: string,
  activeContext: ActiveConversationContext | null,
  inputText: string,
) {
  const placeholderValues: Record<string, string | null> = {
    input: inputText.trim() || null,
    current_email: activeContext?.kind === "email" ? "this email" : null,
    current_pdf: activeContext?.kind === "pdf" ? "this pdf" : null,
    current_note: activeContext?.kind === "note" ? "this note" : null,
    current_task: activeContext?.kind === "task" ? "this task" : null,
    current_browser: activeContext?.kind === "browser" ? "it" : null,
  };

  let missingPlaceholder: string | null = null;
  const rendered = step.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const value = placeholderValues[key];
    if (!value) {
      missingPlaceholder = key;
      return _match;
    }
    return value;
  });

  return {
    step: rendered,
    missingPlaceholder,
  };
}

function evaluateWorkflowCondition(
  condition: string,
  activeContext: ActiveConversationContext | null,
  emails: EmailRecord[],
  files: FileRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
) {
  const normalized = condition.toLowerCase().replace(/\s+/g, " ").trim();

  const hasCurrentEmail = activeContext?.kind === "email";
  const hasCurrentPdf = activeContext?.kind === "pdf";
  const hasCurrentNote = activeContext?.kind === "note";
  const hasCurrentTask = activeContext?.kind === "task";
  const hasEmails = emails.length > 0;
  const hasPdfs = getLoadedPdfFiles(files).length > 0;
  const hasNotes = notes.length > 0;
  const hasTasks = tasks.length > 0;

  const conditions: Record<string, boolean> = {
    "has current email": hasCurrentEmail,
    "has current pdf": hasCurrentPdf,
    "has current note": hasCurrentNote,
    "has current task": hasCurrentTask,
    "has emails": hasEmails,
    "has pdfs": hasPdfs,
    "has notes": hasNotes,
    "has tasks": hasTasks,
    "no current email": !hasCurrentEmail,
    "no current pdf": !hasCurrentPdf,
    "no current note": !hasCurrentNote,
    "no current task": !hasCurrentTask,
    "no emails": !hasEmails,
    "no pdfs": !hasPdfs,
    "no notes": !hasNotes,
    "no tasks": !hasTasks,
  };

  return conditions[normalized] ?? false;
}

function resolveWorkflowConditionalStep(
  rawStep: string,
  activeContext: ActiveConversationContext | null,
  emails: EmailRecord[],
  files: FileRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
): WorkflowStepResolution {
  const trimmed = rawStep.trim();
  const conditionalMatch = trimmed.match(/^if (.+?) then (.+?)(?: else (.+))?$/i);
  if (!conditionalMatch) {
    return { action: "run", step: trimmed };
  }

  const condition = conditionalMatch[1].trim();
  const thenStep = conditionalMatch[2].trim();
  const elseStep = conditionalMatch[3]?.trim() ?? null;
  const passed = evaluateWorkflowCondition(
    condition,
    activeContext,
    emails,
    files,
    notes,
    tasks,
  );

  const selected = passed ? thenStep : elseStep;
  if (!selected) {
    return { action: "skip" };
  }

  if (normalizeControlCommand(selected) === "stop") {
    return { action: "stop" };
  }

  return { action: "run", step: selected };
}

function App() {
  const [input, setInput] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "Core online. Desktop skills are ready to be wired.",
  );
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null);
  const [isRoutingCommand, setIsRoutingCommand] = useState(false);
  const [storedRoutines, setStoredRoutines] = useState<RoutineRecord[]>([]);
  const [recentHistory, setRecentHistory] = useState<HistoryRecord[]>([]);
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [proposalSteps, setProposalSteps] = useState<Record<number, ProposalStepRecord[]>>({});
  const [editingProposalId, setEditingProposalId] = useState<number | null>(null);
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
  const localRecorderRef = useRef<{ stop: () => Promise<string> } | null>(null);
  const [assistantName, setAssistantName] = useState("Jarvis");
  const [wakeModeEnabled, setWakeModeEnabled] = useState(false);
  const [wakeModeStatus, setWakeModeStatus] = useState<WakeModeStatus | null>(null);
  const [wakeCueActive, setWakeCueActive] = useState(false);
  const [browserAliases, setBrowserAliases] = useState<BrowserAliasRecord[]>([]);
  const [learnedIntentMappings, setLearnedIntentMappings] = useState<LearnedIntentRecord[]>([]);
  const [browserAliasUrl, setBrowserAliasUrl] = useState("");
  const [googleCalendarStatus, setGoogleCalendarStatus] =
    useState<GoogleCalendarStatus | null>(null);
  const [googleCalendarClientId, setGoogleCalendarClientId] = useState("");
  const [googleCalendarApiKey, setGoogleCalendarApiKey] = useState("");
  const [googleCalendarAccessToken, setGoogleCalendarAccessToken] = useState<string | null>(null);
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(null);
  const [recentEmails, setRecentEmails] = useState<EmailRecord[]>([]);
  const [plannerTasks, setPlannerTasks] = useState<PlannerTaskRecord[]>([]);
  const [peopleMemory, setPeopleMemory] = useState<PersonMemoryRecord[]>([]);
  const [travelMemory, setTravelMemory] = useState<TravelMemoryRecord[]>([]);
  const [expenseMemory, setExpenseMemory] = useState<ExpenseMemoryRecord[]>([]);
  const [packageMemory, setPackageMemory] = useState<PackageMemoryRecord[]>([]);
  const [meetingPrepMemory, setMeetingPrepMemory] = useState<MeetingPrepMemoryRecord[]>([]);
  const [schoolPlanMemory, setSchoolPlanMemory] = useState<SchoolPlanMemoryRecord[]>([]);
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatus | null>(null);
  const [spotifyClientId, setSpotifyClientId] = useState("");
  const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | null>(null);
  const [spotifyPlaybackState, setSpotifyPlaybackState] = useState<SpotifyPlaybackState | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileRecord[]>([]);
  const [activeConversationContext, setActiveConversationContext] =
    useState<ActiveConversationContext | null>(null);
  const [presentedCollectionContext, setPresentedCollectionContext] =
    useState<PresentedCollectionContext | null>(null);
  const [notionStatus, setNotionStatus] = useState<NotionStatus | null>(null);
  const [notionTokenInput, setNotionTokenInput] = useState("");
  const [notionDatabaseId, setNotionDatabaseId] = useState("");
  const [recentNotes, setRecentNotes] = useState<NoteRecord[]>([]);
  const [conversationBackend, setConversationBackend] =
    useState<ConversationBackend>("heuristics");
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://127.0.0.1:11434");
  const [ollamaModelName, setOllamaModelName] = useState("");
  const [missingSkillRequest, setMissingSkillRequest] = useState<string | null>(null);
  const [missingSkillPlan, setMissingSkillPlan] = useState<MissingSkillPlan | null>(null);
  const [isGeneratingMissingSkillPlan, setIsGeneratingMissingSkillPlan] = useState(false);
  const [implementationRequest, setImplementationRequest] =
    useState<SkillImplementationRequest | null>(null);
  const [buildRequest, setBuildRequest] = useState<SkillBuildRequest | null>(null);
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflowRecord[]>([]);
  const [workflowSuggestion, setWorkflowSuggestion] = useState<WorkflowSuggestionRecord | null>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [pendingWorkflowExecution, setPendingWorkflowExecution] =
    useState<PendingWorkflowExecution | null>(null);
  const [workflowImportText, setWorkflowImportText] = useState("");
  const [autonomousSkillBuildingEnabled, setAutonomousSkillBuildingEnabled] = useState(false);
  const [autonomousBuildStatus, setAutonomousBuildStatus] =
    useState<AutonomousBuildStatus>("idle");
  const [handoffArtifact, setHandoffArtifact] = useState<BuildHandoffArtifact | null>(null);
  const [executorStatus, setExecutorStatus] = useState<ExecutorStatus | null>(null);
  const [executorCommandPath, setExecutorCommandPath] = useState("");
  const [executorWorkingDirectory, setExecutorWorkingDirectory] = useState("");
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([
    {
      id: 1,
      role: "jarvis",
      text: "Conversation mode is starting up. Talk naturally and I'll try to understand, ask follow-ups, and act through the existing skills.",
    },
  ]);
  const [pendingClarification, setPendingClarification] = useState<PendingClarification | null>(null);
  const [wakeListenerActive, setWakeListenerActive] = useState(false);
  const [followUpWindow, setFollowUpWindow] = useState<FollowUpWindow | null>(null);
  const commandRecognitionRef = useRef<BrowserRecognitionHandle | null>(null);
  const wakeRecognitionRef = useRef<BrowserRecognitionHandle | null>(null);
  const wakeRestartTimeoutRef = useRef<number | null>(null);
  const followUpTimeoutRef = useRef<number | null>(null);
  const wakeTriggeredRef = useRef(false);

  const upcomingModules = useMemo(
    () => skills.filter((skill) => skill.status === "planned").length,
    [],
  );
  const shouldAutoRouteVoice = voiceAutoRouteEnabled || conversationBackend === "ollama";
  const lastAutoRoutedVoiceRef = useRef("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SAVED_WORKFLOWS_STORAGE_KEY);
      if (saved) {
        setSavedWorkflows(JSON.parse(saved) as SavedWorkflowRecord[]);
      }
    } catch {
      setSavedWorkflows([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SAVED_WORKFLOWS_STORAGE_KEY,
        JSON.stringify(savedWorkflows),
      );
    } catch {
      setStatusMessage("JARVIS could not persist saved workflows locally.");
    }
  }, [savedWorkflows]);

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
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VOICE_REPLY_MODE_STORAGE_KEY, voiceReplyMode);
    } catch {
      setStatusMessage("JARVIS could not persist the voice reply mode locally.");
    }
  }, [voiceReplyMode]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PEOPLE_MEMORY_STORAGE_KEY);
      if (saved) {
        setPeopleMemory(JSON.parse(saved) as PersonMemoryRecord[]);
      }
    } catch {
      setPeopleMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PEOPLE_MEMORY_STORAGE_KEY, JSON.stringify(peopleMemory));
    } catch {
      setStatusMessage("JARVIS could not persist people memory locally.");
    }
  }, [peopleMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TRAVEL_MEMORY_STORAGE_KEY);
      if (saved) {
        setTravelMemory(JSON.parse(saved) as TravelMemoryRecord[]);
      }
    } catch {
      setTravelMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(TRAVEL_MEMORY_STORAGE_KEY, JSON.stringify(travelMemory));
    } catch {
      setStatusMessage("JARVIS could not persist travel memory locally.");
    }
  }, [travelMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(EXPENSE_MEMORY_STORAGE_KEY);
      if (saved) {
        setExpenseMemory(JSON.parse(saved) as ExpenseMemoryRecord[]);
      }
    } catch {
      setExpenseMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(EXPENSE_MEMORY_STORAGE_KEY, JSON.stringify(expenseMemory));
    } catch {
      setStatusMessage("JARVIS could not persist expense memory locally.");
    }
  }, [expenseMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PACKAGE_MEMORY_STORAGE_KEY);
      if (saved) {
        setPackageMemory(JSON.parse(saved) as PackageMemoryRecord[]);
      }
    } catch {
      setPackageMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PACKAGE_MEMORY_STORAGE_KEY, JSON.stringify(packageMemory));
    } catch {
      setStatusMessage("JARVIS could not persist package memory locally.");
    }
  }, [packageMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MEETING_PREP_MEMORY_STORAGE_KEY);
      if (saved) {
        setMeetingPrepMemory(JSON.parse(saved) as MeetingPrepMemoryRecord[]);
      }
    } catch {
      setMeetingPrepMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MEETING_PREP_MEMORY_STORAGE_KEY,
        JSON.stringify(meetingPrepMemory),
      );
    } catch {
      setStatusMessage("JARVIS could not persist meeting prep memory locally.");
    }
  }, [meetingPrepMemory]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SCHOOL_PLAN_MEMORY_STORAGE_KEY);
      if (saved) {
        setSchoolPlanMemory(JSON.parse(saved) as SchoolPlanMemoryRecord[]);
      }
    } catch {
      setSchoolPlanMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SCHOOL_PLAN_MEMORY_STORAGE_KEY,
        JSON.stringify(schoolPlanMemory),
      );
    } catch {
      setStatusMessage("JARVIS could not persist school plan memory locally.");
    }
  }, [schoolPlanMemory]);

  function appendConversationTurn(role: "user" | "jarvis", text: string) {
    setConversationTurns((current) => [
      ...current.slice(-7),
      {
        id: Date.now() + current.length,
        role,
        text,
      },
    ]);
  }

  function rememberPersonBirthday(
    candidate: Omit<PersonMemoryRecord, "id" | "createdAt" | "updatedAt">,
  ) {
    const nowIso = new Date().toISOString();
    let savedRecord: PersonMemoryRecord | null = null;

    setPeopleMemory((current) => {
      const existing = current.find(
        (entry) => entry.name.trim().toLowerCase() === candidate.name.trim().toLowerCase(),
      );

      if (existing) {
        savedRecord = {
          ...existing,
          birthdayLabel: candidate.birthdayLabel,
          month: candidate.month,
          day: candidate.day,
          source: candidate.source,
          updatedAt: nowIso,
        };
        return [
          savedRecord,
          ...current.filter((entry) => entry.id !== existing.id),
        ];
      }

      savedRecord = {
        id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: candidate.name.trim(),
        birthdayLabel: candidate.birthdayLabel,
        month: candidate.month,
        day: candidate.day,
        source: candidate.source,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      return [savedRecord, ...current];
    });

    return savedRecord;
  }

  function rememberTravelSummary(title: string, sourceEmailSubject: string, summary: string) {
    const record: TravelMemoryRecord = {
      id: `travel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      sourceEmailSubject,
      summary,
      createdAt: new Date().toISOString(),
    };

    setTravelMemory((current) => [record, ...current].slice(0, 12));
    return record;
  }

  function rememberExpenseSummary(
    title: string,
    sourceEmailSubject: string,
    merchant: string | null,
    amount: string | null,
    summary: string,
  ) {
    const record: ExpenseMemoryRecord = {
      id: `expense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      sourceEmailSubject,
      merchant,
      amount,
      summary,
      createdAt: new Date().toISOString(),
    };

    setExpenseMemory((current) => [record, ...current].slice(0, 20));
    return record;
  }

  function rememberPackageSummary(
    title: string,
    sourceEmailSubject: string,
    carrier: string | null,
    status: string | null,
    deliveryDate: string | null,
    summary: string,
  ) {
    const record: PackageMemoryRecord = {
      id: `package-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      sourceEmailSubject,
      carrier,
      status,
      deliveryDate,
      summary,
      createdAt: new Date().toISOString(),
    };

    setPackageMemory((current) => [record, ...current].slice(0, 20));
    return record;
  }

  function rememberMeetingPrepSummary(eventTitle: string, summaryTitle: string, summary: string) {
    const record: MeetingPrepMemoryRecord = {
      id: `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventTitle,
      summaryTitle,
      summary,
      createdAt: new Date().toISOString(),
    };

    setMeetingPrepMemory((current) => [record, ...current].slice(0, 12));
    return record;
  }

  function rememberSchoolPlan(title: string, summary: string) {
    const record: SchoolPlanMemoryRecord = {
      id: `school-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      summary,
      createdAt: new Date().toISOString(),
    };

    setSchoolPlanMemory((current) => [record, ...current].slice(0, 12));
    return record;
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

  function shouldKeepFollowUpWindowOpen(intent: CommandIntent) {
    return intent.kind !== "sleep_mode" && intent.kind !== "shutdown_app";
  }

  function closeFollowUpWindow() {
    clearFollowUpTimeout();
    setFollowUpWindow(null);
  }

  function openFollowUpWindow(reason: FollowUpWindow["reason"]) {
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

  async function loadMemoryView() {
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
  }

  async function loadProposalSteps(proposalId: number) {
    try {
      const steps = await getProposalSteps(proposalId);
      setProposalSteps((current) => ({ ...current, [proposalId]: steps }));
    } catch {
      setCommandResult({
        title: "Could not load proposal steps",
        detail: "JARVIS could not fetch the draft steps for that proposal.",
      });
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

  async function loadBrowserAliases() {
    try {
      const aliases = await getBrowserAliases();
      setBrowserAliases(aliases);
    } catch {
      setStatusMessage("Browser alias memory could not be loaded.");
    }
  }

  async function loadLearnedIntents() {
    try {
      const mappings = await getLearnedIntents();
      setLearnedIntentMappings(mappings);
    } catch {
      setStatusMessage("Personal language memory could not be loaded.");
    }
  }

  async function rememberSuccessfulPhrase(phrase: string, intent: CommandIntent) {
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
  }

  function getWorkflowCounts() {
    try {
      const raw = window.localStorage.getItem(WORKFLOW_COUNTS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  }

  function setWorkflowCounts(counts: Record<string, number>) {
    try {
      window.localStorage.setItem(WORKFLOW_COUNTS_STORAGE_KEY, JSON.stringify(counts));
    } catch {
      setStatusMessage("JARVIS could not persist workflow-learning counts.");
    }
  }

  function getDismissedWorkflowSignatures() {
    try {
      const raw = window.localStorage.getItem(DISMISSED_WORKFLOWS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  function setDismissedWorkflowSignatures(signatures: string[]) {
    try {
      window.localStorage.setItem(
        DISMISSED_WORKFLOWS_STORAGE_KEY,
        JSON.stringify(signatures),
      );
    } catch {
      setStatusMessage("JARVIS could not persist dismissed workflow suggestions.");
    }
  }

  function rememberWorkflowSequence(steps: string[], sampleCommand: string) {
    const signature = buildWorkflowSignature(steps);
    const savedTriggerSet = new Set(
      savedWorkflows.map((workflow) => normalizeControlCommand(workflow.triggerPhrase)),
    );
    if (savedTriggerSet.has(normalizeControlCommand(sampleCommand))) {
      return;
    }

    const dismissed = getDismissedWorkflowSignatures();
    if (dismissed.includes(signature)) {
      return;
    }

    if (savedWorkflows.some((workflow) => buildWorkflowSignature(workflow.steps) === signature)) {
      return;
    }

    const counts = getWorkflowCounts();
    const nextCount = (counts[signature] ?? 0) + 1;
    counts[signature] = nextCount;
    setWorkflowCounts(counts);

    if (nextCount < 2) {
      return;
    }

    const name = generateWorkflowName(steps);
    const triggerPhrase = generateWorkflowTriggerPhrase(name);
    setWorkflowSuggestion({
      signature,
      name,
      triggerPhrase,
      steps,
      basedOnCount: nextCount,
      sampleCommand,
    });
    setCommandResult({
      title: "Workflow learned from repetition",
      detail: `You've repeated this ${nextCount} times. I can save it as "${name}" and run it later with "${triggerPhrase}".`,
    });
    appendConversationTurn(
      "jarvis",
      `You've repeated that workflow a few times. I can save it as ${name} and run it later if you want.`,
    );
  }

  function handleApproveWorkflowSuggestion() {
    if (!workflowSuggestion) {
      return;
    }

    const workflow: SavedWorkflowRecord = {
      id: `${Date.now()}`,
      name: workflowSuggestion.name,
      triggerPhrase: workflowSuggestion.triggerPhrase,
      steps: workflowSuggestion.steps,
      createdAt: new Date().toISOString(),
      basedOnCount: workflowSuggestion.basedOnCount,
    };
    setSavedWorkflows((current) => [workflow, ...current].slice(0, 12));
    setWorkflowSuggestion(null);
    setCommandResult({
      title: "Workflow saved",
      detail: `Saved "${workflow.name}". You can now say "${workflow.triggerPhrase}".`,
    });
    appendConversationTurn(
      "jarvis",
      `Saved that workflow. You can now say ${workflow.triggerPhrase}.`,
    );
    speakIfEnabled(`Saved that workflow. You can now say ${workflow.triggerPhrase}.`);
  }

  function handleDismissWorkflowSuggestion() {
    if (!workflowSuggestion) {
      return;
    }

    const dismissed = getDismissedWorkflowSignatures();
    setDismissedWorkflowSignatures([...dismissed, workflowSuggestion.signature]);
    setWorkflowSuggestion(null);
    setCommandResult({
      title: "Workflow suggestion dismissed",
      detail: "Okay. I won't suggest saving that repeated workflow right now.",
    });
    appendConversationTurn(
      "jarvis",
      "Okay. I won't suggest saving that workflow right now.",
    );
    speakIfEnabled("Okay. I won't suggest saving that workflow right now.");
  }

  function handleWorkflowFieldChange(
    workflowId: string,
    field: "name" | "triggerPhrase",
    value: string,
  ) {
    setSavedWorkflows((current) =>
      current.map((workflow) =>
        workflow.id === workflowId ? { ...workflow, [field]: value } : workflow,
      ),
    );
  }

  function handleWorkflowStepChange(workflowId: string, stepIndex: number, value: string) {
    setSavedWorkflows((current) =>
      current.map((workflow) =>
        workflow.id === workflowId
          ? {
              ...workflow,
              steps: workflow.steps.map((step, index) => (index === stepIndex ? value : step)),
            }
          : workflow,
      ),
    );
  }

  function handleSaveWorkflowEdits(workflowId: string) {
    const workflow = savedWorkflows.find((entry) => entry.id === workflowId);
    if (!workflow) {
      return;
    }

    const cleanedName = workflow.name.trim();
    const cleanedTrigger = workflow.triggerPhrase.trim();
    const cleanedSteps = workflow.steps.map((step) => step.trim()).filter(Boolean);

    if (!cleanedName || !cleanedTrigger || cleanedSteps.length === 0) {
      setCommandResult({
        title: "Workflow edit incomplete",
        detail: "A saved workflow needs a name, a trigger phrase, and at least one step.",
      });
      speakIfEnabled("That workflow still needs a name, trigger, and at least one step.");
      return;
    }

    const normalizedTrigger = normalizeControlCommand(cleanedTrigger);
    const duplicate = savedWorkflows.find(
      (entry) =>
        entry.id !== workflowId &&
        normalizeControlCommand(entry.triggerPhrase) === normalizedTrigger,
    );
    if (duplicate) {
      setCommandResult({
        title: "Workflow trigger already used",
        detail: `The trigger phrase "${cleanedTrigger}" is already used by ${duplicate.name}.`,
      });
      speakIfEnabled("That workflow trigger is already being used.");
      return;
    }

    setSavedWorkflows((current) =>
      current.map((entry) =>
        entry.id === workflowId
          ? {
              ...entry,
              name: cleanedName,
              triggerPhrase: cleanedTrigger,
              steps: cleanedSteps,
            }
          : entry,
      ),
    );
    setEditingWorkflowId(null);
    setCommandResult({
      title: "Workflow updated",
      detail: `Saved edits to ${cleanedName}. You can trigger it with "${cleanedTrigger}".`,
    });
    appendConversationTurn(
      "jarvis",
      `Updated the workflow ${cleanedName}. You can trigger it with ${cleanedTrigger}.`,
    );
    speakIfEnabled(`Updated the workflow ${cleanedName}.`);
  }

  function handleAddWorkflowTemplate(template: WorkflowTemplateRecord) {
    const normalizedTrigger = normalizeControlCommand(template.triggerPhrase);
    const duplicate = savedWorkflows.find(
      (workflow) =>
        normalizeControlCommand(workflow.triggerPhrase) === normalizedTrigger ||
        workflow.name.trim().toLowerCase() === template.name.trim().toLowerCase(),
    );

    if (duplicate) {
      setCommandResult({
        title: "Template already added",
        detail: `A saved workflow named ${duplicate.name} is already using that trigger or template shape.`,
      });
      speakIfEnabled("That workflow template is already in your library.");
      return;
    }

    const workflow: SavedWorkflowRecord = {
      id: `${Date.now()}-${template.id}`,
      name: template.name,
      triggerPhrase: template.triggerPhrase,
      steps: template.steps,
      createdAt: new Date().toISOString(),
      basedOnCount: 1,
    };
    setSavedWorkflows((current) => [workflow, ...current].slice(0, 20));
    setCommandResult({
      title: "Workflow template added",
      detail: `Added ${template.name}. You can trigger it with "${template.triggerPhrase}".`,
    });
    appendConversationTurn(
      "jarvis",
      `Added the workflow template ${template.name}. You can trigger it with ${template.triggerPhrase}.`,
    );
    speakIfEnabled(`Added the workflow template ${template.name}.`);
  }

  function handleExportWorkflows() {
    const exportPayload = JSON.stringify(savedWorkflows, null, 2);
    setWorkflowImportText(exportPayload);
    setCommandResult({
      title: "Workflow export ready",
      detail: "Your saved workflows are now in the export box as JSON.",
    });
    appendConversationTurn(
      "jarvis",
      "I prepared your saved workflows for export in the JSON box.",
    );
    speakIfEnabled("I prepared your saved workflows for export.");
  }

  function handleImportWorkflows() {
    try {
      const parsed = JSON.parse(workflowImportText) as SavedWorkflowRecord[];
      if (!Array.isArray(parsed)) {
        throw new Error("Workflow import must be a JSON array.");
      }

      const sanitized = parsed
        .map((workflow, index) => ({
          id: workflow.id || `${Date.now()}-${index}`,
          name: workflow.name?.trim() || `Imported workflow ${index + 1}`,
          triggerPhrase: workflow.triggerPhrase?.trim() || `run imported workflow ${index + 1}`,
          steps: Array.isArray(workflow.steps)
            ? workflow.steps.map((step) => String(step).trim()).filter(Boolean)
            : [],
          createdAt: workflow.createdAt || new Date().toISOString(),
          basedOnCount:
            typeof workflow.basedOnCount === "number" && Number.isFinite(workflow.basedOnCount)
              ? workflow.basedOnCount
              : 1,
        }))
        .filter((workflow) => workflow.steps.length > 0);

      const deduped = new Map<string, SavedWorkflowRecord>();
      for (const workflow of sanitized) {
        deduped.set(normalizeControlCommand(workflow.triggerPhrase), workflow);
      }

      const importedWorkflows = Array.from(deduped.values());
      setSavedWorkflows(importedWorkflows.slice(0, 20));
      setEditingWorkflowId(null);
      setCommandResult({
        title: "Workflows imported",
        detail: `Imported ${importedWorkflows.length} saved workflow${importedWorkflows.length === 1 ? "" : "s"}.`,
      });
      appendConversationTurn(
        "jarvis",
        `Imported ${importedWorkflows.length} saved workflow${importedWorkflows.length === 1 ? "" : "s"}.`,
      );
      speakIfEnabled(
        `Imported ${importedWorkflows.length} saved workflow${importedWorkflows.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setCommandResult({
        title: "Workflow import failed",
        detail: getErrorDetail(error, "JARVIS could not read that workflow JSON."),
      });
      speakIfEnabled("I could not import that workflow JSON.");
    }
  }

  async function continuePendingWorkflowExecution(
    execution: PendingWorkflowExecution,
    providedValue: string,
  ) {
    const savedWorkflow = savedWorkflows.find((workflow) => workflow.id === execution.workflowId);
    if (!savedWorkflow) {
      setPendingWorkflowExecution(null);
      setCommandResult({
        title: "Workflow no longer available",
        detail: "That saved workflow could not be found anymore.",
      });
      return { status: "failed" as const };
    }

    const resumedInputText =
      execution.missingPlaceholder === "input" ? providedValue.trim() : execution.inputText;
    setPendingWorkflowExecution(null);

    for (let index = execution.currentStepIndex; index < execution.rawSteps.length; index += 1) {
      const resolvedStep = resolveWorkflowConditionalStep(
        execution.rawSteps[index],
        activeConversationContext,
        recentEmails,
        recentFiles,
        recentNotes,
        plannerTasks,
      );

      if (resolvedStep.action === "skip") {
        continue;
      }

      if (resolvedStep.action === "stop") {
        setCommandResult({
          title: "Workflow stopped by condition",
          detail: `Stopped ${savedWorkflow.name} because one of its conditions chose a stop branch.`,
        });
        appendConversationTurn("jarvis", `Stopped the workflow ${savedWorkflow.name}.`);
        speakIfEnabled(`Stopped the workflow ${savedWorkflow.name}.`);
        return { status: "completed" as const };
      }

      const renderedStep = renderWorkflowStep(
        resolvedStep.step,
        activeConversationContext,
        resumedInputText,
      );

      if (renderedStep.missingPlaceholder) {
        setPendingWorkflowExecution({
          ...execution,
          inputText: resumedInputText,
          currentStepIndex: index,
          missingPlaceholder: renderedStep.missingPlaceholder as PendingWorkflowExecution["missingPlaceholder"],
        });
        setCommandResult({
          title: "Workflow needs more context",
          detail:
            renderedStep.missingPlaceholder === "input"
              ? `The workflow "${savedWorkflow.name}" still needs extra text after its trigger phrase.`
              : `The workflow "${savedWorkflow.name}" still needs a matching current context for {{${renderedStep.missingPlaceholder}}}.`,
        });
        appendConversationTurn(
          "jarvis",
          renderedStep.missingPlaceholder === "input"
            ? `I still need the text you want to use for ${savedWorkflow.name}.`
            : `I still need the right current context before I can continue ${savedWorkflow.name}.`,
        );
        speakIfEnabled(
          renderedStep.missingPlaceholder === "input"
            ? `I still need the text you want to use for ${savedWorkflow.name}.`
            : `I still need the right current context before I can continue ${savedWorkflow.name}.`,
        );
        return { status: "clarification" as const };
      }

      const outcome = await runCommand(renderedStep.step, {
        appendUserTurn: false,
        allowChaining: false,
      });
      if (outcome.status !== "completed") {
        setStatusMessage(`Saved workflow ${savedWorkflow.name} paused before completion.`);
        return outcome;
      }
    }

    setCommandResult({
      title: "Workflow completed",
      detail: `Finished saved workflow "${savedWorkflow.name}".`,
    });
    appendConversationTurn("jarvis", `Finished the workflow ${savedWorkflow.name}.`);
    speakIfEnabled(`Finished the workflow ${savedWorkflow.name}.`);
    return { status: "completed" as const };
  }

  async function loadGoogleCalendarStatus() {
    try {
      const status = await getGoogleCalendarStatus();
      setGoogleCalendarStatus(status);
      setGoogleCalendarClientId(status.clientId ?? "");
      setGoogleCalendarApiKey(status.apiKey ?? "");
    } catch {
      setStatusMessage("Google Calendar status could not be loaded.");
    }
  }

  async function loadNotionStatus() {
    try {
      const status = await getNotionStatus();
      setNotionStatus(status);
      setNotionDatabaseId(status.databaseId ?? "");
    } catch {
      setStatusMessage("Notion status could not be loaded.");
    }
  }

  async function loadSpotifyStatus() {
    try {
      const status = await getSpotifyStatus();
      setSpotifyStatus(status);
      setSpotifyClientId(status.clientId ?? "");
    } catch {
      setStatusMessage("Spotify status could not be loaded.");
    }
  }

  async function loadRecentNotes() {
    try {
      const notes = await listNotionNotes();
      setRecentNotes(notes);
      setPlannerTasks(notes.map(parseTaskNoteRecord).filter(Boolean) as PlannerTaskRecord[]);
    } catch {
      setRecentNotes([]);
      setPlannerTasks([]);
    }
  }

  async function loadPlannerTaskRecords() {
    const taskNotes = await searchNotionNotes("Task:");
    const parsedTasks = taskNotes
      .map(parseTaskNoteRecord)
      .filter(Boolean) as PlannerTaskRecord[];
    setPlannerTasks(parsedTasks);
    setRecentNotes(taskNotes);
    return parsedTasks;
  }

  async function loadRecentFiles() {
    try {
      const files = await listRecentLocalFiles();
      setRecentFiles(files);
    } catch {
      setRecentFiles([]);
    }
  }

  async function loadOllamaStatus() {
    try {
      const status = await getOllamaStatus();
      setOllamaStatus(status);
      setOllamaBaseUrl(status.baseUrl ?? "http://127.0.0.1:11434");
      setOllamaModelName(status.modelName ?? "");
    } catch {
      setStatusMessage("Ollama status could not be loaded.");
    }
  }

  async function loadExecutorStatus() {
    try {
      const status = await getExecutorStatus();
      setExecutorStatus(status);
      setExecutorCommandPath(status.commandPath ?? "");
      setExecutorWorkingDirectory(status.workingDirectory ?? "");
    } catch {
      setStatusMessage("Executor bridge status could not be loaded.");
    }
  }

  async function handleGenerateProposal() {
    setIsGeneratingProposal(true);

    try {
      const generatedProposal = await generateLearningProposal();
      if (generatedProposal) {
        setCommandResult({
          title: "Draft proposal created",
          detail:
            "JARVIS observed repeated study behavior and drafted a routine for your review.",
        });
        speakIfEnabled("I drafted a new study routine for your review.");
      } else {
        setCommandResult({
          title: "Not enough history yet",
          detail:
            "Run the study setup a few times first so JARVIS has enough evidence to draft a suggestion.",
        });
        speakIfEnabled("I need a little more history before I can draft a routine.");
      }

      await loadMemoryView();
    } catch {
      setCommandResult({
        title: "Proposal generation failed",
        detail: "JARVIS could not create a learning proposal from the current history.",
      });
      speakIfEnabled("I could not generate a learning proposal right now.");
    } finally {
      setIsGeneratingProposal(false);
    }
  }

  async function handleProposalDecision(
    proposalId: number,
    decision: "approve" | "reject",
  ) {
    try {
      if (decision === "approve") {
        await approveLearningProposal(proposalId);
        speakIfEnabled("Proposal approved. The routine is now live.");
      } else {
        await rejectLearningProposal(proposalId);
        speakIfEnabled("Proposal rejected. I will keep learning from future activity.");
      }

      await loadMemoryView();
    } catch {
      setCommandResult({
        title: "Review action failed",
        detail: "JARVIS could not update that proposal status.",
      });
      speakIfEnabled("I could not update that proposal.");
    }
  }

  function handleProposalFieldChange(
    proposalId: number,
    field: "name" | "description" | "triggerPhrase",
    value: string,
  ) {
    setProposals((current) =>
      current.map((proposal) =>
        proposal.id === proposalId ? { ...proposal, [field]: value } : proposal,
      ),
    );
  }

  function handleProposalStepChange(
    proposalId: number,
    stepId: number,
    value: string,
  ) {
    setProposalSteps((current) => ({
      ...current,
      [proposalId]: (current[proposalId] ?? []).map((step) =>
        step.id === stepId ? { ...step, actionValue: value } : step,
      ),
    }));
  }

  async function handleSaveProposalEdits(proposalId: number) {
    const proposal = proposals.find((entry) => entry.id === proposalId);
    const steps = proposalSteps[proposalId];

    if (!proposal || !steps) {
      return;
    }

    try {
      await updateLearningProposal({
        id: proposal.id,
        name: proposal.name,
        description: proposal.description,
        triggerPhrase: proposal.triggerPhrase,
        steps,
      });
      setEditingProposalId(null);
      await loadMemoryView();
      await loadProposalSteps(proposalId);
      speakIfEnabled("Draft updated.");
    } catch {
      setCommandResult({
        title: "Could not save proposal edits",
        detail: "JARVIS could not update that draft proposal.",
      });
      speakIfEnabled("I could not save those proposal edits.");
    }
  }

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

  async function handleSaveVoiceCorrection() {
    const heardPhrase = voiceTranscript.trim();
    const correctedPhrase = voiceCorrectionInput.trim();

    if (!heardPhrase || !correctedPhrase) {
      setCommandResult({
        title: "Correction incomplete",
        detail: "Record a voice transcript and enter the corrected version before saving.",
      });
      return;
    }

    try {
      await saveVoiceCorrectionEntry(heardPhrase, correctedPhrase);
      await loadVoiceCorrections();
      setVoiceTranscript(correctedPhrase);
      setInput(correctedPhrase);
      setVoiceCorrectionInput("");
      setCommandResult({
        title: "Voice correction saved",
        detail: `JARVIS will now map "${heardPhrase}" to "${correctedPhrase}".`,
      });
      speakIfEnabled("Voice correction saved.");
    } catch {
      setCommandResult({
        title: "Could not save voice correction",
        detail: "JARVIS could not store that correction yet.",
      });
      speakIfEnabled("I could not save that voice correction.");
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

  async function handleSaveOllamaConfig() {
    try {
      const status = await saveOllamaStatus(ollamaBaseUrl, ollamaModelName);
      setOllamaStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Ollama config saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save Ollama config",
        detail: "JARVIS could not update the Ollama conversation settings.",
      });
    }
  }

  async function handleSaveGoogleCalendarConfig() {
    try {
      const status = await saveGoogleCalendarStatus(
        googleCalendarClientId,
        googleCalendarApiKey,
      );
      setGoogleCalendarStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Google Calendar config saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save Google Calendar config",
        detail: "JARVIS could not update the Google Calendar API settings.",
      });
    }
  }

  async function handleConnectGoogleCalendar() {
    if (!googleCalendarStatus?.configured || !googleCalendarClientId.trim()) {
      setCommandResult({
        title: "Google Calendar not configured",
        detail: "Save your Google Calendar client ID and API key first.",
      });
      return;
    }

    try {
      setStatusMessage("Opening Google Calendar sign-in...");
      setCommandResult({
        title: "Google Calendar sign-in",
        detail: "JARVIS is redirecting this app through Google sign-in and will return here after consent.",
      });
      beginGoogleRedirectAuthorization(
        googleCalendarClientId.trim(),
        "calendar",
        "https://www.googleapis.com/auth/calendar.events.owned",
      );
    } catch (error) {
      setCommandResult({
        title: "Google Calendar connection failed",
        detail: getErrorDetail(
          error,
          "JARVIS could not connect to Google Calendar right now.",
        ),
      });
    }
  }

  async function handleConnectGmail() {
    if (!googleCalendarStatus?.configured || !googleCalendarClientId.trim()) {
      setCommandResult({
        title: "Google account not configured",
        detail: "Save your Google client ID and API key first, then connect Gmail.",
      });
      return;
    }

    try {
      setStatusMessage("Opening Gmail sign-in...");
      setCommandResult({
        title: "Gmail sign-in",
        detail: "JARVIS is redirecting this app through Google sign-in and will return here after consent.",
      });
      requestGmailAccessToken(googleCalendarClientId.trim());
    } catch (error) {
      const detail = getErrorDetail(
        error,
        "JARVIS could not connect to Gmail right now.",
      );
      setCommandResult({
        title: "Gmail connection failed",
        detail,
      });
    }
  }

  async function handleSaveNotionConfig() {
    try {
      const status = await saveNotionStatus(notionTokenInput, notionDatabaseId);
      setNotionStatus(status);
      setNotionTokenInput("");
      setStatusMessage(status.message);
      setCommandResult({
        title: "Notion config saved",
        detail: status.hasToken
          ? `The Notion token is saved locally and hidden from the input for safety. ${status.message}`
          : status.message,
      });
      await loadRecentNotes();
    } catch {
      setCommandResult({
        title: "Could not save Notion config",
        detail: "JARVIS could not update the Notion notes settings.",
      });
    }
  }

  async function handleSaveSpotifyConfig() {
    try {
      const status = await saveSpotifyStatus(spotifyClientId);
      setSpotifyStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Spotify config saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save Spotify config",
        detail: "JARVIS could not update the Spotify app settings.",
      });
    }
  }

  async function handleConnectSpotify() {
    if (!spotifyStatus?.configured || !spotifyClientId.trim()) {
      setCommandResult({
        title: "Spotify not configured",
        detail: "Save your Spotify client ID first.",
      });
      return;
    }

    await beginSpotifyAuthorization(spotifyClientId.trim());
  }

  async function refreshSpotifyPlayback(accessToken: string) {
    const playback = await getSpotifyPlaybackState(accessToken);
    setSpotifyPlaybackState(playback);
    return playback;
  }

  async function handleSaveExecutorConfig() {
    try {
      const status = await saveExecutorStatus(
        executorCommandPath,
        executorWorkingDirectory,
      );
      setExecutorStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Executor bridge saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save executor bridge",
        detail: "JARVIS could not update the local coding executor settings.",
      });
    }
  }

  async function handleAskAdvancedAssistant(requestOverride?: string) {
    const requestToPlan = requestOverride ?? missingSkillRequest;
    if (!requestToPlan) {
      return;
    }

    setIsGeneratingMissingSkillPlan(true);
    setAutonomousBuildStatus("planning");

    try {
      const plan = await generateMissingSkillPlanWithOllama(
        requestToPlan,
        assistantName,
      );
      setMissingSkillPlan(plan);
      setCommandResult({
        title: "Advanced assistant drafted a plan",
        detail: `JARVIS asked the advanced assistant for help with "${requestToPlan}". Review the suggested skill plan below before doing anything else.`,
      });
      appendConversationTurn(
        "jarvis",
        `I asked the advanced assistant for help. It suggested a skill called ${plan.skillName}.`,
      );
      speakIfEnabled(`I drafted a plan for a new skill called ${plan.skillName}.`);

      if (skillAutopilotAvailable && autonomousSkillBuildingEnabled) {
        const nextImplementationRequest = createImplementationRequest(plan, requestToPlan);
        const nextBuildRequest = createBuildRequest(nextImplementationRequest);
        setImplementationRequest(nextImplementationRequest);
        setBuildRequest(nextBuildRequest);
        setAutonomousBuildStatus("build_request_ready");
        await handleCreateHandoffArtifact(nextBuildRequest);
      }
    } catch (error) {
      const detail = getErrorDetail(
        error,
        "JARVIS could not get a missing-skill plan from the advanced assistant right now.",
      );
      setAutonomousBuildStatus("manual_required");
      setCommandResult({
        title: "Advanced assistant unavailable",
        detail,
      });
      appendConversationTurn(
        "jarvis",
        `I tried to ask the advanced assistant for a missing-skill plan, but it failed: ${detail}`,
      );
      speakIfEnabled("I could not get the advanced assistant plan right now.");
    } finally {
      setIsGeneratingMissingSkillPlan(false);
    }
  }

  function createImplementationRequest(
    plan: MissingSkillPlan,
    originalRequest: string,
  ): SkillImplementationRequest {
    return {
      skillName: plan.skillName,
      originalRequest,
      summary: plan.summary,
      userValue: plan.userValue,
      buildSteps: plan.buildSteps,
      permissionsNeeded: plan.permissionsNeeded,
      approvedAt: new Date().toISOString(),
    };
  }

  function createBuildRequest(
    nextImplementationRequest: SkillImplementationRequest,
  ): SkillBuildRequest {
    return {
      skillName: nextImplementationRequest.skillName,
      title: `Implement ${nextImplementationRequest.skillName} for JARVIS`,
      prompt: [
        `Implement a new JARVIS skill named "${nextImplementationRequest.skillName}".`,
        `Original user request: ${nextImplementationRequest.originalRequest}`,
        `Goal: ${nextImplementationRequest.summary}`,
        `User value: ${nextImplementationRequest.userValue}`,
        "Required build steps:",
        ...nextImplementationRequest.buildSteps.map((step, index) => `${index + 1}. ${step}`),
        nextImplementationRequest.permissionsNeeded.length > 0
          ? `Permissions to review: ${nextImplementationRequest.permissionsNeeded.join(", ")}`
          : "Permissions to review: none listed yet.",
        "Keep the implementation aligned with JARVIS's existing memory, permission, conversation, and skill architecture.",
      ].join("\n"),
      safetyChecks: [
        "Do not auto-execute risky actions without user approval.",
        "Preserve local-first behavior where practical.",
        "Keep new actions behind the existing JARVIS planner and permission flow.",
      ],
      createdAt: new Date().toISOString(),
    };
  }

  function handleApproveSkillPlan() {
    if (!missingSkillPlan || !missingSkillRequest) {
      return;
    }

    const nextImplementationRequest = createImplementationRequest(
      missingSkillPlan,
      missingSkillRequest,
    );

    setImplementationRequest(nextImplementationRequest);
    setBuildRequest(null);
    setAutonomousBuildStatus("implementation_brief_ready");
    setCommandResult({
      title: "Skill plan approved for implementation",
      detail:
        "JARVIS converted the approved skill plan into a structured implementation brief. Review it below before building anything.",
    });
    appendConversationTurn(
      "jarvis",
      `I turned the approved ${missingSkillPlan.skillName} plan into an implementation brief.`,
    );
    speakIfEnabled(`I turned the ${missingSkillPlan.skillName} plan into an implementation brief.`);
  }

  function handleGenerateBuildRequest() {
    if (!implementationRequest) {
      return;
    }

    const nextBuildRequest = createBuildRequest(implementationRequest);

    setBuildRequest(nextBuildRequest);
    setAutonomousBuildStatus("build_request_ready");
    setCommandResult({
      title: "Build request created",
      detail:
        "JARVIS turned the implementation brief into a concrete coding-agent handoff request.",
    });
    appendConversationTurn(
      "jarvis",
      `I created a build request for ${implementationRequest.skillName}.`,
    );
    speakIfEnabled(`I created a build request for ${implementationRequest.skillName}.`);
  }

  async function handleCreateHandoffArtifact(request: SkillBuildRequest) {
    try {
      const artifact = await createBuildHandoffArtifact(request);
      setHandoffArtifact(artifact);
      setAutonomousBuildStatus("handoff_ready");
      setCommandResult({
        title: "Coding handoff package created",
        detail: artifact.message,
      });
      appendConversationTurn(
        "jarvis",
        `I created a coding handoff package for ${request.skillName}. Manual execution is the next boundary.`,
      );
      speakIfEnabled(
        `I created a coding handoff package for ${request.skillName}. Manual execution is the next boundary.`,
      );

      if (executorStatus?.configured && executorStatus.available) {
        try {
          const launchMessage = await launchExecutorHandoff(
            artifact.jsonPath,
            artifact.markdownPath,
          );
          setCommandResult({
            title: "Executor bridge launched",
            detail: launchMessage,
          });
          appendConversationTurn(
            "jarvis",
            "I handed the package to the local coding executor.",
          );
          speakIfEnabled("I handed the package to the local coding executor.");
        } catch {
          setAutonomousBuildStatus("manual_required");
          setCommandResult({
            title: "Executor bridge needs manual help",
            detail:
              "JARVIS created the handoff package, but the local coding executor did not launch successfully.",
          });
        }
      }
    } catch {
      setAutonomousBuildStatus("manual_required");
      setCommandResult({
        title: "Could not create coding handoff package",
        detail:
          "JARVIS prepared the build request, but it could not save the handoff files automatically.",
      });
      appendConversationTurn(
        "jarvis",
        "I prepared the build request, but I could not save the handoff files automatically.",
      );
      speakIfEnabled("I prepared the build request, but I could not save the handoff files.");
    }
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

  async function handleSaveBrowserAlias() {
    const phrase = input
      .replace(/^open\s+/i, "")
      .replace(/^search\s+/i, "")
      .trim();
    const rawUrl = browserAliasUrl.trim();

    if (!phrase || !rawUrl) {
      setCommandResult({
        title: "Alias incomplete",
        detail: "Enter the corrected URL and keep the command text in the input before saving.",
      });
      return;
    }

    const url = canonicalizeBrowserUrl(rawUrl);

    try {
      await saveBrowserAliasEntry(phrase, url);
      await loadBrowserAliases();
      setBrowserAliasUrl("");
      setCommandResult({
        title: "Browser alias saved",
        detail: `JARVIS will now map "${phrase}" to "${url}".`,
      });
      speakIfEnabled("Browser alias saved.");
    } catch {
      setCommandResult({
        title: "Could not save browser alias",
        detail: "JARVIS could not store that browser correction yet.",
      });
    }
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
              void runCommand(cleanConversationalCommand(transcript));
              return;
            }

            if (wakeCommand) {
              wakeTriggeredRef.current = true;
              setVoiceTranscript(transcript.trim());
              stopWakeListener();
              void runCommand(wakeCommand);
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

  function beginSelectedVoiceCapture() {
    if (voiceBackend === "local") {
      void handleLocalVoiceToggle();
      return;
    }

    startBrowserVoiceRecognition();
  }

  function handleVoiceStart() {
    beginSelectedVoiceCapture();
  }

  useEffect(() => {
    void loadMemoryView();
    void loadVoiceCorrections();
    void loadLocalVoiceStatus();
    void loadLocalSpeechStatus();
    void loadWakeModeStatus();
    void loadBrowserAliases();
    void loadLearnedIntents();
    void loadGoogleCalendarStatus();
    void loadSpotifyStatus();
    void loadNotionStatus();
    void loadRecentNotes();
    void loadRecentFiles();
    void loadOllamaStatus();
    void loadExecutorStatus();
  }, []);

  useEffect(() => {
    const storedCalendarToken = getStoredGoogleAccessToken("calendar");
    const storedGmailToken = getStoredGoogleAccessToken("gmail");
    if (storedCalendarToken) {
      setGoogleCalendarAccessToken(storedCalendarToken);
    }
    if (storedGmailToken) {
      setGmailAccessToken(storedGmailToken);
    }
  }, []);

  useEffect(() => {
    try {
      const authResult = completeGoogleRedirectAuthorizationIfNeeded();
      if (!authResult) {
        return;
      }

      if (authResult.service === "calendar") {
        setGoogleCalendarAccessToken(authResult.accessToken);
        setStatusMessage("Google Calendar is connected for this session.");
        setCommandResult({
          title: "Google Calendar connected",
          detail: "JARVIS can now create events directly through the Calendar API.",
        });
      } else {
        setGmailAccessToken(authResult.accessToken);
        setStatusMessage("Gmail is connected for this session.");
        setCommandResult({
          title: "Gmail connected",
          detail: "JARVIS can now read unread messages and search your inbox.",
        });
        void listUnreadGmailMessages(authResult.accessToken)
          .then((messages) => setRecentEmails(messages))
          .catch(() => setRecentEmails([]));
      }
    } catch (error) {
      setCommandResult({
        title: "Google sign-in failed",
        detail: getErrorDetail(error, "Google sign-in could not be completed."),
      });
    }
  }, []);

  useEffect(() => {
    const storedToken = getStoredSpotifyAccessToken();
    if (storedToken) {
      setSpotifyAccessToken(storedToken);
      void refreshSpotifyPlayback(storedToken).catch(() => {
        setSpotifyPlaybackState(null);
      });
    }
  }, []);

  useEffect(() => {
    if (!spotifyClientId.trim()) {
      return;
    }

    void completeSpotifyAuthorizationIfNeeded(spotifyClientId.trim())
      .then((token) => {
        if (!token) {
          return;
        }

        setSpotifyAccessToken(token);
        setStatusMessage("Spotify is connected for this session.");
        setCommandResult({
          title: "Spotify connected",
          detail: "JARVIS can now control playback through the Spotify Web API.",
        });
        return refreshSpotifyPlayback(token);
      })
      .catch((error) => {
        setSpotifyAccessToken(null);
        setSpotifyPlaybackState(null);
        setCommandResult({
          title: "Spotify connection failed",
          detail: getErrorDetail(
            error,
            "JARVIS could not complete the Spotify sign-in flow right now.",
          ),
        });
      });
  }, [spotifyClientId]);

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
  }, [wakeModeEnabled, voiceBackend, assistantName]);

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

  async function pingCore() {
    try {
      const response = await pingJarvis();
      setStatusMessage(response);
    } catch {
      setStatusMessage(
        "Tauri command bridge not connected yet. Install the toolchain to activate native actions.",
      );
    }
  }

  async function routeCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runCommand(input.trim());
  }

  async function routeCommandFromVoice(transcript: string) {
    await runCommand(transcript.trim());
  }

  function triggerVoiceAutoRoute(transcript: string) {
    const normalizedTranscript = transcript.trim();
    if (!normalizedTranscript) {
      return;
    }

    lastAutoRoutedVoiceRef.current = normalizedTranscript;
    void routeCommandFromVoice(normalizedTranscript);
  }

  async function executeIntent(intent: CommandIntent) {
    setIsRoutingCommand(true);
    setVoiceSessionPhase("processing");
    setStatusMessage("Routing command through JARVIS.");
    let completed = false;

    try {
      if (intent.kind === "study_setup") {
        const response = await launchStudySetup();
        const reply = buildStudySetupReply();
        setCommandResult({
          title: "Study setup launched",
          detail: response,
        });
        setStatusMessage("Study routine completed through the native bridge.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "google_search") {
        const query = intent.query.trim();
        if (!query) {
          const prompt = "What do you want me to search for on Google?";
          setPendingClarification({
            prompt,
            choices: [],
          });
          setVoiceSessionPhase("ready");
          setCommandResult({
            title: "Need a search topic",
            detail: prompt,
          });
          appendConversationTurn("jarvis", buildClarificationReply(prompt));
          speakIfEnabled(buildClarificationReply(prompt));
          return;
        }

        const response = await searchGoogle(query);
        const reply = buildGoogleSearchReply(query);
        setActiveConversationContext(createActiveBrowserContext(buildGoogleSearchUrl(query)));
        setCommandResult({
          title: "Google search started",
          detail: `Started a Google search for ${query}.`,
        });
        setStatusMessage("Google search routed through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "open_url") {
        const browserTargetLabel = formatBrowserTargetLabel(intent.url);
        const reply = buildOpenSiteReply(browserTargetLabel);
        await openBrowserUrl(intent.url);
        setActiveConversationContext(createActiveBrowserContext(intent.url));
        setCommandResult({
          title: "Website opened",
          detail: `Opened ${browserTargetLabel}.`,
        });
        setStatusMessage("Browser action completed through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "remember_person_birthday") {
        rememberPersonBirthday({
          name: intent.name,
          birthdayLabel: intent.birthdayLabel,
          month: intent.month,
          day: intent.day,
          source: "manual",
        });
        const reply = buildBirthdaySavedReply(intent.name, intent.birthdayLabel);
        setCommandResult({
          title: "Birthday saved",
          detail: `${intent.name}'s birthday is now saved as ${intent.birthdayLabel}.`,
        });
        setStatusMessage("People memory updated through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_birthdays") {
        const sortedPeople = [...peopleMemory].sort((left, right) =>
          left.name.localeCompare(right.name),
        );
        const reply =
          sortedPeople.length > 0
            ? `I found ${sortedPeople.length} saved birthday${sortedPeople.length === 1 ? "" : "s"}.`
            : "You do not have any saved birthdays yet.";
        setCommandResult({
          title: "Saved birthdays",
          detail:
            sortedPeople.length > 0
              ? sortedPeople.map((person) => `${person.name} - ${person.birthdayLabel}`).join(" | ")
              : "No birthdays are saved yet.",
        });
        setStatusMessage("People memory loaded through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_upcoming_birthdays") {
        const sortedPeople = [...peopleMemory].sort(
          (left, right) =>
            getNextBirthdayDate(left).getTime() - getNextBirthdayDate(right).getTime(),
        );
        const reply =
          sortedPeople.length > 0
            ? `I sorted your upcoming birthdays for you.`
            : "You do not have any saved birthdays yet.";
        setCommandResult({
          title: "Upcoming birthdays",
          detail:
            sortedPeople.length > 0
              ? sortedPeople.slice(0, 8).map((person) => formatUpcomingBirthday(person)).join(" | ")
              : "No birthdays are saved yet.",
        });
        setStatusMessage("Upcoming birthdays checked through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "show_person_birthday") {
        const person = peopleMemory.find((entry) =>
          entry.name.toLowerCase().includes(intent.query.trim().toLowerCase()),
        );
        if (!person) {
          throw new Error(`I could not find a saved birthday for ${intent.query} yet.`);
        }

        const reply = buildBirthdayLookupReply(person.name, person.birthdayLabel);
        setCommandResult({
          title: "Birthday found",
          detail: `${person.name}'s birthday is saved as ${person.birthdayLabel}.`,
        });
        setStatusMessage("People memory lookup completed.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_travel_memory") {
        const reply =
          travelMemory.length > 0
            ? `I found ${travelMemory.length} saved travel item${travelMemory.length === 1 ? "" : "s"}.`
            : "You do not have any saved travel summaries yet.";
        setCommandResult({
          title: "Travel memory",
          detail:
            travelMemory.length > 0
              ? travelMemory
                  .map((item) => `${item.title} - from ${item.sourceEmailSubject}`)
                  .join(" | ")
              : "No travel summaries are saved yet.",
        });
        setStatusMessage("Travel memory loaded through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_expense_memory") {
        const reply =
          expenseMemory.length > 0
            ? `I found ${expenseMemory.length} saved expense item${expenseMemory.length === 1 ? "" : "s"}.`
            : "You do not have any saved expense summaries yet.";
        setCommandResult({
          title: "Expense memory",
          detail:
            expenseMemory.length > 0
              ? expenseMemory
                  .map((item) =>
                    `${item.title}${item.amount ? ` - ${item.amount}` : ""}${item.merchant ? ` (${item.merchant})` : ""}`,
                  )
                  .join(" | ")
              : "No expense summaries are saved yet.",
        });
        setStatusMessage("Expense memory loaded through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_package_memory") {
        const reply =
          packageMemory.length > 0
            ? `I found ${packageMemory.length} saved package item${packageMemory.length === 1 ? "" : "s"}.`
            : "You do not have any saved package summaries yet.";
        setCommandResult({
          title: "Package memory",
          detail:
            packageMemory.length > 0
              ? packageMemory
                  .map(
                    (item) =>
                      `${item.title}${item.status ? ` - ${item.status}` : ""}${
                        item.deliveryDate ? ` (${item.deliveryDate})` : ""
                      }`,
                  )
                  .join(" | ")
              : "No package summaries are saved yet.",
        });
        setStatusMessage("Package memory loaded through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_meeting_prep_memory") {
        const reply =
          meetingPrepMemory.length > 0
            ? `I found ${meetingPrepMemory.length} saved meeting prep item${meetingPrepMemory.length === 1 ? "" : "s"}.`
            : "You do not have any saved meeting prep summaries yet.";
        setCommandResult({
          title: "Meeting prep memory",
          detail:
            meetingPrepMemory.length > 0
              ? meetingPrepMemory
                  .map((item) => `${item.summaryTitle} - ${item.eventTitle}`)
                  .join(" | ")
              : "No meeting prep summaries are saved yet.",
        });
        setStatusMessage("Meeting prep memory loaded through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_school_memory") {
        const reply =
          schoolPlanMemory.length > 0
            ? `I found ${schoolPlanMemory.length} saved school plan${schoolPlanMemory.length === 1 ? "" : "s"}.`
            : "You do not have any saved school plans yet.";
        setCommandResult({
          title: "School memory",
          detail:
            schoolPlanMemory.length > 0
              ? schoolPlanMemory.map((item) => item.title).join(" | ")
              : "No school plans are saved yet.",
        });
        setStatusMessage("School memory loaded through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "create_school_plan" || intent.kind === "save_school_plan_to_notion") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const planContent = buildSchoolPlanContent(recentEmails, availableTasks, recentFiles);
        const reply = buildSchoolPlanReply();

        if (intent.kind === "save_school_plan_to_notion") {
          const note = await createNotionNote(planContent);
          rememberSchoolPlan(note.title, planContent);
          setCommandResult({
            title: "School plan saved",
            detail: `Saved your school mode plan to Notion as "${note.title}".`,
          });
          setStatusMessage("School mode plan saved to Notion through JARVIS.");
          setRecentNotes((current) => [note, ...current].slice(0, 5));
          appendConversationTurn("jarvis", buildSchoolPlanSavedReply(note.title));
          speakIfEnabled(buildSchoolPlanSavedReply(note.title));
        } else {
          rememberSchoolPlan("School Mode Plan", planContent);
          setCommandResult({
            title: "School mode plan ready",
            detail: planContent,
          });
          setStatusMessage("School mode plan generated through JARVIS.");
          appendConversationTurn("jarvis", reply);
          speakIfEnabled(reply);
        }

        setVoiceSessionPhase("ready");
      } else if (intent.kind === "create_note") {
        const note = await createNotionNote(intent.content.trim());
        const reply = buildCreateNoteReply(note.title);
        setActiveConversationContext(createActiveNoteContext(note));
        setCommandResult({
          title: "Notion note saved",
          detail: `Saved "${note.title}" to Notion.`,
        });
        setStatusMessage("Notion note created through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        setPresentedCollectionContext({
          kind: "notes",
          noteIds: [note.id, ...recentNotes.map((entry) => entry.id).filter((id) => id !== note.id)].slice(0, 5),
        });
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "create_task_note") {
        const note = await createNotionTask(
          intent.title,
          intent.dueLabel,
          getDueIsoFromLabel(intent.dueLabel),
        );
        const reply = buildCreateTaskReply(note.title);
        const createdTask = parseTaskNoteRecord(note);
        if (createdTask) {
          setActiveConversationContext(createActiveTaskContext(createdTask));
        }
        setCommandResult({
          title: "Task note saved",
          detail: intent.dueLabel
            ? `Saved a task note for ${intent.title} due ${intent.dueLabel}.`
            : `Saved a task note for ${intent.title}.`,
        });
        setStatusMessage("Task note created through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        await loadRecentNotes();
        if (createdTask) {
          setPresentedCollectionContext({
            kind: "tasks",
            noteIds: [createdTask.id],
          });
        }
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_notes") {
        const notes = await listNotionNotes();
        const detail =
          notes.length > 0
            ? notes.map((note) => note.title).join(" | ")
            : "I did not find any notes in Notion yet.";
        const reply = buildListNotesReply(notes.length);
        setCommandResult({
          title: "Recent Notion notes",
          detail,
        });
        setStatusMessage("Fetched recent Notion notes.");
        setVoiceSessionPhase("ready");
        setRecentNotes(notes);
        setPresentedCollectionContext({
          kind: "notes",
          noteIds: notes.map((note) => note.id),
        });
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "search_notes") {
        const query = intent.query.trim();
        const notes = await searchNotionNotes(query);
        const detail =
          notes.length > 0
            ? notes.map((note) => note.title).join(" | ")
            : `No Notion notes matched ${query}.`;
        const reply = buildSearchNotesReply(query, notes.length);
        setCommandResult({
          title: "Notion note search",
          detail,
        });
        setStatusMessage("Searched Notion notes through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentNotes(notes);
        setPresentedCollectionContext({
          kind: "notes",
          noteIds: notes.map((note) => note.id),
        });
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "read_current_note") {
        const note = resolveActiveNote(activeConversationContext, recentNotes);
        if (!note) {
          throw new Error("There is no active note in the conversation yet. Show, search, or save a note first.");
        }

        setActiveConversationContext(createActiveNoteContext(note));
        const reply = buildReadNoteReply(note.title);
        setCommandResult({
          title: `Note: ${note.title}`,
          detail: note.summary
            ? `${note.summary}\n\nOpen in Notion: ${note.url}`
            : `No summary is available for ${note.title} yet.\n\nOpen in Notion: ${note.url}`,
        });
        setStatusMessage("Active Notion note loaded through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "read_note_by_index") {
        const note = getNoteByIndex(recentNotes, intent.index);
        if (!note) {
          throw new Error(`Note ${intent.index} is not loaded right now. Show or search your notes first.`);
        }

        setActiveConversationContext(createActiveNoteContext(note));
        const reply = buildReadNoteReply(note.title);
        setCommandResult({
          title: `Note ${intent.index}`,
          detail: note.summary
            ? `${note.summary}\n\nOpen in Notion: ${note.url}`
            : `No summary is available for ${note.title} yet.\n\nOpen in Notion: ${note.url}`,
        });
        setStatusMessage(`Loaded note ${intent.index} through JARVIS.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "open_current_note") {
        const note = resolveActiveNote(activeConversationContext, recentNotes);
        if (!note) {
          throw new Error("There is no active note in the conversation yet. Show, search, or save a note first.");
        }

        setActiveConversationContext(createActiveNoteContext(note));
        await openBrowserUrl(note.url);
        const reply = buildOpenNoteReply(note.title);
        setCommandResult({
          title: "Notion note opened",
          detail: `Opened ${note.title} in Notion.`,
        });
        setStatusMessage("Active Notion note opened through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "open_note_by_index") {
        const note = getNoteByIndex(recentNotes, intent.index);
        if (!note) {
          throw new Error(`Note ${intent.index} is not loaded right now. Show or search your notes first.`);
        }

        setActiveConversationContext(createActiveNoteContext(note));
        await openBrowserUrl(note.url);
        const reply = buildOpenNoteReply(note.title);
        setCommandResult({
          title: "Notion note opened",
          detail: `Opened note ${intent.index} (${note.title}) in Notion.`,
        });
        setStatusMessage(`Opened note ${intent.index} through JARVIS.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_today_tasks") {
        const parsedTasks = await loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status === "today");
        const detail = formatPlannerTaskList(filtered, "No task notes due today were found.");
        const reply = buildTodayTasksReply(filtered.length);
        setCommandResult({
          title: "Today's task notes",
          detail,
        });
        setStatusMessage("Today's task notes loaded from Notion.");
        setVoiceSessionPhase("ready");
        setPlannerTasks(filtered);
        setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_upcoming_tasks") {
        const parsedTasks = await loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status === "upcoming");
        const detail = formatPlannerTaskList(filtered, "No upcoming task notes were found.");
        const reply = buildUpcomingTasksReply(filtered.length);
        setCommandResult({
          title: "Upcoming task notes",
          detail,
        });
        setStatusMessage("Upcoming task notes loaded from Notion.");
        setVoiceSessionPhase("ready");
        setPlannerTasks(filtered);
        setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_overdue_tasks") {
        const parsedTasks = await loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status === "overdue");
        const detail = formatPlannerTaskList(filtered, "No overdue task notes were found.");
        const reply = buildOverdueTasksReply(filtered.length);
        setCommandResult({
          title: "Overdue task notes",
          detail,
        });
        setStatusMessage("Overdue task notes loaded from Notion.");
        setVoiceSessionPhase("ready");
        setPlannerTasks(filtered);
        setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_done_tasks") {
        const parsedTasks = await loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status === "done");
        setCommandResult({
          title: "Done task notes",
          detail: formatPlannerTaskList(filtered, "No completed task notes were found."),
        });
        setStatusMessage("Completed task notes loaded from Notion.");
        setVoiceSessionPhase("ready");
        setPlannerTasks(filtered);
        setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        appendConversationTurn("jarvis", `I found ${filtered.length} completed task${filtered.length === 1 ? "" : "s"}.`);
        speakIfEnabled(`I found ${filtered.length} completed task${filtered.length === 1 ? "" : "s"}.`);
      } else if (intent.kind === "list_open_tasks") {
        const parsedTasks = await loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status !== "done");
        setCommandResult({
          title: "Open task notes",
          detail: formatPlannerTaskList(filtered, "No open task notes were found."),
        });
        setStatusMessage("Open task notes loaded from Notion.");
        setVoiceSessionPhase("ready");
        setPlannerTasks(filtered);
        setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        appendConversationTurn("jarvis", `I found ${filtered.length} open task${filtered.length === 1 ? "" : "s"}.`);
        speakIfEnabled(`I found ${filtered.length} open task${filtered.length === 1 ? "" : "s"}.`);
      } else if (intent.kind === "filter_tasks_by_query") {
        const parsedTasks = await loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) =>
          `${task.title} ${task.dueLabel ?? ""} ${task.sourceNote.summary}`.toLowerCase().includes(intent.query.toLowerCase()),
        );
        const reply = `I found ${filtered.length} task${filtered.length === 1 ? "" : "s"} matching ${intent.query}.`;
        setCommandResult({
          title: `Tasks about ${intent.query}`,
          detail: formatPlannerTaskList(filtered, `No task notes matched ${intent.query}.`),
        });
        setStatusMessage(`Task notes filtered for ${intent.query}.`);
        setVoiceSessionPhase("ready");
        setPlannerTasks(filtered);
        setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "create_calendar_event") {
        const reply = buildCalendarEventReply(intent.title);
        if (googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            googleCalendarAccessToken,
            intent.title,
            intent.start,
            intent.end,
          );
        } else {
          const calendarUrl = buildGoogleCalendarEventUrl(
            intent.title,
            intent.start,
            intent.end,
          );
          await openBrowserUrl(calendarUrl);
        }
        setCommandResult({
          title: googleCalendarAccessToken ? "Calendar event created" : "Calendar draft opened",
          detail: googleCalendarAccessToken
            ? `Created a Google Calendar event for ${intent.title}.`
            : `Opened a Google Calendar draft for ${intent.title}.`,
        });
        setStatusMessage(
          googleCalendarAccessToken
            ? "Calendar event created through JARVIS."
            : "Calendar draft opened through JARVIS.",
        );
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "create_reminder") {
        const reply = buildReminderReply(intent.title.replace(/^Reminder:\s*/i, ""));
        if (googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            googleCalendarAccessToken,
            intent.title,
            intent.start,
            intent.end,
          );
        } else {
          const calendarUrl = buildGoogleCalendarEventUrl(
            intent.title,
            intent.start,
            intent.end,
          );
          await openBrowserUrl(calendarUrl);
        }
        setCommandResult({
          title: googleCalendarAccessToken ? "Reminder created" : "Reminder draft opened",
          detail: googleCalendarAccessToken
            ? `Created a Google Calendar reminder event for ${intent.title.replace(/^Reminder:\s*/i, "")}.`
            : `Opened a Google Calendar reminder draft for ${intent.title.replace(/^Reminder:\s*/i, "")}.`,
        });
        setStatusMessage(
          googleCalendarAccessToken
            ? "Reminder created through JARVIS."
            : "Reminder draft opened through JARVIS.",
        );
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "search_files") {
        const files = await searchLocalFiles(intent.query.trim());
        const detail =
          files.length > 0
            ? files.map((file) => file.name).join(" | ")
            : `No files matched ${intent.query}.`;
        const reply = buildFileSearchReply(intent.query, files.length);
        setCommandResult({
          title: "Local file search",
          detail,
        });
        setStatusMessage("Local file search completed through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentFiles(files);
        setPresentedCollectionContext(null);
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_pdfs") {
        const files = (await searchLocalFiles("pdf")).filter(isPdfFile);
        setCommandResult({
          title: "PDF files",
          detail:
            files.length > 0
              ? files.map((file) => file.name).join(" | ")
              : "No PDF files were found in your Documents folder.",
        });
        setStatusMessage("PDF files loaded through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentFiles(files);
        setPresentedCollectionContext({
          kind: "pdfs",
          paths: files.map((file) => file.path),
        });
        appendConversationTurn("jarvis", `I found ${files.length} PDF${files.length === 1 ? "" : "s"} in your Documents folder.`);
        speakIfEnabled(`I found ${files.length} PDF${files.length === 1 ? "" : "s"}.`);
      } else if (intent.kind === "search_pdfs") {
        const files = (await searchLocalFiles(intent.query.trim())).filter(isPdfFile);
        setCommandResult({
          title: "PDF search",
          detail:
            files.length > 0
              ? files.map((file) => file.name).join(" | ")
              : `No PDFs matched ${intent.query}.`,
        });
        setStatusMessage("PDF search completed through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentFiles(files);
        setPresentedCollectionContext({
          kind: "pdfs",
          paths: files.map((file) => file.path),
        });
        appendConversationTurn("jarvis", `I found ${files.length} PDF${files.length === 1 ? "" : "s"} matching ${intent.query}.`);
        speakIfEnabled(`I found ${files.length} PDF${files.length === 1 ? "" : "s"} matching ${intent.query}.`);
      } else if (intent.kind === "open_current_pdf") {
        const file = getCurrentPdf(recentFiles);
        if (!file) {
          throw new Error("There is no loaded PDF yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        setActiveConversationContext(createActivePdfContext(file));
        await openLocalFile(file.path);
        const reply = buildOpenFileReply(file.name);
        setCommandResult({
          title: "PDF opened",
          detail: `Opened ${file.name}.`,
        });
        setStatusMessage("Current PDF opened through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "open_pdf_by_index") {
        const file = getPdfByIndex(recentFiles, intent.index);
        if (!file) {
          throw new Error(`PDF ${intent.index} is not loaded right now. Ask JARVIS to find PDFs first.`);
        }

        setActiveConversationContext(createActivePdfContext(file));
        await openLocalFile(file.path);
        const reply = buildOpenFileReply(file.name);
        setCommandResult({
          title: "PDF opened",
          detail: `Opened ${file.name}.`,
        });
        setStatusMessage("PDF opened through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "open_pdf_by_query") {
        const file = findPdfByQuery(recentFiles, intent.query);
        if (!file) {
          throw new Error(`I could not find a loaded PDF about ${intent.query}. Ask JARVIS to search PDFs first.`);
        }

        setActiveConversationContext(createActivePdfContext(file));
        await openLocalFile(file.path);
        const reply = buildOpenFileReply(file.name);
        setCommandResult({
          title: "PDF opened",
          detail: `Opened ${file.name}.`,
        });
        setStatusMessage(`PDF opened for ${intent.query}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "read_current_pdf") {
        const file = getCurrentPdf(recentFiles);
        if (!file) {
          throw new Error("There is no loaded PDF yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        setActiveConversationContext(createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const reply = buildReadPdfReply(file.name);
        setCommandResult({
          title: `PDF text: ${file.name}`,
          detail: formatPdfTextPreview(file.name, text),
        });
        setStatusMessage("Current PDF text extracted through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "read_pdf_by_index") {
        const file = getPdfByIndex(recentFiles, intent.index);
        if (!file) {
          throw new Error(`PDF ${intent.index} is not loaded right now. Ask JARVIS to find PDFs first.`);
        }

        setActiveConversationContext(createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const reply = buildReadPdfReply(file.name);
        setCommandResult({
          title: `PDF text: ${file.name}`,
          detail: formatPdfTextPreview(file.name, text),
        });
        setStatusMessage("PDF text extracted through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "read_pdf_by_query") {
        const file = findPdfByQuery(recentFiles, intent.query);
        if (!file) {
          throw new Error(`I could not find a loaded PDF about ${intent.query}. Ask JARVIS to search PDFs first.`);
        }

        setActiveConversationContext(createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const reply = buildReadPdfReply(file.name);
        setCommandResult({
          title: `PDF text: ${file.name}`,
          detail: formatPdfTextPreview(file.name, text),
        });
        setStatusMessage(`PDF text extracted for ${intent.query}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_recent_files") {
        const files = await listRecentLocalFiles();
        const detail =
          files.length > 0
            ? files.map((file) => file.name).join(" | ")
            : "No recent files were found.";
        const reply = buildRecentFilesReply(files.length);
        setCommandResult({
          title: "Recent files",
          detail,
        });
        setStatusMessage("Recent local files loaded through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentFiles(files);
        setPresentedCollectionContext(null);
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "open_file") {
        await openLocalFile(intent.path);
        const fileName = intent.path.split(/[/\\]/).pop() ?? intent.path;
        const reply = buildOpenFileReply(fileName);
        setCommandResult({
          title: "Local file opened",
          detail: `Opened ${fileName}.`,
        });
        setStatusMessage("Local file opened through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "summarize_current_pdf") {
        const file = getCurrentPdf(recentFiles);
        if (!file) {
          throw new Error("There is no loaded PDF yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        setActiveConversationContext(createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = summarizePdfText(file.name, text);
        const reply = buildPdfSummaryReply(file.name);
        setCommandResult({
          title: `PDF summary: ${file.name}`,
          detail: summary,
        });
        setStatusMessage("Current PDF summary generated through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "summarize_pdf_by_index") {
        const file = getPdfByIndex(recentFiles, intent.index);
        if (!file) {
          throw new Error(`PDF ${intent.index} is not loaded right now. Ask JARVIS to find PDFs first.`);
        }

        setActiveConversationContext(createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = summarizePdfText(file.name, text);
        const reply = buildPdfSummaryReply(file.name);
        setCommandResult({
          title: `PDF summary: ${file.name}`,
          detail: summary,
        });
        setStatusMessage("PDF summary generated through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "summarize_pdf_by_query") {
        const file = findPdfByQuery(recentFiles, intent.query);
        if (!file) {
          throw new Error(`I could not find a loaded PDF about ${intent.query}. Ask JARVIS to search PDFs first.`);
        }

        setActiveConversationContext(createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = summarizePdfText(file.name, text);
        const reply = buildPdfSummaryReply(file.name);
        setCommandResult({
          title: `PDF summary: ${file.name}`,
          detail: summary,
        });
        setStatusMessage(`PDF summary generated for ${intent.query}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_pdf_summary_to_notion_by_index") {
        const file = getPdfByIndex(recentFiles, intent.index);
        if (!file) {
          throw new Error(`PDF ${intent.index} is not loaded right now. Ask JARVIS to find PDFs first.`);
        }

        setActiveConversationContext(createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = summarizePdfText(file.name, text);
        const note = await createNotionNote(summary);
        setCommandResult({
          title: "PDF summary saved",
          detail: `Saved the summary for ${file.name} to Notion as "${note.title}".`,
        });
        setStatusMessage("PDF summary saved to Notion through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", `I saved the summary for ${file.name} to Notion.`);
        speakIfEnabled(`I saved the summary for ${file.name} to Notion.`);
      } else if (intent.kind === "save_current_pdf_summary_to_notion") {
        const file = getCurrentPdf(recentFiles);
        if (!file) {
          throw new Error("There is no loaded PDF yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        setActiveConversationContext(createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = summarizePdfText(file.name, text);
        const note = await createNotionNote(summary);
        setCommandResult({
          title: "PDF summary saved",
          detail: `Saved the summary for ${file.name} to Notion as "${note.title}".`,
        });
        setStatusMessage("Current PDF summary saved to Notion through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", `I saved the summary for ${file.name} to Notion.`);
        speakIfEnabled(`I saved the summary for ${file.name} to Notion.`);
      } else if (intent.kind === "save_pdf_summary_to_notion_by_query") {
        const file = findPdfByQuery(recentFiles, intent.query);
        if (!file) {
          throw new Error(`I could not find a loaded PDF about ${intent.query}. Ask JARVIS to search PDFs first.`);
        }

        setActiveConversationContext(createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = summarizePdfText(file.name, text);
        const note = await createNotionNote(summary);
        setCommandResult({
          title: "PDF summary saved",
          detail: `Saved the summary for ${file.name} to Notion as "${note.title}".`,
        });
        setStatusMessage(`PDF summary for ${intent.query} saved to Notion through JARVIS.`);
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", `I saved the summary for ${file.name} to Notion.`);
        speakIfEnabled(`I saved the summary for ${file.name} to Notion.`);
      } else if (intent.kind === "create_tasks_from_pdf_by_index") {
        const file = getPdfByIndex(recentFiles, intent.index);
        if (!file) {
          throw new Error(`PDF ${intent.index} is not loaded right now. Ask JARVIS to find PDFs first.`);
        }

        setActiveConversationContext(createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const tasks = extractTasksFromPdfText(text);
        if (tasks.length === 0) {
          throw new Error(`JARVIS could not find clear action items in ${file.name} yet.`);
        }

        for (const task of tasks) {
          await createNotionTask(task.title, task.dueLabel, getDueIsoFromLabel(task.dueLabel));
        }

        const reply = buildPdfTasksReply(file.name, tasks.length);
        setCommandResult({
          title: "PDF tasks created",
          detail: tasks
            .map((task) => (task.dueLabel ? `${task.title} (${task.dueLabel})` : task.title))
            .join(" | "),
        });
        setStatusMessage("Tasks were created from the PDF through JARVIS.");
        setVoiceSessionPhase("ready");
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "create_tasks_from_current_pdf") {
        const file = getCurrentPdf(recentFiles);
        if (!file) {
          throw new Error("There is no loaded PDF yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        setActiveConversationContext(createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const tasks = extractTasksFromPdfText(text);
        if (tasks.length === 0) {
          throw new Error(`JARVIS could not find clear action items in ${file.name} yet.`);
        }

        for (const task of tasks) {
          await createNotionTask(task.title, task.dueLabel, getDueIsoFromLabel(task.dueLabel));
        }

        const reply = buildPdfTasksReply(file.name, tasks.length);
        setCommandResult({
          title: "PDF tasks created",
          detail: tasks
            .map((task) => (task.dueLabel ? `${task.title} (${task.dueLabel})` : task.title))
            .join(" | "),
        });
        setStatusMessage("Tasks were created from the current PDF through JARVIS.");
        setVoiceSessionPhase("ready");
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "create_tasks_from_pdf_by_query") {
        const file = findPdfByQuery(recentFiles, intent.query);
        if (!file) {
          throw new Error(`I could not find a loaded PDF about ${intent.query}. Ask JARVIS to search PDFs first.`);
        }

        setActiveConversationContext(createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const tasks = extractTasksFromPdfText(text);
        if (tasks.length === 0) {
          throw new Error(`JARVIS could not find clear action items in ${file.name} yet.`);
        }

        for (const task of tasks) {
          await createNotionTask(task.title, task.dueLabel, getDueIsoFromLabel(task.dueLabel));
        }

        const reply = buildPdfTasksReply(file.name, tasks.length);
        setCommandResult({
          title: "PDF tasks created",
          detail: tasks
            .map((task) => (task.dueLabel ? `${task.title} (${task.dueLabel})` : task.title))
            .join(" | "),
        });
        setStatusMessage(`Tasks were created from the PDF about ${intent.query}.`);
        setVoiceSessionPhase("ready");
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "summarize_all_loaded_pdfs") {
        const loadedPdfs = getLoadedPdfFiles(recentFiles);
        if (loadedPdfs.length === 0) {
          throw new Error("There are no loaded PDFs yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        const summaries: string[] = [];
        for (const file of loadedPdfs) {
          const text = await extractPdfText(file.path);
          summaries.push(`PDF: ${file.name}\n${summarizePdfText(file.name, text)}`);
        }

        const reply = buildBatchPdfSummaryReply(loadedPdfs.length);
        setCommandResult({
          title: "Batch PDF summaries",
          detail: summaries.join("\n\n---\n\n").slice(0, 12000),
        });
        setStatusMessage("Summarized all loaded PDFs through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "summarize_pdf_range") {
        const selectedPdfs = intent.indices
          .map((index) => getPdfByIndex(recentFiles, index))
          .filter(Boolean) as FileRecord[];
        if (selectedPdfs.length === 0) {
          throw new Error(
            "I could not resolve those PDFs from the current list. Ask JARVIS to find PDFs or search PDFs first.",
          );
        }

        const summaries: string[] = [];
        for (const file of selectedPdfs) {
          const text = await extractPdfText(file.path);
          summaries.push(`PDF: ${file.name}\n${summarizePdfText(file.name, text)}`);
        }

        setActiveConversationContext(createActivePdfContext(selectedPdfs[selectedPdfs.length - 1]));
        const reply = buildBatchPdfSummaryReply(selectedPdfs.length);
        setCommandResult({
          title: "Batch PDF summaries",
          detail: summaries.join("\n\n---\n\n").slice(0, 12000),
        });
        setStatusMessage("Summarized selected PDFs through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "spotify_play") {
        if (!spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        await spotifyResumePlayback(spotifyAccessToken);
        const playback = await refreshSpotifyPlayback(spotifyAccessToken).catch(() => null);
        const reply = buildSpotifyPlayReply();
        setCommandResult({
          title: "Spotify resumed",
          detail: playback?.title
            ? `Resumed ${playback.title}${playback.artist ? ` by ${playback.artist}` : ""}.`
            : "Sent the resume command to Spotify.",
        });
        setStatusMessage("Spotify playback resumed through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "spotify_pause") {
        if (!spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        await spotifyPausePlayback(spotifyAccessToken);
        const reply = buildSpotifyPauseReply();
        setSpotifyPlaybackState((current) =>
          current ? { ...current, isPlaying: false } : current,
        );
        setCommandResult({
          title: "Spotify paused",
          detail: "Paused Spotify playback.",
        });
        setStatusMessage("Spotify playback paused through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "spotify_next") {
        if (!spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        await spotifySkipToNext(spotifyAccessToken);
        const playback = await refreshSpotifyPlayback(spotifyAccessToken).catch(() => null);
        const reply = buildSpotifySkipReply("next");
        setCommandResult({
          title: "Spotify skipped",
          detail: playback?.title
            ? `Skipped to ${playback.title}${playback.artist ? ` by ${playback.artist}` : ""}.`
            : "Skipped to the next Spotify track.",
        });
        setStatusMessage("Spotify advanced to the next track.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "spotify_previous") {
        if (!spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        await spotifySkipToPrevious(spotifyAccessToken);
        const playback = await refreshSpotifyPlayback(spotifyAccessToken).catch(() => null);
        const reply = buildSpotifySkipReply("previous");
        setCommandResult({
          title: "Spotify went back",
          detail: playback?.title
            ? `Went back to ${playback.title}${playback.artist ? ` by ${playback.artist}` : ""}.`
            : "Moved Spotify to the previous track.",
        });
        setStatusMessage("Spotify moved to the previous track.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "spotify_status") {
        if (!spotifyAccessToken) {
          throw new Error(
            "Spotify is not connected yet. Save your Spotify client ID and connect first.",
          );
        }

        const playback = await refreshSpotifyPlayback(spotifyAccessToken);
        const reply = buildSpotifyStatusReply(playback);
        setCommandResult({
          title: "Spotify playback",
          detail: playback?.title
            ? `${playback.isPlaying ? "Playing" : "Paused"} ${playback.title}${
                playback.artist ? ` by ${playback.artist}` : ""
              }${playback.deviceName ? ` on ${playback.deviceName}` : ""}.`
            : "Spotify is connected, but nothing is actively playing right now.",
        });
        setStatusMessage("Spotify playback status checked.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "list_unread_emails") {
        if (!gmailAccessToken) {
          throw new Error(
            "Gmail is not connected yet. Use the Google config and connect Gmail first.",
          );
        }

        const emails = await listUnreadGmailMessages(gmailAccessToken);
        const detail =
          emails.length > 0
            ? emails
                .map((email) => `${email.subject} — ${email.from}`)
                .join(" | ")
            : "No unread Gmail messages were found.";
        const reply = buildUnreadEmailReply(emails.length);
        setCommandResult({
          title: "Unread Gmail messages",
          detail,
        });
        setStatusMessage("Unread Gmail messages loaded through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentEmails(emails);
        setPresentedCollectionContext({
          kind: "emails",
          emailIds: emails.map((email) => email.id),
        });
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "search_emails") {
        if (!gmailAccessToken) {
          throw new Error(
            "Gmail is not connected yet. Use the Google config and connect Gmail first.",
          );
        }

        const query = intent.query.trim();
        const emails = await searchGmailMessages(gmailAccessToken, query);
        const detail =
          emails.length > 0
            ? emails
                .map((email) => `${email.subject} — ${email.from}`)
                .join(" | ")
            : `No Gmail messages matched ${query}.`;
        const reply = buildSearchEmailReply(query, emails.length);
        setCommandResult({
          title: "Gmail search",
          detail,
        });
        setStatusMessage("Gmail search completed through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentEmails(emails);
        setPresentedCollectionContext({
          kind: "emails",
          emailIds: emails.map((email) => email.id),
        });
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_latest_email_to_notion") {
        const email = recentEmails[0];
        if (!email) {
          throw new Error(
            "There is no loaded email to save yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const note = await createNotionNote(formatEmailForNotion(email));
        const reply = buildSaveLatestEmailToNotionReply(note.title);
        setCommandResult({
          title: "Email saved to Notion",
          detail: `Saved "${email.subject}" to Notion as "${note.title}".`,
        });
        setStatusMessage("Latest Gmail message saved into Notion.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_current_email_to_notion") {
        const email = resolveActiveEmail(activeConversationContext, recentEmails);
        if (!email) {
          throw new Error(
            "There is no active email in the conversation yet. Open, read, or analyze an email first.",
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const note = await createNotionNote(formatEmailForNotion(email));
        const reply = buildSaveLatestEmailToNotionReply(note.title);
        setCommandResult({
          title: "Email saved to Notion",
          detail: `Saved "${email.subject}" to Notion as "${note.title}".`,
        });
        setStatusMessage("Active Gmail message saved into Notion.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_email_digest_to_notion") {
        if (recentEmails.length === 0) {
          throw new Error(
            "There are no loaded emails to summarize yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const note = await createNotionNote(formatEmailDigestForNotion(recentEmails));
        const reply = buildSaveEmailDigestToNotionReply(note.title, recentEmails.length);
        setCommandResult({
          title: "Email digest saved to Notion",
          detail: `Saved a Notion digest covering ${recentEmails.length} emails as "${note.title}".`,
        });
        setStatusMessage("Gmail digest saved into Notion.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_first_emails_to_notion") {
        if (recentEmails.length === 0) {
          throw new Error(
            "There are no loaded emails yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const count = Math.max(1, Math.min(intent.count, recentEmails.length));
        const emailsToSave = recentEmails.slice(0, count);
        const savedNotes: NoteRecord[] = [];
        for (const email of emailsToSave) {
          const note = await createNotionNote(formatEmailForNotion(email));
          savedNotes.push(note);
        }

        const reply = buildBatchEmailSaveReply(savedNotes.length);
        setCommandResult({
          title: "Batch email save complete",
          detail: savedNotes.map((note) => note.title).join(" | "),
        });
        setStatusMessage("Saved multiple Gmail messages into Notion.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [...savedNotes.reverse(), ...current].slice(0, 10));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_email_range_to_notion") {
        const emailsToSave = intent.indices
          .map((index) => getEmailByIndex(recentEmails, index))
          .filter(Boolean) as EmailRecord[];
        if (emailsToSave.length === 0) {
          throw new Error(
            "I could not resolve those emails from the current list. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const savedNotes: NoteRecord[] = [];
        for (const email of emailsToSave) {
          const note = await createNotionNote(formatEmailForNotion(email));
          savedNotes.push(note);
        }

        setActiveConversationContext(createActiveEmailContext(emailsToSave[emailsToSave.length - 1]));
        const reply = buildBatchEmailSaveReply(savedNotes.length);
        setCommandResult({
          title: "Batch email save complete",
          detail: savedNotes.map((note) => note.title).join(" | "),
        });
        setStatusMessage("Saved selected Gmail messages into Notion.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [...savedNotes.reverse(), ...current].slice(0, 10));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_email_to_notion_by_index") {
        const email = getEmailByIndex(recentEmails, intent.index);
        if (!email) {
          throw new Error(
            `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const note = await createNotionNote(formatEmailForNotion(email));
        const reply = buildSaveIndexedEmailToNotionReply(note.title, intent.index);
        setCommandResult({
          title: "Email saved to Notion",
          detail: `Saved email ${intent.index} (${email.subject}) to Notion as "${note.title}".`,
        });
        setStatusMessage(`Saved email ${intent.index} from Gmail into Notion.`);
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_email_to_notion_by_query") {
        const email = findEmailByQuery(recentEmails, intent.query);
        if (!email) {
          throw new Error(
            `I could not find a loaded email about ${intent.query}. Load or search Gmail first.`,
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const note = await createNotionNote(formatEmailForNotion(email));
        const reply = buildSaveQueriedEmailToNotionReply(note.title, intent.query);
        setCommandResult({
          title: "Email saved to Notion",
          detail: `Saved the email about ${intent.query} to Notion as "${note.title}".`,
        });
        setStatusMessage(`Saved a Gmail message about ${intent.query} into Notion.`);
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "read_current_email") {
        const email = getCurrentEmail(recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email to read yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const reply = buildReadEmailReply(email.subject);
        setCommandResult({
          title: `Email: ${email.subject}`,
          detail: formatEmailForReading(email),
        });
        setStatusMessage("Current email loaded through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_signals") {
        const email =
          intent.index === null ? recentEmails[0] ?? null : getEmailByIndex(recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email to analyze yet. Ask JARVIS to show unread emails or search Gmail first."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const signals = extractEmailSignals(email);
        const reply = buildEmailSignalsReply(email.subject);
        setCommandResult({
          title: "Email details extracted",
          detail: formatEmailSignals(email, signals),
        });
        setStatusMessage("Email details were extracted through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "extract_current_email_signals") {
        const email = resolveActiveEmail(activeConversationContext, recentEmails);
        if (!email) {
          throw new Error(
            "There is no active email in the conversation yet. Open, read, or analyze an email first.",
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const signals = extractEmailSignals(email);
        const reply = buildEmailSignalsReply(email.subject);
        setCommandResult({
          title: "Email details extracted",
          detail: formatEmailSignals(email, signals),
        });
        setStatusMessage("Active email details were extracted through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_birthdays_from_current_email") {
        const email = resolveActiveEmail(activeConversationContext, recentEmails) ?? getCurrentEmail(recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const candidates = extractBirthdayCandidatesFromEmail(email);
        for (const candidate of candidates) {
          rememberPersonBirthday({ ...candidate, source: "gmail" });
        }
        setActiveConversationContext(createActiveEmailContext(email));
        const reply = buildBirthdayImportReply(candidates.length);
        setCommandResult({
          title: "Birthday import",
          detail:
            candidates.length > 0
              ? candidates.map((candidate) => `${candidate.name} - ${candidate.birthdayLabel}`).join(" | ")
              : `No clear birthdays were found in ${email.subject}.`,
        });
        setStatusMessage("Birthday extraction ran on the current email.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_birthdays_from_email_index") {
        const email = getEmailByIndex(recentEmails, intent.index);
        if (!email) {
          throw new Error(`Email ${intent.index} is not loaded right now. Load emails first.`);
        }

        const candidates = extractBirthdayCandidatesFromEmail(email);
        for (const candidate of candidates) {
          rememberPersonBirthday({ ...candidate, source: "gmail" });
        }
        setActiveConversationContext(createActiveEmailContext(email));
        const reply = buildBirthdayImportReply(candidates.length);
        setCommandResult({
          title: "Birthday import",
          detail:
            candidates.length > 0
              ? candidates.map((candidate) => `${candidate.name} - ${candidate.birthdayLabel}`).join(" | ")
              : `No clear birthdays were found in email ${intent.index}.`,
        });
        setStatusMessage(`Birthday extraction ran on email ${intent.index}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_birthdays_from_email_query") {
        const email = findEmailByQuery(recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const candidates = extractBirthdayCandidatesFromEmail(email);
        for (const candidate of candidates) {
          rememberPersonBirthday({ ...candidate, source: "gmail" });
        }
        setActiveConversationContext(createActiveEmailContext(email));
        const reply = buildBirthdayImportReply(candidates.length);
        setCommandResult({
          title: "Birthday import",
          detail:
            candidates.length > 0
              ? candidates.map((candidate) => `${candidate.name} - ${candidate.birthdayLabel}`).join(" | ")
              : `No clear birthdays were found in the email about ${intent.query}.`,
        });
        setStatusMessage(`Birthday extraction ran on the email about ${intent.query}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_birthdays_from_loaded_emails") {
        if (recentEmails.length === 0) {
          throw new Error(
            "There are no loaded emails yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const candidateMap = new Map<string, BirthdayCandidate>();
        for (const email of recentEmails) {
          for (const candidate of extractBirthdayCandidatesFromEmail(email)) {
            candidateMap.set(candidate.name.toLowerCase(), candidate);
          }
        }
        const candidates = Array.from(candidateMap.values());
        for (const candidate of candidates) {
          rememberPersonBirthday({ ...candidate, source: "gmail" });
        }

        const reply = buildBirthdayImportReply(candidates.length);
        setCommandResult({
          title: "Birthday import",
          detail:
            candidates.length > 0
              ? candidates.map((candidate) => `${candidate.name} - ${candidate.birthdayLabel}`).join(" | ")
              : "No clear birthdays were found in the currently loaded emails.",
        });
        setStatusMessage("Birthday extraction ran across loaded emails.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "extract_current_email_travel") {
        const email = resolveActiveEmail(activeConversationContext, recentEmails) ?? getCurrentEmail(recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = extractTravelDetails(email);
        const formatted = formatTravelExtraction(email, details);
        rememberTravelSummary(email.subject, email.subject, formatted);
        const reply = buildTravelExtractionReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Travel extracted",
          detail: formatted,
        });
        setStatusMessage("Travel extraction ran on the current email.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_travel") {
        const email =
          intent.index === null ? recentEmails[0] ?? null : getEmailByIndex(recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        const details = extractTravelDetails(email);
        const formatted = formatTravelExtraction(email, details);
        rememberTravelSummary(email.subject, email.subject, formatted);
        const reply = buildTravelExtractionReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Travel extracted",
          detail: formatted,
        });
        setStatusMessage("Travel extraction ran on the selected email.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_travel_by_query") {
        const email = findEmailByQuery(recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = extractTravelDetails(email);
        const formatted = formatTravelExtraction(email, details);
        rememberTravelSummary(email.subject, email.subject, formatted);
        const reply = buildTravelExtractionReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Travel extracted",
          detail: formatted,
        });
        setStatusMessage(`Travel extraction ran on the email about ${intent.query}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_current_email_travel_to_notion") {
        const email = resolveActiveEmail(activeConversationContext, recentEmails) ?? getCurrentEmail(recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = extractTravelDetails(email);
        const note = await createNotionNote(formatTravelForNotion(email, details));
        rememberTravelSummary(note.title, email.subject, formatTravelExtraction(email, details));
        const reply = buildTravelSavedReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Travel saved to Notion",
          detail: `Saved the travel summary for ${email.subject} as "${note.title}".`,
        });
        setStatusMessage("Travel summary saved to Notion through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_email_travel_to_notion_by_index") {
        const email = getEmailByIndex(recentEmails, intent.index);
        if (!email) {
          throw new Error(`Email ${intent.index} is not loaded right now. Load emails first.`);
        }

        const details = extractTravelDetails(email);
        const note = await createNotionNote(formatTravelForNotion(email, details));
        rememberTravelSummary(note.title, email.subject, formatTravelExtraction(email, details));
        const reply = buildTravelSavedReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Travel saved to Notion",
          detail: `Saved the travel summary for email ${intent.index} as "${note.title}".`,
        });
        setStatusMessage(`Travel summary from email ${intent.index} saved to Notion.`);
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_email_travel_to_notion_by_query") {
        const email = findEmailByQuery(recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = extractTravelDetails(email);
        const note = await createNotionNote(formatTravelForNotion(email, details));
        rememberTravelSummary(note.title, email.subject, formatTravelExtraction(email, details));
        const reply = buildTravelSavedReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Travel saved to Notion",
          detail: `Saved the travel summary for the email about ${intent.query} as "${note.title}".`,
        });
        setStatusMessage(`Travel summary from the email about ${intent.query} saved to Notion.`);
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "extract_current_email_expense") {
        const email = resolveActiveEmail(activeConversationContext, recentEmails) ?? getCurrentEmail(recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = extractExpenseDetails(email);
        const formatted = formatExpenseExtraction(email, details);
        rememberExpenseSummary(
          email.subject,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          formatted,
        );
        const reply = buildExpenseExtractionReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Expense extracted",
          detail: formatted,
        });
        setStatusMessage("Expense extraction ran on the current email.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_expense") {
        const email =
          intent.index === null ? recentEmails[0] ?? null : getEmailByIndex(recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        const details = extractExpenseDetails(email);
        const formatted = formatExpenseExtraction(email, details);
        rememberExpenseSummary(
          email.subject,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          formatted,
        );
        const reply = buildExpenseExtractionReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Expense extracted",
          detail: formatted,
        });
        setStatusMessage("Expense extraction ran on the selected email.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_expense_by_query") {
        const email = findEmailByQuery(recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = extractExpenseDetails(email);
        const formatted = formatExpenseExtraction(email, details);
        rememberExpenseSummary(
          email.subject,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          formatted,
        );
        const reply = buildExpenseExtractionReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Expense extracted",
          detail: formatted,
        });
        setStatusMessage(`Expense extraction ran on the email about ${intent.query}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_current_email_expense_to_notion") {
        const email = resolveActiveEmail(activeConversationContext, recentEmails) ?? getCurrentEmail(recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = extractExpenseDetails(email);
        const note = await createNotionNote(formatExpenseForNotion(email, details));
        rememberExpenseSummary(
          note.title,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          formatExpenseExtraction(email, details),
        );
        const reply = buildExpenseSavedReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Expense saved to Notion",
          detail: `Saved the expense summary for ${email.subject} as "${note.title}".`,
        });
        setStatusMessage("Expense summary saved to Notion through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_email_expense_to_notion_by_index") {
        const email = getEmailByIndex(recentEmails, intent.index);
        if (!email) {
          throw new Error(`Email ${intent.index} is not loaded right now. Load emails first.`);
        }

        const details = extractExpenseDetails(email);
        const note = await createNotionNote(formatExpenseForNotion(email, details));
        rememberExpenseSummary(
          note.title,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          formatExpenseExtraction(email, details),
        );
        const reply = buildExpenseSavedReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Expense saved to Notion",
          detail: `Saved the expense summary for email ${intent.index} as "${note.title}".`,
        });
        setStatusMessage(`Expense summary from email ${intent.index} saved to Notion.`);
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_email_expense_to_notion_by_query") {
        const email = findEmailByQuery(recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = extractExpenseDetails(email);
        const note = await createNotionNote(formatExpenseForNotion(email, details));
        rememberExpenseSummary(
          note.title,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          formatExpenseExtraction(email, details),
        );
        const reply = buildExpenseSavedReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Expense saved to Notion",
          detail: `Saved the expense summary for the email about ${intent.query} as "${note.title}".`,
        });
        setStatusMessage(`Expense summary from the email about ${intent.query} saved to Notion.`);
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "extract_current_email_package") {
        const email = resolveActiveEmail(activeConversationContext, recentEmails) ?? getCurrentEmail(recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = extractPackageDetails(email);
        const formatted = formatPackageExtraction(email, details);
        rememberPackageSummary(
          email.subject,
          email.subject,
          details.carriers[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          formatted,
        );
        const reply = buildPackageExtractionReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Package extracted",
          detail: formatted,
        });
        setStatusMessage("Package extraction ran on the current email.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_package") {
        const email =
          intent.index === null ? recentEmails[0] ?? null : getEmailByIndex(recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        const details = extractPackageDetails(email);
        const formatted = formatPackageExtraction(email, details);
        rememberPackageSummary(
          email.subject,
          email.subject,
          details.carriers[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          formatted,
        );
        const reply = buildPackageExtractionReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Package extracted",
          detail: formatted,
        });
        setStatusMessage("Package extraction ran on the selected email.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "extract_email_package_by_query") {
        const email = findEmailByQuery(recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = extractPackageDetails(email);
        const formatted = formatPackageExtraction(email, details);
        rememberPackageSummary(
          email.subject,
          email.subject,
          details.carriers[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          formatted,
        );
        const reply = buildPackageExtractionReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Package extracted",
          detail: formatted,
        });
        setStatusMessage(`Package extraction ran on the email about ${intent.query}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_current_email_package_to_notion") {
        const email = resolveActiveEmail(activeConversationContext, recentEmails) ?? getCurrentEmail(recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = extractPackageDetails(email);
        const note = await createNotionNote(formatPackageForNotion(email, details));
        rememberPackageSummary(
          note.title,
          email.subject,
          details.carriers[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          formatPackageExtraction(email, details),
        );
        const reply = buildPackageSavedReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Package saved to Notion",
          detail: `Saved the package summary for ${email.subject} as "${note.title}".`,
        });
        setStatusMessage("Package summary saved to Notion through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_email_package_to_notion_by_index") {
        const email = getEmailByIndex(recentEmails, intent.index);
        if (!email) {
          throw new Error(`Email ${intent.index} is not loaded right now. Load emails first.`);
        }

        const details = extractPackageDetails(email);
        const note = await createNotionNote(formatPackageForNotion(email, details));
        rememberPackageSummary(
          note.title,
          email.subject,
          details.carriers[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          formatPackageExtraction(email, details),
        );
        const reply = buildPackageSavedReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Package saved to Notion",
          detail: `Saved the package summary for email ${intent.index} as "${note.title}".`,
        });
        setStatusMessage(`Package summary from email ${intent.index} saved to Notion.`);
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "save_email_package_to_notion_by_query") {
        const email = findEmailByQuery(recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = extractPackageDetails(email);
        const note = await createNotionNote(formatPackageForNotion(email, details));
        rememberPackageSummary(
          note.title,
          email.subject,
          details.carriers[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          formatPackageExtraction(email, details),
        );
        const reply = buildPackageSavedReply(email.subject);
        setActiveConversationContext(createActiveEmailContext(email));
        setCommandResult({
          title: "Package saved to Notion",
          detail: `Saved the package summary for the email about ${intent.query} as "${note.title}".`,
        });
        setStatusMessage(`Package summary from the email about ${intent.query} saved to Notion.`);
        setVoiceSessionPhase("ready");
        setRecentNotes((current) => [note, ...current].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "create_meeting_prep" || intent.kind === "save_meeting_prep_to_notion") {
        if (!googleCalendarAccessToken) {
          throw new Error(
            "Google Calendar is not connected yet. Connect Google Calendar first so I can prepare from your schedule.",
          );
        }

        const events = await listTodayGoogleCalendarEvents(googleCalendarAccessToken);
        const event = findMeetingPrepEvent(events, intent.query);
        if (!event) {
          throw new Error(
            intent.query
              ? `I could not find a matching event for ${intent.query} in today's calendar.`
              : "I could not find a calendar event to prepare for today.",
          );
        }

        const relatedEmails = findRelatedMeetingEmails(event, recentEmails);
        const relatedNotes = findRelatedMeetingNotes(event, recentNotes);
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const relatedTasks = findRelatedMeetingTasks(event, availableTasks);
        const prepContent = buildMeetingPrepContent(event, relatedEmails, relatedNotes, relatedTasks);
        const reply = buildMeetingPrepReply(event.summary);

        if (intent.kind === "save_meeting_prep_to_notion") {
          const note = await createNotionNote(prepContent);
          rememberMeetingPrepSummary(event.summary, note.title, prepContent);
          setCommandResult({
            title: "Meeting prep saved",
            detail: `Saved the meeting prep note for ${event.summary} as "${note.title}".`,
          });
          setStatusMessage("Meeting prep saved to Notion through JARVIS.");
          setRecentNotes((current) => [note, ...current].slice(0, 5));
          appendConversationTurn("jarvis", buildMeetingPrepSavedReply(event.summary));
          speakIfEnabled(buildMeetingPrepSavedReply(event.summary));
        } else {
          rememberMeetingPrepSummary(event.summary, `Meeting Prep: ${event.summary}`, prepContent);
          setCommandResult({
            title: "Meeting prep ready",
            detail: prepContent,
          });
          setStatusMessage("Meeting prep generated through JARVIS.");
          appendConversationTurn("jarvis", reply);
          speakIfEnabled(reply);
        }

        setVoiceSessionPhase("ready");
      } else if (intent.kind === "extract_email_signals_by_query") {
        const email = findEmailByQuery(recentEmails, intent.query);
        if (!email) {
          throw new Error(
            `I could not find a loaded email about ${intent.query}. Load or search Gmail first.`,
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const signals = extractEmailSignals(email);
        const reply = buildEmailSignalsReply(email.subject);
        setCommandResult({
          title: "Email details extracted",
          detail: formatEmailSignals(email, signals),
        });
        setStatusMessage(`Email details were extracted for the email about ${intent.query}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "read_email_by_index") {
        const email = getEmailByIndex(recentEmails, intent.index);
        if (!email) {
          throw new Error(
            `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const reply = buildReadEmailReply(email.subject);
        setCommandResult({
          title: `Email ${intent.index}`,
          detail: formatEmailForReading(email),
        });
        setStatusMessage(`Loaded the full email text for email ${intent.index}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "read_email_by_query") {
        const email = findEmailByQuery(recentEmails, intent.query);
        if (!email) {
          throw new Error(
            `I could not find a loaded email about ${intent.query}. Load or search Gmail first.`,
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const reply = buildReadEmailReply(email.subject);
        setCommandResult({
          title: `Email about ${intent.query}`,
          detail: formatEmailForReading(email),
        });
        setStatusMessage(`Loaded the email about ${intent.query}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "open_current_email") {
        const email = getCurrentEmail(recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email to open yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        await openBrowserUrl(buildGmailThreadUrl(email.threadId));
        const reply = buildOpenEmailReply(email.subject);
        setCommandResult({
          title: "Gmail thread opened",
          detail: `Opened ${email.subject} in Gmail.`,
        });
        setStatusMessage("Current Gmail thread opened through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "open_email_by_index") {
        const email = getEmailByIndex(recentEmails, intent.index);
        if (!email) {
          throw new Error(
            `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        await openBrowserUrl(buildGmailThreadUrl(email.threadId));
        const reply = buildOpenEmailReply(email.subject);
        setCommandResult({
          title: "Gmail thread opened",
          detail: `Opened email ${intent.index} (${email.subject}) in Gmail.`,
        });
        setStatusMessage(`Opened Gmail thread for email ${intent.index}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "open_email_by_query") {
        const email = findEmailByQuery(recentEmails, intent.query);
        if (!email) {
          throw new Error(
            `I could not find a loaded email about ${intent.query}. Load or search Gmail first.`,
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        await openBrowserUrl(buildGmailThreadUrl(email.threadId));
        const reply = buildOpenEmailReply(email.subject);
        setCommandResult({
          title: "Gmail thread opened",
          detail: `Opened the email about ${intent.query} in Gmail.`,
        });
        setStatusMessage(`Opened Gmail thread about ${intent.query}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "create_calendar_event_from_email") {
        const email =
          intent.index === null ? recentEmails[0] ?? null : getEmailByIndex(recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email to turn into a calendar item yet."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const derivedIntent = buildCalendarIntentFromEmail(email);
        if (!derivedIntent) {
          throw new Error(
            `JARVIS could not find a clear date and time in "${email.subject}" yet.`,
          );
        }

        const reply = buildEmailToCalendarReply(derivedIntent.title);
        if (googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            googleCalendarAccessToken,
            derivedIntent.title,
            derivedIntent.start,
            derivedIntent.end,
          );
        } else {
          const calendarUrl = buildGoogleCalendarEventUrl(
            derivedIntent.title,
            derivedIntent.start,
            derivedIntent.end,
          );
          await openBrowserUrl(calendarUrl);
        }
        setCommandResult({
          title: googleCalendarAccessToken ? "Email event created" : "Email event draft opened",
          detail: googleCalendarAccessToken
            ? `Created a calendar event from "${email.subject}".`
            : `Opened a calendar draft from "${email.subject}".`,
        });
        setStatusMessage("Email was turned into a calendar action through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "create_calendar_event_from_current_email") {
        const email = resolveActiveEmail(activeConversationContext, recentEmails);
        if (!email) {
          throw new Error(
            "There is no active email in the conversation yet. Open, read, or analyze an email first.",
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const derivedIntent = buildCalendarIntentFromEmail(email);
        if (!derivedIntent) {
          throw new Error(
            `JARVIS could not find a clear date and time in "${email.subject}" yet.`,
          );
        }

        const reply = buildEmailToCalendarReply(derivedIntent.title);
        if (googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            googleCalendarAccessToken,
            derivedIntent.title,
            derivedIntent.start,
            derivedIntent.end,
          );
        } else {
          const calendarUrl = buildGoogleCalendarEventUrl(
            derivedIntent.title,
            derivedIntent.start,
            derivedIntent.end,
          );
          await openBrowserUrl(calendarUrl);
        }
        setCommandResult({
          title: googleCalendarAccessToken ? "Email event created" : "Email event draft opened",
          detail: googleCalendarAccessToken
            ? `Created a calendar event from "${email.subject}".`
            : `Opened a calendar draft from "${email.subject}".`,
        });
        setStatusMessage("Active email was turned into a calendar action through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "create_calendar_event_from_email_query") {
        const email = findEmailByQuery(recentEmails, intent.query);
        if (!email) {
          throw new Error(
            `I could not find a loaded email about ${intent.query}. Load or search Gmail first.`,
          );
        }

        setActiveConversationContext(createActiveEmailContext(email));
        const derivedIntent = buildCalendarIntentFromEmail(email);
        if (!derivedIntent) {
          throw new Error(
            `JARVIS could not find a clear date and time in the email about ${intent.query} yet.`,
          );
        }

        const reply = buildEmailToCalendarReply(derivedIntent.title);
        if (googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            googleCalendarAccessToken,
            derivedIntent.title,
            derivedIntent.start,
            derivedIntent.end,
          );
        } else {
          const calendarUrl = buildGoogleCalendarEventUrl(
            derivedIntent.title,
            derivedIntent.start,
            derivedIntent.end,
          );
          await openBrowserUrl(calendarUrl);
        }
        setCommandResult({
          title: googleCalendarAccessToken ? "Email event created" : "Email event draft opened",
          detail: googleCalendarAccessToken
            ? `Created a calendar event from the email about ${intent.query}.`
            : `Opened a calendar draft from the email about ${intent.query}.`,
        });
        setStatusMessage("Queried email was turned into a calendar action through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "complete_task_by_index") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const task = getPlannerTaskByIndex(availableTasks, intent.index);
        if (!task) {
          throw new Error(
            `Task ${intent.index} is not loaded right now. Show your task notes first.`,
          );
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          getDueIsoFromLabel(task.dueLabel),
          "done",
        );
        const reply = buildCompleteTaskReply(task.title);
        setCommandResult({
          title: "Task completed",
          detail: `Marked task ${intent.index} (${task.title}) as done in Notion.`,
        });
        setStatusMessage("Task note marked done through JARVIS.");
        setVoiceSessionPhase("ready");
        setActiveConversationContext(
          createActiveTaskContext({
            ...task,
            status: "done",
            sourceNote: updatedNote,
          }),
        );
        setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "complete_task_by_query") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const task = findPlannerTaskByQuery(availableTasks, intent.query);
        if (!task) {
          throw new Error(`I could not find a loaded task about ${intent.query}.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          getDueIsoFromLabel(task.dueLabel),
          "done",
        );
        const reply = buildCompleteTaskReply(task.title);
        setCommandResult({
          title: "Task completed",
          detail: `Marked ${task.title} as done in Notion.`,
        });
        setStatusMessage("Task note marked done through JARVIS.");
        setVoiceSessionPhase("ready");
        setActiveConversationContext(
          createActiveTaskContext({
            ...task,
            status: "done",
            sourceNote: updatedNote,
          }),
        );
        setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "update_task_by_index") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const task = getPlannerTaskByIndex(availableTasks, intent.index);
        if (!task) {
          throw new Error(
            `Task ${intent.index} is not loaded right now. Show your task notes first.`,
          );
        }

        const updatedNote = await updateNotionTask(
          task.id,
          intent.title,
          intent.dueLabel,
          getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = buildUpdateTaskReply(intent.title);
        setCommandResult({
          title: "Task updated",
          detail: intent.dueLabel
            ? `Updated task ${intent.index} to ${intent.title} due ${intent.dueLabel}.`
            : `Updated task ${intent.index} to ${intent.title}.`,
        });
        setStatusMessage("Task note updated through JARVIS.");
        setVoiceSessionPhase("ready");
        setActiveConversationContext(
          createActiveTaskContext({
            ...task,
            id: updatedNote.id,
            title: intent.title,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "update_task_by_query") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const task = findPlannerTaskByQuery(availableTasks, intent.query);
        if (!task) {
          throw new Error(`I could not find a loaded task about ${intent.query}.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          intent.title,
          intent.dueLabel,
          getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = buildUpdateTaskReply(intent.title);
        setCommandResult({
          title: "Task updated",
          detail: intent.dueLabel
            ? `Updated ${task.title} to ${intent.title} due ${intent.dueLabel}.`
            : `Updated ${task.title} to ${intent.title}.`,
        });
        setStatusMessage("Task note updated through JARVIS.");
        setVoiceSessionPhase("ready");
        setActiveConversationContext(
          createActiveTaskContext({
            ...task,
            id: updatedNote.id,
            title: intent.title,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "reopen_task_by_index") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const task = getPlannerTaskByIndex(availableTasks, intent.index);
        if (!task) {
          throw new Error(`Task ${intent.index} is not loaded right now. Show your task notes first.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          getDueIsoFromLabel(task.dueLabel),
          "open",
        );
        const reply = buildReopenTaskReply(task.title);
        setCommandResult({
          title: "Task reopened",
          detail: `Reopened task ${intent.index} (${task.title}) in Notion.`,
        });
        setStatusMessage("Task note reopened through JARVIS.");
        setVoiceSessionPhase("ready");
        setActiveConversationContext(
          createActiveTaskContext({
            ...task,
            sourceNote: updatedNote,
          }),
        );
        setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "reopen_task_by_query") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const task = findPlannerTaskByQuery(availableTasks, intent.query);
        if (!task) {
          throw new Error(`I could not find a loaded task about ${intent.query}.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          getDueIsoFromLabel(task.dueLabel),
          "open",
        );
        const reply = buildReopenTaskReply(task.title);
        setCommandResult({
          title: "Task reopened",
          detail: `Reopened ${task.title} in Notion.`,
        });
        setStatusMessage("Task note reopened through JARVIS.");
        setVoiceSessionPhase("ready");
        setActiveConversationContext(
          createActiveTaskContext({
            ...task,
            sourceNote: updatedNote,
          }),
        );
        setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "move_task_by_index") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const task = getPlannerTaskByIndex(availableTasks, intent.index);
        if (!task) {
          throw new Error(`Task ${intent.index} is not loaded right now. Show your task notes first.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          intent.dueLabel,
          getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = buildMoveTaskReply(task.title, intent.dueLabel);
        setCommandResult({
          title: "Task moved",
          detail: `Moved task ${intent.index} (${task.title}) to ${intent.dueLabel}.`,
        });
        setStatusMessage("Task note rescheduled through JARVIS.");
        setVoiceSessionPhase("ready");
        setActiveConversationContext(
          createActiveTaskContext({
            ...task,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "move_task_by_query") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const task = findPlannerTaskByQuery(availableTasks, intent.query);
        if (!task) {
          throw new Error(`I could not find a loaded task about ${intent.query}.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          intent.dueLabel,
          getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = buildMoveTaskReply(task.title, intent.dueLabel);
        setCommandResult({
          title: "Task moved",
          detail: `Moved ${task.title} to ${intent.dueLabel}.`,
        });
        setStatusMessage("Task note rescheduled through JARVIS.");
        setVoiceSessionPhase("ready");
        setActiveConversationContext(
          createActiveTaskContext({
            ...task,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "complete_current_task") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const task = resolveActiveTask(activeConversationContext, availableTasks);
        if (!task) {
          throw new Error("There is no active task in the conversation yet. Show or create a task first.");
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          getDueIsoFromLabel(task.dueLabel),
          "done",
        );
        const reply = buildCompleteTaskReply(task.title);
        setCommandResult({
          title: "Task completed",
          detail: `Marked ${task.title} as done in Notion.`,
        });
        setStatusMessage("Active task note marked done through JARVIS.");
        setVoiceSessionPhase("ready");
        setActiveConversationContext(
          createActiveTaskContext({
            ...task,
            status: "done",
            sourceNote: updatedNote,
          }),
        );
        setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "reopen_current_task") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const task = resolveActiveTask(activeConversationContext, availableTasks);
        if (!task) {
          throw new Error("There is no active task in the conversation yet. Show or create a task first.");
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          getDueIsoFromLabel(task.dueLabel),
          "open",
        );
        const reply = buildReopenTaskReply(task.title);
        setCommandResult({
          title: "Task reopened",
          detail: `Reopened ${task.title} in Notion.`,
        });
        setStatusMessage("Active task note reopened through JARVIS.");
        setVoiceSessionPhase("ready");
        setActiveConversationContext(
          createActiveTaskContext({
            ...task,
            sourceNote: updatedNote,
          }),
        );
        setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "move_current_task") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const task = resolveActiveTask(activeConversationContext, availableTasks);
        if (!task) {
          throw new Error("There is no active task in the conversation yet. Show or create a task first.");
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          intent.dueLabel,
          getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = buildMoveTaskReply(task.title, intent.dueLabel);
        setCommandResult({
          title: "Task moved",
          detail: `Moved ${task.title} to ${intent.dueLabel}.`,
        });
        setStatusMessage("Active task note rescheduled through JARVIS.");
        setVoiceSessionPhase("ready");
        setActiveConversationContext(
          createActiveTaskContext({
            ...task,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "open_current_browser_target") {
        const browserContext = resolveActiveBrowserContext(activeConversationContext);
        if (!browserContext) {
          throw new Error("There is no active browser target in the conversation yet. Open or search something first.");
        }

        await openBrowserUrl(browserContext.url);
        const reply = buildOpenSiteReply(browserContext.label);
        setCommandResult({
          title: "Website opened",
          detail: `Opened ${browserContext.label}.`,
        });
        setStatusMessage("Active browser target opened through JARVIS.");
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "set_voice_reply_mode") {
        setVoiceReplyMode(intent.mode);
        const reply = buildVoiceReplyModeReply(intent.mode);
        setCommandResult({
          title: "Voice reply mode updated",
          detail: buildVoiceReplyModeDetail(intent.mode),
        });
        setStatusMessage(`Voice reply mode set to ${formatVoiceReplyModeLabel(intent.mode)}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        if (intent.mode !== "quiet") {
          speakIfEnabled(reply);
        }
      } else if (intent.kind === "report_voice_reply_mode") {
        const label = formatVoiceReplyModeLabel(voiceReplyMode);
        const reply = `I'm currently using ${label} voice mode.`;
        setCommandResult({
          title: "Voice reply mode",
          detail: buildVoiceReplyModeDetail(voiceReplyMode),
        });
        setStatusMessage(`Voice reply mode is ${label}.`);
        setVoiceSessionPhase("ready");
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "complete_all_overdue_tasks") {
        const parsedTasks = await loadPlannerTaskRecords();
        const overdueTasks = parsedTasks.filter((task) => task.status === "overdue");
        const updatedNotes: NoteRecord[] = [];

        for (const task of overdueTasks) {
          const updatedNote = await updateNotionTask(
            task.id,
            task.title,
            task.dueLabel,
            getDueIsoFromLabel(task.dueLabel),
            "done",
          );
          updatedNotes.push(updatedNote);
        }

        const reply = buildBatchOverdueTaskReply(overdueTasks.length);
        setCommandResult({
          title: "Overdue tasks completed",
          detail:
            overdueTasks.length > 0
              ? overdueTasks.map((task) => task.title).join(" | ")
              : "There were no overdue tasks to complete.",
        });
        setStatusMessage("Processed all overdue tasks through JARVIS.");
        setVoiceSessionPhase("ready");
        if (updatedNotes.length > 0) {
          setRecentNotes((current) =>
            [
              ...updatedNotes.reverse(),
              ...current.filter(
                (note) => !updatedNotes.some((updated) => updated.id === note.id),
              ),
            ].slice(0, 10),
          );
        }
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "complete_task_range") {
        const availableTasks = plannerTasks.length > 0 ? plannerTasks : await loadPlannerTaskRecords();
        const tasksToComplete = intent.indices
          .map((index) => getPlannerTaskByIndex(availableTasks, index))
          .filter(Boolean) as PlannerTaskRecord[];
        if (tasksToComplete.length === 0) {
          throw new Error(
            "I could not resolve those tasks from the current list. Show your task notes first.",
          );
        }

        const updatedNotes: NoteRecord[] = [];
        for (const task of tasksToComplete) {
          const updatedNote = await updateNotionTask(
            task.id,
            task.title,
            task.dueLabel,
            getDueIsoFromLabel(task.dueLabel),
            "done",
          );
          updatedNotes.push(updatedNote);
        }

        const lastTask = tasksToComplete[tasksToComplete.length - 1];
        const lastUpdatedNote = updatedNotes[updatedNotes.length - 1];
        setActiveConversationContext(
          createActiveTaskContext({
            ...lastTask,
            status: "done",
            sourceNote: lastUpdatedNote,
          }),
        );
        const reply = buildBatchOverdueTaskReply(tasksToComplete.length);
        setCommandResult({
          title: "Batch task completion complete",
          detail: tasksToComplete.map((task) => task.title).join(" | "),
        });
        setStatusMessage("Completed selected tasks through JARVIS.");
        setVoiceSessionPhase("ready");
        setRecentNotes((current) =>
          [
            ...updatedNotes.reverse(),
            ...current.filter((note) => !updatedNotes.some((updated) => updated.id === note.id)),
          ].slice(0, 10),
        );
        await loadRecentNotes();
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "create_daily_brief") {
        const emails =
          gmailAccessToken ? await listUnreadGmailMessages(gmailAccessToken, 5) : recentEmails.slice(0, 5);
        const taskNotes = await searchNotionNotes("Task:");
        const parsedTasks = taskNotes
          .map(parseTaskNoteRecord)
          .filter(Boolean) as PlannerTaskRecord[];
        const events = googleCalendarAccessToken
          ? await listTodayGoogleCalendarEvents(googleCalendarAccessToken)
          : [];

        const briefContent = buildDailyBriefContentV2(emails, parsedTasks, events);
        const note = await createNotionNote(briefContent);
        const reply = buildDailyBriefReply(note.title);
        setCommandResult({
          title: "Daily brief saved",
          detail: `Saved your daily brief to Notion as "${note.title}".`,
        });
        setStatusMessage("Daily brief generated from Gmail, Calendar, and Notion.");
        setVoiceSessionPhase("ready");
        setRecentEmails(emails);
        setPlannerTasks(parsedTasks);
        setRecentNotes((current) => [note, ...current.filter((item) => item.id !== note.id)].slice(0, 5));
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "standby_mode") {
        returnToArmedWakeMode();
        setWakeModeStatus({
          assistantName,
          wakeModeEnabled: true,
          message: `${assistantName} is standing by and waiting for the wake phrase.`,
        });
        const reply = buildStandbyReply(assistantName);
        setCommandResult({
          title: "JARVIS is standing by",
          detail: "Wake mode stays on, and the assistant has returned to the armed standby state.",
        });
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "sleep_mode") {
        stopHandsFreeSession();
        setWakeModeEnabled(false);
        setWakeModeStatus({
          assistantName,
          wakeModeEnabled: false,
          message: `${assistantName} is sleeping for this session.`,
        });
        const reply = buildSleepReply(assistantName);
        setCommandResult({
          title: "JARVIS is sleeping",
          detail: "Wake mode is off for this session. Turn it back on when you want hands-free listening again.",
        });
        setStatusMessage(`${assistantName} is sleeping. Wake mode is off for this session.`);
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
      } else if (intent.kind === "shutdown_app") {
        stopHandsFreeSession();
        const reply = buildShutdownReply(assistantName);
        setCommandResult({
          title: "Shutting down JARVIS",
          detail: "Closing the app now.",
        });
        setStatusMessage(`Shutting down ${assistantName}.`);
        appendConversationTurn("jarvis", reply);
        speakIfEnabled(reply);
        window.setTimeout(() => {
          void getCurrentWindow().close();
        }, 300);
      }

      completed = true;
      await loadMemoryView();
    } catch (error) {
      setVoiceSessionPhase("error");
      setCommandResult({
        title: "Command failed",
        detail: getErrorDetail(
          error,
          "JARVIS could not complete that browser or study action through the native bridge.",
        ),
      });
      appendConversationTurn("jarvis", buildFailureReply());
      speakIfEnabled("I could not complete that.");
    } finally {
      setIsRoutingCommand(false);
    }

    return completed;
  }

  async function runCommand(
    trimmedInput: string,
    options?: {
      appendUserTurn?: boolean;
      allowChaining?: boolean;
    },
  ): Promise<RunCommandOutcome> {
    const appendUserTurn = options?.appendUserTurn ?? true;
    const allowChaining = options?.allowChaining ?? true;

    if (!trimmedInput) {
      setVoiceSessionPhase("idle");
      setStatusMessage("No command to route yet.");
      setCommandResult({
        title: "No command to route",
        detail: "Type something like 'Open my study apps' to test the first skill.",
      });
      speakIfEnabled("I did not hear a command to route.");
      return { status: "empty" };
    }

    if (appendUserTurn) {
      appendConversationTurn("user", trimmedInput);
    }

    if (pendingWorkflowExecution) {
      return continuePendingWorkflowExecution(pendingWorkflowExecution, trimmedInput);
    }

    if (pendingClarification) {
      if (pendingClarification.suggestedLearning) {
        const normalizedReply = normalizeControlCommand(trimmedInput);
        if (["yes", "yeah", "yep", "sure", "okay", "ok", "do that"].includes(normalizedReply)) {
          setPendingClarification(null);
          await rememberSuccessfulPhrase(
            pendingClarification.suggestedLearning.originalPhrase,
            pendingClarification.suggestedLearning.intent,
          );
          const completed = await executeIntent(pendingClarification.suggestedLearning.intent);
          if (completed && shouldKeepFollowUpWindowOpen(pendingClarification.suggestedLearning.intent)) {
            openFollowUpWindow("reply");
          }
          return completed ? { status: "completed" } : { status: "failed" };
        }

        if (["no", "nope", "nah", "not that", "don't learn that", "do not learn that"].includes(normalizedReply)) {
          setPendingClarification(null);
          setCommandResult({
            title: "Learning suggestion dismissed",
            detail: "Okay. I will not learn that phrase mapping right now.",
          });
          setStatusMessage("JARVIS skipped that language-learning suggestion.");
          appendConversationTurn("jarvis", "Okay. I won't learn that phrase mapping yet.");
          speakIfEnabled("Okay. I won't learn that phrase mapping yet.");
          return { status: "clarification" };
        }
      }

      if (pendingClarification.choices.length === 0) {
        setPendingClarification(null);
        await executeIntent({ kind: "google_search", query: trimmedInput });
        return { status: "completed" };
      }

      const clarifiedIntent = resolveClarificationReply(trimmedInput, pendingClarification);
      if (clarifiedIntent) {
        setPendingClarification(null);
        const completed = await executeIntent(clarifiedIntent);
        if (completed && pendingClarification.originalPhrase) {
          await rememberSuccessfulPhrase(pendingClarification.originalPhrase, clarifiedIntent);
        }
        if (completed && shouldKeepFollowUpWindowOpen(clarifiedIntent)) {
          openFollowUpWindow("reply");
        }
        return completed ? { status: "completed" } : { status: "failed" };
      }

      setCommandResult({
        title: "Still need clarification",
        detail: pendingClarification.prompt,
      });
      appendConversationTurn("jarvis", buildClarificationReply(pendingClarification.prompt));
      speakIfEnabled(buildClarificationReply(pendingClarification.prompt));
      openFollowUpWindow("clarification");
      return { status: "clarification" };
    }

    const savedWorkflowInvocation = resolveSavedWorkflowInvocation(trimmedInput, savedWorkflows);
    if (savedWorkflowInvocation) {
      const { workflow: savedWorkflow, inputText } = savedWorkflowInvocation;
      setStatusMessage(`Running saved workflow ${savedWorkflow.name}.`);
      for (let index = 0; index < savedWorkflow.steps.length; index += 1) {
        const rawStep = savedWorkflow.steps[index];
        const resolvedStep = resolveWorkflowConditionalStep(
          rawStep,
          activeConversationContext,
          recentEmails,
          recentFiles,
          recentNotes,
          plannerTasks,
        );
        if (resolvedStep.action === "skip") {
          continue;
        }
        if (resolvedStep.action === "stop") {
          setCommandResult({
            title: "Workflow stopped by condition",
            detail: `Stopped ${savedWorkflow.name} because one of its conditions chose a stop branch.`,
          });
          appendConversationTurn("jarvis", `Stopped the workflow ${savedWorkflow.name}.`);
          speakIfEnabled(`Stopped the workflow ${savedWorkflow.name}.`);
          return { status: "completed" };
        }
        const renderedStep = renderWorkflowStep(
          resolvedStep.step,
          activeConversationContext,
          inputText,
        );
        if (renderedStep.missingPlaceholder) {
          setPendingWorkflowExecution({
            workflowId: savedWorkflow.id,
            workflowName: savedWorkflow.name,
            inputText,
            currentStepIndex: index,
            rawSteps: savedWorkflow.steps,
            missingPlaceholder: renderedStep.missingPlaceholder as PendingWorkflowExecution["missingPlaceholder"],
          });
          setCommandResult({
            title: "Workflow needs more context",
            detail:
              renderedStep.missingPlaceholder === "input"
                ? `The workflow "${savedWorkflow.name}" needs extra text after its trigger phrase.`
                : `The workflow "${savedWorkflow.name}" needs a matching current context for {{${renderedStep.missingPlaceholder}}}.`,
          });
          appendConversationTurn(
            "jarvis",
            renderedStep.missingPlaceholder === "input"
              ? `That workflow needs a little more text after ${savedWorkflow.triggerPhrase}.`
              : `That workflow needs the right current context before I can run it.`,
          );
          speakIfEnabled(
            renderedStep.missingPlaceholder === "input"
              ? `That workflow needs a little more text after ${savedWorkflow.triggerPhrase}.`
              : "That workflow needs the right current context before I can run it.",
          );
          return { status: "clarification" };
        }

        const outcome = await runCommand(renderedStep.step, {
          appendUserTurn: false,
          allowChaining: false,
        });
        if (outcome.status !== "completed") {
          setStatusMessage(`Saved workflow ${savedWorkflow.name} paused before completion.`);
          return outcome;
        }
      }

      setCommandResult({
        title: "Workflow completed",
        detail: `Finished saved workflow "${savedWorkflow.name}".`,
      });
      appendConversationTurn("jarvis", `Finished the workflow ${savedWorkflow.name}.`);
      speakIfEnabled(`Finished the workflow ${savedWorkflow.name}.`);
      return { status: "completed" };
    }

    if (allowChaining) {
      const workflowSteps = splitWorkflowCommand(trimmedInput);
      if (workflowSteps) {
        setStatusMessage(`Running a ${workflowSteps.length}-step workflow through JARVIS.`);
        let completedSteps = 0;
        for (const step of workflowSteps) {
          const outcome = await runCommand(step, {
            appendUserTurn: false,
            allowChaining: false,
          });
          if (outcome.status !== "completed") {
            setStatusMessage(
              completedSteps > 0
                ? `Workflow paused after ${completedSteps} step${completedSteps === 1 ? "" : "s"}.`
                : "Workflow paused before completion.",
            );
            return outcome;
          }
          completedSteps += 1;
        }

        setStatusMessage(
          `Workflow complete. Finished ${completedSteps} step${completedSteps === 1 ? "" : "s"}.`,
        );
        rememberWorkflowSequence(workflowSteps, trimmedInput);
        return { status: "completed" };
      }
    }

    const learnedIntent = resolveLearnedIntent(trimmedInput, learnedIntentMappings);
    if (learnedIntent) {
      setMissingSkillRequest(null);
      setMissingSkillPlan(null);
      const completed = await executeIntent(learnedIntent);
      if (completed) {
        await rememberSuccessfulPhrase(trimmedInput, learnedIntent);
      }
      if (completed && shouldKeepFollowUpWindowOpen(learnedIntent)) {
        openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const contextualIntent = resolveContextualFollowUpIntent(
      trimmedInput,
      activeConversationContext,
    );
    if (contextualIntent) {
      setMissingSkillRequest(null);
      setMissingSkillPlan(null);
      const completed = await executeIntent(contextualIntent);
      if (completed) {
        await rememberSuccessfulPhrase(trimmedInput, contextualIntent);
      }
      if (completed && shouldKeepFollowUpWindowOpen(contextualIntent)) {
        openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const ordinalIntent = resolveOrdinalFollowUpIntent(
      trimmedInput,
      presentedCollectionContext,
      recentEmails,
      recentFiles,
      recentNotes,
      plannerTasks,
    );
    if (ordinalIntent) {
      setMissingSkillRequest(null);
      setMissingSkillPlan(null);
      const completed = await executeIntent(ordinalIntent);
      if (completed) {
        await rememberSuccessfulPhrase(trimmedInput, ordinalIntent);
      }
      if (completed && shouldKeepFollowUpWindowOpen(ordinalIntent)) {
        openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const referenceIntent = resolveReferenceFollowUpIntent(
      trimmedInput,
      presentedCollectionContext,
      activeConversationContext,
      recentEmails,
      recentFiles,
      recentNotes,
      plannerTasks,
    );
    if (referenceIntent) {
      setMissingSkillRequest(null);
      setMissingSkillPlan(null);
      const completed = await executeIntent(referenceIntent);
      if (completed) {
        await rememberSuccessfulPhrase(trimmedInput, referenceIntent);
      }
      if (completed && shouldKeepFollowUpWindowOpen(referenceIntent)) {
        openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const batchReferenceIntent = resolveBatchReferenceFollowUpIntent(
      trimmedInput,
      presentedCollectionContext,
      activeConversationContext,
      recentEmails,
      recentFiles,
      recentNotes,
      plannerTasks,
    );
    if (batchReferenceIntent) {
      setMissingSkillRequest(null);
      setMissingSkillPlan(null);
      const completed = await executeIntent(batchReferenceIntent);
      if (completed) {
        await rememberSuccessfulPhrase(trimmedInput, batchReferenceIntent);
      }
      if (completed && shouldKeepFollowUpWindowOpen(batchReferenceIntent)) {
        openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const learnedSuggestion = findLearnedIntentSuggestion(trimmedInput, learnedIntentMappings);
    if (learnedSuggestion) {
      setPendingClarification({
        prompt: `That sounds close to your learned phrase "${learnedSuggestion.record.phrase}". Should I treat "${trimmedInput}" the same way from now on?`,
        choices: [],
        originalPhrase: trimmedInput,
        suggestedLearning: {
          originalPhrase: trimmedInput,
          sourcePhrase: learnedSuggestion.record.phrase,
          intent: learnedSuggestion.intent,
        },
      });
      setVoiceSessionPhase("ready");
      setStatusMessage("JARVIS found a close learned phrase and wants to confirm it.");
      setCommandResult({
        title: "Language learning suggestion",
        detail: `I think "${trimmedInput}" is close to "${learnedSuggestion.record.phrase}". Say yes to learn and reuse it, or no to skip it.`,
      });
      appendConversationTurn(
        "jarvis",
        `That sounds close to your learned phrase "${learnedSuggestion.record.phrase}". Should I treat it the same way from now on?`,
      );
      speakIfEnabled(
        `That sounds close to your learned phrase ${learnedSuggestion.record.phrase}. Should I treat it the same way from now on?`,
      );
      openFollowUpWindow("clarification");
      return { status: "clarification" };
    }

    const clarification = buildClarificationForCommand(trimmedInput, browserAliases);
    if (clarification) {
      setPendingClarification({
        ...clarification,
        originalPhrase: trimmedInput,
      });
      setVoiceSessionPhase("ready");
      setStatusMessage("JARVIS needs a quick clarification.");
      setCommandResult({
        title: "Need clarification",
        detail: clarification.prompt,
      });
      appendConversationTurn("jarvis", buildClarificationReply(clarification.prompt));
      speakIfEnabled(buildClarificationReply(clarification.prompt));
      openFollowUpWindow("clarification");
      return { status: "clarification" };
    }

    let intent: CommandIntent | null = null;

    if (conversationBackend === "ollama") {
      try {
        const interpretation = await interpretConversationWithOllama(
          trimmedInput,
          assistantName,
        );
        const mappedResult = mapOllamaInterpretationToResult(interpretation);

        if (mappedResult.kind === "clarification") {
          setPendingClarification({
            prompt: mappedResult.prompt,
            choices: [],
            originalPhrase: trimmedInput,
          });
          setVoiceSessionPhase("ready");
          setStatusMessage("Ollama asked for a quick clarification.");
          setCommandResult({
            title: "Need clarification",
            detail: mappedResult.prompt,
          });
          appendConversationTurn("jarvis", buildClarificationReply(mappedResult.prompt));
          speakIfEnabled(buildClarificationReply(mappedResult.prompt));
          openFollowUpWindow("clarification");
          return { status: "clarification" };
        }

        if (mappedResult.kind === "intent") {
          if (
            mappedResult.intent.kind === "google_search" &&
            !hasExplicitSearchLanguage(trimmedInput)
          ) {
            intent = null;
          } else if (
            mappedResult.intent.kind === "open_url" &&
            !hasExplicitOpenLanguage(trimmedInput)
          ) {
            intent = null;
          } else {
            intent = mappedResult.intent;
          }
        }
      } catch (error) {
        const detail = getErrorDetail(
          error,
          "Ollama conversation mode could not interpret that request, so JARVIS is falling back to heuristics.",
        );
        setStatusMessage(detail);
      }
    }

    if (!intent) {
      intent = parseConversationalCommandIntent(trimmedInput, browserAliases);
    }

    if (!intent) {
      setMissingSkillRequest(trimmedInput);
      setMissingSkillPlan(null);
      setVoiceSessionPhase("ready");
      setCommandResult({
        title: "Conversation understood, skill missing",
        detail:
          "I understood that as a request, but I do not have the right skill wired yet. You can ask the advanced assistant for a suggested new skill plan before we build or run anything.",
      });
      appendConversationTurn("jarvis", buildMissingSkillReply());
      speakIfEnabled("I get what you're asking, but that skill is not wired yet.");
      openFollowUpWindow("reply");

      if (
        skillAutopilotAvailable &&
        autonomousSkillBuildingEnabled &&
        conversationBackend === "ollama"
      ) {
        void handleAskAdvancedAssistant(trimmedInput);
      }
      return { status: "missing_skill" };
    }

    setMissingSkillRequest(null);
    setMissingSkillPlan(null);
    const completed = await executeIntent(intent);
    if (completed) {
      await rememberSuccessfulPhrase(trimmedInput, intent);
    }
    if (completed && shouldKeepFollowUpWindowOpen(intent)) {
      openFollowUpWindow("reply");
    }
    return completed ? { status: "completed" } : { status: "failed" };
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Personal Assistant Platform</p>
          <h1>JARVIS</h1>
          <p className="hero-text">
            A modular desktop assistant for launching apps, handling web tasks,
            and growing into your daily operating layer.
          </p>
        </div>

        <div className="status-card">
          <span className="status-label">Core status</span>
          <div className={`wake-cue ${wakeCueActive ? "active" : ""}`}>
            {wakeCueActive ? `${assistantName} woke up` : "Wake cue idle"}
          </div>
          <p>{statusMessage}</p>
          <button className="secondary-button" onClick={pingCore}>
            Test native bridge
          </button>
        </div>
      </section>

      <section className="command-panel">
        <div>
          <p className="section-kicker">Command Center</p>
          <h2>Start with natural commands</h2>
        </div>

        <form className="command-box" onSubmit={routeCommand}>
          <label>
            <span className="sr-only">Command input</span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Tell JARVIS what you want to do..."
            />
          </label>
          <button className="primary-button" type="submit" disabled={isRoutingCommand}>
            {isRoutingCommand ? "Routing..." : "Route command"}
          </button>
        </form>

        <div className="voice-row">
          <button
            className="secondary-button"
            type="button"
            onClick={handleVoiceStart}
            disabled={
              voiceBackend === "browser"
                ? voiceState === "listening" ||
                  voiceState === "wake_listening" ||
                  voiceState === "unsupported"
                : false
            }
          >
            {voiceBackend === "local"
              ? localRecorderRef.current
                ? "Stop local recording"
                : "Start local recording"
              : voiceState === "wake_listening"
                ? `Wake armed for ${assistantName}`
                : voiceState === "listening"
                ? "Listening..."
                : "Push to talk"}
          </button>
          <span className="memory-meta">
            {voiceState === "unsupported"
              ? "Voice unavailable here"
              : followUpWindow?.active
                ? pendingClarification
                  ? "Follow-up window is open. Answer naturally and JARVIS will keep listening."
                  : "Follow-up window is open. Keep talking if you want another action."
              : voiceState === "wake_listening"
                ? `Hands-free wake is armed. Say "${assistantName}" to start talking.`
              : voiceTranscript
                ? `Heard: ${voiceTranscript}`
                : "Voice V1 uses browser speech recognition for quick testing."}
          </span>
          <span className={`voice-phase ${voiceSessionPhase}`}>State: {voiceSessionPhase}</span>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setVoiceResponseEnabled((current) => !current)}
          >
            {voiceResponseEnabled ? "Voice replies on" : "Voice replies off"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setVoiceReplyMode((current) =>
                current === "quiet"
                  ? "brief"
                  : current === "brief"
                    ? "normal"
                    : current === "normal"
                      ? "detailed"
                      : "quiet",
              )
            }
          >
            {`Voice mode: ${formatVoiceReplyModeLabel(voiceReplyMode)}`}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setSpeechOutputBackend((current) => (current === "browser" ? "local" : "browser"))
            }
          >
            {speechOutputBackend === "browser"
              ? "Speech: browser"
              : "Speech: local"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setVoiceAutoRouteEnabled((current) => !current)}
            disabled={conversationBackend === "ollama"}
          >
            {conversationBackend === "ollama"
              ? "Auto-route via Ollama"
              : voiceAutoRouteEnabled
                ? "Auto-route on"
                : "Auto-route off"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setVoiceBackend((current) => (current === "browser" ? "local" : "browser"))
            }
          >
            {voiceBackend === "browser" ? "Backend: browser" : "Backend: local"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setConversationBackend((current) =>
                current === "heuristics" ? "ollama" : "heuristics",
              )
            }
          >
            {conversationBackend === "heuristics"
              ? "Conversation: heuristics"
              : "Conversation: ollama"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setAutonomousSkillBuildingEnabled((current) =>
                skillAutopilotAvailable ? !current : current,
              )
            }
            disabled={!skillAutopilotAvailable}
          >
            {skillAutopilotAvailable
              ? autonomousSkillBuildingEnabled
                ? "Skill autopilot on"
                : "Skill autopilot off"
              : "Skill autopilot temporarily off"}
          </button>
        </div>

        <div className="voice-correction-box">
          <input
            value={voiceCorrectionInput}
            onChange={(event) => setVoiceCorrectionInput(event.target.value)}
            placeholder="Correct the last heard phrase..."
          />
          <button className="secondary-button" type="button" onClick={handleSaveVoiceCorrection}>
            Save correction
          </button>
        </div>

        <div className="voice-correction-box">
          <input
            value={browserAliasUrl}
            onChange={(event) => setBrowserAliasUrl(event.target.value)}
            placeholder="Correct browser URL for the current command..."
          />
          <button className="secondary-button" type="button" onClick={handleSaveBrowserAlias}>
            Save site alias
          </button>
        </div>

        {voiceBackend === "local" ? (
          <div className="local-config-card">
            <input
              value={localExecutablePath}
              onChange={(event) => setLocalExecutablePath(event.target.value)}
              placeholder="Path to whisper-cli.exe"
            />
            <input
              value={localModelPath}
              onChange={(event) => setLocalModelPath(event.target.value)}
              placeholder="Path to ggml model file (.bin)"
            />
            <button className="secondary-button" type="button" onClick={handleSaveLocalVoiceConfig}>
              Save local config
            </button>
          </div>
        ) : null}

        {speechOutputBackend === "local" ? (
          <div className="local-config-card">
            <input
              value={localTtsExecutablePath}
              onChange={(event) => setLocalTtsExecutablePath(event.target.value)}
              placeholder="Path to piper.exe"
            />
            <input
              value={localTtsModelPath}
              onChange={(event) => setLocalTtsModelPath(event.target.value)}
              placeholder="Path to Piper voice model (.onnx)"
            />
            <button className="secondary-button" type="button" onClick={handleSaveLocalSpeechConfig}>
              Save local speech config
            </button>
          </div>
        ) : null}

        {conversationBackend === "ollama" ? (
          <div className="local-config-card">
            <input
              value={ollamaBaseUrl}
              onChange={(event) => setOllamaBaseUrl(event.target.value)}
              placeholder="Ollama base URL"
            />
            <input
              value={ollamaModelName}
              onChange={(event) => setOllamaModelName(event.target.value)}
              placeholder="Ollama model name"
            />
            <button className="secondary-button" type="button" onClick={handleSaveOllamaConfig}>
              Save Ollama config
            </button>
          </div>
        ) : null}

        <div className="local-config-card">
          <input
            value={googleCalendarClientId}
            onChange={(event) => setGoogleCalendarClientId(event.target.value)}
            placeholder="Google Calendar client ID"
          />
          <input
            value={googleCalendarApiKey}
            onChange={(event) => setGoogleCalendarApiKey(event.target.value)}
            placeholder="Google Calendar API key"
          />
          <button
            className="secondary-button"
            type="button"
            onClick={handleSaveGoogleCalendarConfig}
          >
            Save Google Calendar config
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void handleConnectGoogleCalendar()}
          >
            {googleCalendarAccessToken ? "Google Calendar connected" : "Connect Google Calendar"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void handleConnectGmail()}
          >
            {gmailAccessToken ? "Gmail connected" : "Connect Gmail"}
          </button>
          <p className="result-meta">
            Google OAuth origin for this app: {window.location.origin}
          </p>
          <p className="result-meta">
            Google OAuth redirect URI for this app: {window.location.origin}/
          </p>
        </div>

        <div className="local-config-card">
          <input
            value={spotifyClientId}
            onChange={(event) => setSpotifyClientId(event.target.value)}
            placeholder="Spotify client ID"
          />
          <button className="secondary-button" type="button" onClick={handleSaveSpotifyConfig}>
            Save Spotify config
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void handleConnectSpotify()}
          >
            {spotifyAccessToken ? "Spotify connected" : "Connect Spotify"}
          </button>
          {spotifyAccessToken ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                clearSpotifySession();
                setSpotifyAccessToken(null);
                setSpotifyPlaybackState(null);
                setCommandResult({
                  title: "Spotify disconnected",
                  detail: "Cleared the Spotify session token from this app.",
                });
              }}
            >
              Disconnect Spotify
            </button>
          ) : null}
        </div>

        <div className="local-config-card">
          <input
            value={notionTokenInput}
            onChange={(event) => setNotionTokenInput(event.target.value)}
            placeholder={
              notionStatus?.hasToken
                ? "Notion token saved locally. Re-enter only if you want to replace it."
                : "Notion integration token"
            }
          />
          <input
            value={notionDatabaseId}
            onChange={(event) => setNotionDatabaseId(event.target.value)}
            placeholder="Notion database ID"
          />
          <button className="secondary-button" type="button" onClick={handleSaveNotionConfig}>
            Save Notion config
          </button>
          {notionStatus?.hasToken ? (
            <p className="result-meta">
              Token saved locally. The app hides it after save, so an empty token box here does not
              mean it was lost.
            </p>
          ) : null}
        </div>

        <div className="local-config-card">
          <input
            value={executorCommandPath}
            onChange={(event) => setExecutorCommandPath(event.target.value)}
            placeholder="Executor command path"
          />
          <input
            value={executorWorkingDirectory}
            onChange={(event) => setExecutorWorkingDirectory(event.target.value)}
            placeholder="Executor working directory"
          />
          <button className="secondary-button" type="button" onClick={handleSaveExecutorConfig}>
            Save executor bridge
          </button>
        </div>

        <div className="local-config-card">
          <input
            value={assistantName}
            onChange={(event) => setAssistantName(event.target.value)}
            placeholder="Assistant name"
          />
          <div className="wake-row">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setWakeModeEnabled((current) => !current)}
            >
              {wakeModeEnabled ? "Wake mode on" : "Wake mode off"}
            </button>
            <button className="secondary-button" type="button" onClick={handleSaveWakeMode}>
              Save wake settings
            </button>
            <button className="secondary-button" type="button" onClick={handleWakeActivation}>
              Wake {assistantName}
            </button>
          </div>
        </div>

        <div className="prompt-row">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              className="prompt-chip"
              type="button"
              onClick={() => setInput(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        {commandResult ? (
          <div className="result-card">
            <p className="section-kicker">Latest Result</p>
            <h3>{commandResult.title}</h3>
            <p>{commandResult.detail}</p>
          </div>
        ) : null}

        {pendingClarification?.suggestedLearning ? (
          <div className="result-card">
            <p className="section-kicker">Intent Family Suggestion</p>
            <h3>Possible phrase match</h3>
            <p>
              "{pendingClarification.suggestedLearning.originalPhrase}" sounds close to your learned
              phrase "{pendingClarification.suggestedLearning.sourcePhrase}".
            </p>
            <p className="result-meta">Say `yes` to learn it, or `no` to skip it.</p>
          </div>
        ) : null}

        {learnedIntentMappings.length > 0 ? (
          <div className="result-card">
            <p className="section-kicker">Language Memory</p>
            <h3>{learnedIntentMappings.length} learned phrase{learnedIntentMappings.length === 1 ? "" : "s"}</h3>
            <p>JARVIS now reuses your successful phrasing before falling back to the normal parser.</p>
            <p className="result-meta">
              Recent examples: {learnedIntentMappings.slice(0, 3).map((entry) => `"${entry.phrase}"`).join(", ")}
            </p>
          </div>
        ) : null}

        {peopleMemory.length > 0 ? (
          <div className="result-card">
            <p className="section-kicker">People Memory</p>
            <h3>{peopleMemory.length} saved birthday{peopleMemory.length === 1 ? "" : "s"}</h3>
            <p>JARVIS can now remember people and upcoming birthdays from your voice commands and Gmail.</p>
            <p className="result-meta">
              Next up: {[...peopleMemory]
                .sort((left, right) => getNextBirthdayDate(left).getTime() - getNextBirthdayDate(right).getTime())
                .slice(0, 3)
                .map((person) => `${person.name} (${person.birthdayLabel})`)
                .join(", ")}
            </p>
          </div>
        ) : null}

        {travelMemory.length > 0 ? (
          <div className="result-card">
            <p className="section-kicker">Travel Memory</p>
            <h3>{travelMemory.length} saved travel item{travelMemory.length === 1 ? "" : "s"}</h3>
            <p>JARVIS is now keeping lightweight travel summaries from the emails you analyze or save.</p>
            <p className="result-meta">
              Recent: {travelMemory
                .slice(0, 3)
                .map((item) => item.title)
                .join(", ")}
            </p>
          </div>
        ) : null}

        {expenseMemory.length > 0 ? (
          <div className="result-card">
            <p className="section-kicker">Expense Memory</p>
            <h3>{expenseMemory.length} saved expense item{expenseMemory.length === 1 ? "" : "s"}</h3>
            <p>JARVIS is now keeping lightweight expense summaries from the emails you analyze or save.</p>
            <p className="result-meta">
              Recent: {expenseMemory
                .slice(0, 3)
                .map((item) =>
                  `${item.title}${item.amount ? ` (${item.amount})` : ""}`,
                )
                .join(", ")}
            </p>
          </div>
        ) : null}

        {packageMemory.length > 0 ? (
          <div className="result-card">
            <p className="section-kicker">Package Memory</p>
            <h3>{packageMemory.length} saved package item{packageMemory.length === 1 ? "" : "s"}</h3>
            <p>JARVIS is now keeping lightweight package summaries from the shipping emails you analyze or save.</p>
            <p className="result-meta">
              Recent: {packageMemory
                .slice(0, 3)
                .map((item) =>
                  `${item.title}${item.status ? ` (${item.status})` : ""}`,
                )
                .join(", ")}
            </p>
          </div>
        ) : null}

        {meetingPrepMemory.length > 0 ? (
          <div className="result-card">
            <p className="section-kicker">Meeting Prep Memory</p>
            <h3>{meetingPrepMemory.length} saved prep item{meetingPrepMemory.length === 1 ? "" : "s"}</h3>
            <p>JARVIS is now keeping lightweight meeting prep summaries from your calendar-driven prep runs.</p>
            <p className="result-meta">
              Recent: {meetingPrepMemory
                .slice(0, 3)
                .map((item) => item.summaryTitle)
                .join(", ")}
            </p>
          </div>
        ) : null}

        {schoolPlanMemory.length > 0 ? (
          <div className="result-card">
            <p className="section-kicker">School Memory</p>
            <h3>{schoolPlanMemory.length} saved school plan{schoolPlanMemory.length === 1 ? "" : "s"}</h3>
            <p>JARVIS is now keeping lightweight school mode plans from your study-planning runs.</p>
            <p className="result-meta">
              Recent: {schoolPlanMemory
                .slice(0, 3)
                .map((item) => item.title)
                .join(", ")}
            </p>
          </div>
        ) : null}

        {missingSkillRequest ? (
          <div className="result-card">
            <p className="section-kicker">Skill Gap</p>
            <h3>Missing skill detected</h3>
            <p>
              Request: {missingSkillRequest}
            </p>
            <p className="result-meta">
              {skillAutopilotAvailable &&
              autonomousSkillBuildingEnabled &&
              conversationBackend === "ollama"
                ? "Skill autopilot is on, so JARVIS will try asking the advanced assistant automatically."
                : "JARVIS will only ask the advanced assistant for a plan if you approve it first."}
            </p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleAskAdvancedAssistant()}
              disabled={isGeneratingMissingSkillPlan}
            >
              {isGeneratingMissingSkillPlan
                ? "Asking advanced assistant..."
                : "Ask advanced assistant"}
            </button>
          </div>
        ) : null}

        {missingSkillPlan ? (
          <div className="result-card">
            <p className="section-kicker">Advanced Plan</p>
            <h3>{missingSkillPlan.skillName}</h3>
            <p>{missingSkillPlan.summary}</p>
            <p className="result-meta">Why it helps: {missingSkillPlan.userValue}</p>
            <p className="result-meta">{missingSkillPlan.approvalMessage}</p>
            <div className="proposal-actions">
              <button className="primary-button" type="button" onClick={handleApproveSkillPlan}>
                Approve for implementation
              </button>
            </div>
            <div className="memory-list">
              {missingSkillPlan.buildSteps.map((step, index) => (
                <div className="memory-card" key={`${missingSkillPlan.skillName}-step-${index}`}>
                  <h3>Step {index + 1}</h3>
                  <p>{step}</p>
                </div>
              ))}
              {missingSkillPlan.permissionsNeeded.length > 0 ? (
                <div className="memory-card">
                  <h3>Permissions needed</h3>
                  <p>{missingSkillPlan.permissionsNeeded.join(", ")}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {implementationRequest ? (
          <div className="result-card">
            <p className="section-kicker">Implementation Brief</p>
            <h3>{implementationRequest.skillName}</h3>
            <p>{implementationRequest.summary}</p>
            <p className="result-meta">
              Original request: {implementationRequest.originalRequest}
            </p>
            <p className="result-meta">
              User value: {implementationRequest.userValue}
            </p>
            <p className="result-meta">
              Approved at: {implementationRequest.approvedAt}
            </p>
            <div className="proposal-actions">
              <button className="primary-button" type="button" onClick={handleGenerateBuildRequest}>
                Generate build request
              </button>
            </div>
            <div className="memory-list">
              {implementationRequest.buildSteps.map((step, index) => (
                <div
                  className="memory-card"
                  key={`${implementationRequest.skillName}-implementation-${index}`}
                >
                  <h3>Build step {index + 1}</h3>
                  <p>{step}</p>
                </div>
              ))}
              {implementationRequest.permissionsNeeded.length > 0 ? (
                <div className="memory-card">
                  <h3>Permissions to review</h3>
                  <p>{implementationRequest.permissionsNeeded.join(", ")}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {buildRequest ? (
          <div className="result-card">
            <p className="section-kicker">Build Request</p>
            <h3>{buildRequest.title}</h3>
            <p className="result-meta">Created at: {buildRequest.createdAt}</p>
            <div className="proposal-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void handleCreateHandoffArtifact(buildRequest)}
              >
                Create coding handoff package
              </button>
            </div>
            <div className="memory-list">
              <div className="memory-card">
                <h3>Agent prompt</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{buildRequest.prompt}</p>
              </div>
              <div className="memory-card">
                <h3>Safety checks</h3>
                <p>{buildRequest.safetyChecks.join(" | ")}</p>
              </div>
            </div>
          </div>
        ) : null}

        {handoffArtifact ? (
          <div className="result-card">
            <p className="section-kicker">Handoff Package</p>
            <h3>Manual boundary reached</h3>
            <p>{handoffArtifact.message}</p>
            <p className="result-meta">Markdown: {handoffArtifact.markdownPath}</p>
            <p className="result-meta">JSON: {handoffArtifact.jsonPath}</p>
            <p className="result-meta">Created at: {handoffArtifact.createdAt}</p>
          </div>
        ) : null}

        {workflowSuggestion ? (
          <div className="result-card">
            <p className="section-kicker">Workflow Suggestion</p>
            <h3>{workflowSuggestion.name}</h3>
            <p>
              You’ve repeated this workflow {workflowSuggestion.basedOnCount} times. I can save it
              and let you run it later with "{workflowSuggestion.triggerPhrase}".
            </p>
            <div className="proposal-actions">
              <button
                className="primary-button"
                type="button"
                onClick={handleApproveWorkflowSuggestion}
              >
                Save workflow
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={handleDismissWorkflowSuggestion}
              >
                Dismiss
              </button>
            </div>
            <div className="memory-list">
              {workflowSuggestion.steps.map((step, index) => (
                <div className="memory-card" key={`${workflowSuggestion.signature}-${index}`}>
                  <h3>Step {index + 1}</h3>
                  <p>{step}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {pendingWorkflowExecution ? (
          <div className="result-card">
            <p className="section-kicker">Workflow Pause</p>
            <h3>{pendingWorkflowExecution.workflowName}</h3>
            <p>
              {pendingWorkflowExecution.missingPlaceholder === "input"
                ? "JARVIS is waiting for the extra text this workflow needs before it can continue."
                : `JARVIS is waiting for the right current context for {{${pendingWorkflowExecution.missingPlaceholder}}}.`}
            </p>
          </div>
        ) : null}

        <div className="result-card">
          <p className="section-kicker">Conversation Mode</p>
          <h3>Natural Conversation V1</h3>
          <p>
            Talk naturally. JARVIS now tries to interpret phrasing, ask follow-up questions, and
            keep a short thread of the current conversation.
          </p>
          {pendingClarification ? (
            <p className="result-meta">
              Waiting on: {pendingClarification.prompt}
            </p>
          ) : (
            <p className="result-meta">
              No follow-up pending. Try something like “Can you get my study stuff ready?” or
              “Look up React hooks on Google.”
            </p>
          )}
        </div>

        <div className="result-card">
          <p className="section-kicker">Skill Builder Mode</p>
          <h3>
            {skillAutopilotAvailable && autonomousSkillBuildingEnabled
              ? "Autopilot enabled"
              : "Manual review mode"}
          </h3>
          <p>
            JARVIS can now run the missing-skill planning chain on its own and only stop when a
            manual step is actually needed.
          </p>
          {!skillAutopilotAvailable ? (
            <p className="result-meta">
              Autopilot is temporarily disabled. Missing-skill planning stays manual for now.
            </p>
          ) : null}
          <p className="result-meta">Current chain status: {autonomousBuildStatus}</p>
        </div>

        {localVoiceStatus ? (
          <div className="result-card">
            <p className="section-kicker">Local STT</p>
            <h3>{localVoiceStatus.providerName}</h3>
            <p>{localVoiceStatus.message}</p>
            <p className="result-meta">
              Available: {localVoiceStatus.available ? "yes" : "no"} | Configured:{" "}
              {localVoiceStatus.configured ? "yes" : "no"}
            </p>
          </div>
        ) : null}

        {localSpeechStatus ? (
          <div className="result-card">
            <p className="section-kicker">Local TTS</p>
            <h3>{localSpeechStatus.providerName}</h3>
            <p>{localSpeechStatus.message}</p>
            <p className="result-meta">
              Available: {localSpeechStatus.available ? "yes" : "no"} | Configured:{" "}
              {localSpeechStatus.configured ? "yes" : "no"}
            </p>
          </div>
        ) : null}

        {wakeModeStatus ? (
          <div className="result-card">
            <p className="section-kicker">Wake Mode</p>
            <h3>{wakeModeStatus.assistantName}</h3>
            <p>{wakeModeStatus.message}</p>
            <p className="result-meta">
              Enabled: {wakeModeStatus.wakeModeEnabled ? "yes" : "no"} | Listener armed:{" "}
              {wakeListenerActive ? "yes" : "no"}
            </p>
          </div>
        ) : null}

        {googleCalendarStatus ? (
          <div className="result-card">
            <p className="section-kicker">Google Calendar</p>
            <h3>Calendar API</h3>
            <p>{googleCalendarStatus.message}</p>
            <p className="result-meta">
              Configured: {googleCalendarStatus.configured ? "yes" : "no"} | Client ID:{" "}
              {googleCalendarStatus.hasClientId ? "yes" : "no"} | API key:{" "}
              {googleCalendarStatus.hasApiKey ? "yes" : "no"} | Connected:{" "}
              {googleCalendarAccessToken ? "yes" : "no"}
            </p>
            <p className="result-meta">
              Authorized JavaScript origin should include: {window.location.origin}
            </p>
            <p className="result-meta">
              Authorized redirect URI should include: {window.location.origin}/
            </p>
          </div>
        ) : null}

        {googleCalendarStatus ? (
          <div className="result-card">
            <p className="section-kicker">Gmail</p>
            <h3>Inbox access</h3>
            <p>
              Gmail uses the same Google client configuration as Calendar, but asks for a separate
              read-only session.
            </p>
            <p className="result-meta">
              Google configured: {googleCalendarStatus.configured ? "yes" : "no"} | Connected:{" "}
              {gmailAccessToken ? "yes" : "no"}
            </p>
          </div>
        ) : null}

        {spotifyStatus ? (
          <div className="result-card">
            <p className="section-kicker">Spotify</p>
            <h3>Playback control</h3>
            <p>{spotifyStatus.message}</p>
            <p className="result-meta">
              Configured: {spotifyStatus.configured ? "yes" : "no"} | Client ID:{" "}
              {spotifyStatus.hasClientId ? "yes" : "no"} | Connected:{" "}
              {spotifyAccessToken ? "yes" : "no"}
            </p>
            <p className="result-meta">
              Redirect URI to add in Spotify: {window.location.origin}/
            </p>
            {spotifyPlaybackState ? (
              <p className="result-meta">
                {spotifyPlaybackState.isPlaying ? "Playing" : "Paused"}:{" "}
                {spotifyPlaybackState.title ?? "Nothing active"}
                {spotifyPlaybackState.artist ? ` by ${spotifyPlaybackState.artist}` : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        {notionStatus ? (
          <div className="result-card">
            <p className="section-kicker">Notion Notes</p>
            <h3>External notes connected</h3>
            <p>{notionStatus.message}</p>
            <p className="result-meta">
              Available: {notionStatus.available ? "yes" : "no"} | Configured:{" "}
              {notionStatus.configured ? "yes" : "no"} | Token saved:{" "}
              {notionStatus.hasToken ? "yes" : "no"}
            </p>
          </div>
        ) : null}

        {ollamaStatus ? (
          <div className="result-card">
            <p className="section-kicker">Conversation Brain</p>
            <h3>{ollamaStatus.providerName}</h3>
            <p>{ollamaStatus.message}</p>
            <p className="result-meta">
              Backend: {conversationBackend} | Available: {ollamaStatus.available ? "yes" : "no"} |
              Configured: {ollamaStatus.configured ? "yes" : "no"}
            </p>
          </div>
        ) : null}

        {executorStatus ? (
          <div className="result-card">
            <p className="section-kicker">Executor Bridge</p>
            <h3>Local coding runtime</h3>
            <p>{executorStatus.message}</p>
            <p className="result-meta">
              Available: {executorStatus.available ? "yes" : "no"} | Configured:{" "}
              {executorStatus.configured ? "yes" : "no"}
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid-layout">
        <article className="glass-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Active Skills</p>
              <h2>Modular by design</h2>
            </div>
            <span className="badge">{upcomingModules} queued</span>
          </div>

          <div className="skill-list">
            {skills.map((skill) => (
              <div className="skill-card" key={skill.name}>
                <div>
                  <h3>{skill.name}</h3>
                  <p>{skill.description}</p>
                </div>
                <span className={`skill-state ${skill.status}`}>
                  {skill.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Learning Proposals</p>
              <h2>Drafted by observation</h2>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={handleGenerateProposal}
              disabled={isGeneratingProposal}
            >
              {isGeneratingProposal ? "Analyzing..." : "Generate draft"}
            </button>
          </div>

          <div className="memory-list">
            {proposals.length > 0 ? (
              proposals.map((proposal) => (
                <div className="memory-card" key={proposal.id}>
                  <div className="proposal-header">
                    {editingProposalId === proposal.id ? (
                      <input
                        className="inline-input"
                        value={proposal.name}
                        onChange={(event) =>
                          handleProposalFieldChange(proposal.id, "name", event.target.value)
                        }
                      />
                    ) : (
                      <h3>{proposal.name}</h3>
                    )}
                    <span className={`skill-state ${proposal.status === "approved" ? "ready" : "planned"}`}>
                      {proposal.status.replace("_", " ")}
                    </span>
                  </div>
                  {editingProposalId === proposal.id ? (
                    <textarea
                      className="inline-textarea"
                      value={proposal.description}
                      onChange={(event) =>
                        handleProposalFieldChange(
                          proposal.id,
                          "description",
                          event.target.value,
                        )
                      }
                    />
                  ) : (
                    <p>{proposal.description}</p>
                  )}
                  <p className="proposal-reason">{proposal.reasonSummary}</p>
                  {editingProposalId === proposal.id ? (
                    <input
                      className="inline-input trigger-input"
                      value={proposal.triggerPhrase}
                      onChange={(event) =>
                        handleProposalFieldChange(
                          proposal.id,
                          "triggerPhrase",
                          event.target.value,
                        )
                      }
                    />
                  ) : (
                    <span className="memory-meta">
                      Trigger: {proposal.triggerPhrase} | Confidence:{" "}
                      {Math.round(proposal.confidence * 100)}% | Based on {proposal.basedOnCount} sessions
                    </span>
                  )}

                  <div className="proposal-steps">
                    {(proposalSteps[proposal.id] ?? []).length > 0 ? (
                      (proposalSteps[proposal.id] ?? []).map((step) => (
                        <div className="proposal-step" key={step.id}>
                          <span className="proposal-step-label">
                            {step.stepOrder}. {step.actionType}
                          </span>
                          {editingProposalId === proposal.id ? (
                            <input
                              className="inline-input"
                              value={step.actionValue}
                              onChange={(event) =>
                                handleProposalStepChange(
                                  proposal.id,
                                  step.id,
                                  event.target.value,
                                )
                              }
                            />
                          ) : (
                            <span className="memory-meta">{step.actionValue}</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => void loadProposalSteps(proposal.id)}
                      >
                        Show draft steps
                      </button>
                    )}
                  </div>

                  {proposal.status === "pending_review" ? (
                    <div className="proposal-actions">
                      {editingProposalId === proposal.id ? (
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => void handleSaveProposalEdits(proposal.id)}
                        >
                          Save edits
                        </button>
                      ) : (
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            setEditingProposalId(proposal.id);
                            if (!proposalSteps[proposal.id]) {
                              void loadProposalSteps(proposal.id);
                            }
                          }}
                        >
                          Edit draft
                        </button>
                      )}
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => handleProposalDecision(proposal.id, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => handleProposalDecision(proposal.id, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="empty-state">
                No drafted routines yet. Generate one after you have a little activity history.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="grid-layout">
        <article className="glass-panel">
          <p className="section-kicker">Memory Layer</p>
          <h2>Stored routines</h2>
          <div className="memory-list">
            {storedRoutines.length > 0 ? (
              storedRoutines.map((routine) => (
                <div className="memory-card" key={routine.id}>
                  <h3>{routine.name}</h3>
                  <p>{routine.description}</p>
                  <span className="memory-meta">Trigger: {routine.triggerPhrase}</span>
                </div>
              ))
            ) : (
              <p className="empty-state">No routines loaded yet.</p>
            )}
          </div>
        </article>

        <article className="glass-panel">
          <p className="section-kicker">Workflow Memory</p>
          <h2>Saved workflows</h2>
          <p className="memory-meta">
            Placeholders: {"{{input}}"}, {"{{current_email}}"}, {"{{current_pdf}}"}, {"{{current_note}}"}, {"{{current_task}}"}.
          </p>
          <div className="proposal-actions">
            <button className="secondary-button" type="button" onClick={handleExportWorkflows}>
              Export workflows
            </button>
            <button className="secondary-button" type="button" onClick={handleImportWorkflows}>
              Import workflows
            </button>
          </div>
          <textarea
            className="inline-textarea"
            value={workflowImportText}
            onChange={(event) => setWorkflowImportText(event.target.value)}
            placeholder="Workflow JSON export/import..."
          />
          <div className="memory-list">
            {workflowTemplates.map((template) => (
              <div className="memory-card" key={template.id}>
                <h3>{template.name}</h3>
                <p>{template.description}</p>
                <span className="memory-meta">Trigger: {template.triggerPhrase}</span>
                <div className="proposal-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => handleAddWorkflowTemplate(template)}
                  >
                    Add template
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="memory-list">
            {savedWorkflows.length > 0 ? (
              savedWorkflows.map((workflow) => (
                <div className="memory-card" key={workflow.id}>
                  {editingWorkflowId === workflow.id ? (
                    <input
                      className="inline-input"
                      value={workflow.name}
                      onChange={(event) =>
                        handleWorkflowFieldChange(workflow.id, "name", event.target.value)
                      }
                    />
                  ) : (
                    <h3>{workflow.name}</h3>
                  )}
                  {editingWorkflowId === workflow.id ? (
                    <input
                      className="inline-input trigger-input"
                      value={workflow.triggerPhrase}
                      onChange={(event) =>
                        handleWorkflowFieldChange(
                          workflow.id,
                          "triggerPhrase",
                          event.target.value,
                        )
                      }
                    />
                  ) : (
                    <p>Trigger: {workflow.triggerPhrase}</p>
                  )}
                  <div className="proposal-steps">
                    {workflow.steps.map((step, index) => (
                      <div className="proposal-step" key={`${workflow.id}-step-${index}`}>
                        <span className="proposal-step-label">{index + 1}. step</span>
                        {editingWorkflowId === workflow.id ? (
                          <input
                            className="inline-input"
                            value={step}
                            onChange={(event) =>
                              handleWorkflowStepChange(workflow.id, index, event.target.value)
                            }
                          />
                        ) : (
                          <span className="memory-meta">{step}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="memory-meta">
                    Learned from {workflow.basedOnCount} repeats
                  </span>
                  <div className="proposal-actions">
                    {editingWorkflowId === workflow.id ? (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => handleSaveWorkflowEdits(workflow.id)}
                      >
                        Save edits
                      </button>
                    ) : (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setEditingWorkflowId(workflow.id)}
                      >
                        Edit workflow
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">
                No saved workflows yet. Repeat a short multi-step flow a couple of times and
                JARVIS will offer to save it.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="grid-layout single-column">
        <article className="glass-panel">
          <p className="section-kicker">Conversation Thread</p>
          <h2>Recent back-and-forth</h2>
          <div className="conversation-list">
            {conversationTurns.map((turn) => (
              <div className={`conversation-card ${turn.role}`} key={turn.id}>
                <span className="conversation-role">
                  {turn.role === "jarvis" ? "Jarvis" : "You"}
                </span>
                <p>{turn.text}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel">
          <p className="section-kicker">Activity History</p>
          <h2>What JARVIS has seen</h2>
          <div className="memory-list">
            {recentHistory.length > 0 ? (
              recentHistory.map((entry) => (
                <div className="memory-card" key={entry.id}>
                  <h3>{entry.rawCommand}</h3>
                  <p>{entry.executedActions}</p>
                  <span className="memory-meta">
                    Intent: {entry.resolvedIntent} | Status: {entry.actionStatus} | {entry.createdAt}
                  </span>
                </div>
              ))
            ) : (
              <p className="empty-state">No actions logged yet. Run a command to start teaching JARVIS.</p>
            )}
          </div>
        </article>

        <article className="glass-panel">
          <p className="section-kicker">Voice Memory</p>
          <h2>Learned transcript corrections</h2>
          <div className="memory-list">
            {voiceCorrections.length > 0 ? (
              voiceCorrections.map((correction) => (
                <div className="memory-card" key={correction.id}>
                  <h3>{correction.heardPhrase}</h3>
                  <p>{correction.correctedPhrase}</p>
                  <span className="memory-meta">Saved: {correction.createdAt}</span>
                </div>
              ))
            ) : (
              <p className="empty-state">
                No voice corrections saved yet. Use the correction box after a transcript comes in.
              </p>
            )}
          </div>
        </article>

        <article className="glass-panel">
          <p className="section-kicker">Browser Memory</p>
          <h2>Learned site aliases</h2>
          <div className="memory-list">
            {browserAliases.length > 0 ? (
              browserAliases.map((alias) => (
                <div className="memory-card" key={alias.id}>
                  <h3>{alias.phrase}</h3>
                  <p>{alias.url}</p>
                  <span className="memory-meta">Saved: {alias.createdAt}</span>
                </div>
              ))
            ) : (
              <p className="empty-state">
                No browser aliases saved yet. Use the site alias box after a wrong browser guess.
              </p>
            )}
          </div>
        </article>

        <article className="glass-panel">
          <p className="section-kicker">External Notes</p>
          <h2>Recent Notion notes</h2>
          <div className="memory-list">
            {recentNotes.length > 0 ? (
              recentNotes.map((note, index) => (
                <div className="memory-card" key={note.id}>
                  <h3>{index + 1}. {note.title}</h3>
                  <p>{note.summary}</p>
                  <span className="memory-meta">
                    Edited: {note.lastEditedTime}
                  </span>
                </div>
              ))
            ) : (
              <p className="empty-state">
                No Notion notes loaded yet. Try “Make a note to review calculus tonight.”
              </p>
            )}
          </div>
        </article>

        <article className="glass-panel">
          <p className="section-kicker">Planner</p>
          <h2>Task notes</h2>
          <div className="memory-list">
            {plannerTasks.length > 0 ? (
              plannerTasks.map((task, index) => (
                <div className="memory-card" key={task.id}>
                  <h3>{index + 1}. {task.title}</h3>
                  <p>
                    Due: {task.dueLabel ?? "unscheduled"} | Status: {task.status}
                  </p>
                  <span className="memory-meta">
                    Source: {task.sourceNote.title}
                  </span>
                </div>
              ))
            ) : (
              <p className="empty-state">
                No task notes loaded yet. Try “Make a task to call mom tomorrow at 5 PM.”
              </p>
            )}
          </div>
        </article>

        <article className="glass-panel">
          <p className="section-kicker">Inbox</p>
          <h2>Recent Gmail messages</h2>
          <div className="memory-list">
            {recentEmails.length > 0 ? (
              recentEmails.map((email, index) => (
                <div className="memory-card" key={email.id}>
                  <h3>
                    {index + 1}. {email.subject}
                  </h3>
                  <p>{email.from}</p>
                  <p>{email.snippet}</p>
                  <span className="memory-meta">{email.date}</span>
                </div>
              ))
            ) : (
              <p className="empty-state">
                No Gmail messages loaded yet. Try “Show unread emails” after connecting Gmail.
              </p>
            )}
          </div>
        </article>

        <article className="glass-panel">
          <p className="section-kicker">Local Files</p>
          <h2>Recent Documents files</h2>
          <div className="memory-list">
            {recentFiles.length > 0 ? (
              recentFiles.map((file, index) => (
                <div className="memory-card" key={file.path}>
                  <h3>
                    {index + 1}. {file.name}
                  </h3>
                  <p>{file.path}</p>
                  <span className="memory-meta">Modified: {file.modifiedAt}</span>
                </div>
              ))
            ) : (
              <p className="empty-state">
                No recent local files loaded yet. Try “Show recent files” or “Find my resume.”
              </p>
            )}
          </div>
        </article>

        <article className="glass-panel">
          <p className="section-kicker">Build Direction</p>
          <h2>Version 1 focus</h2>
          <ul className="focus-list">
            <li>Desktop app launching and custom routines</li>
            <li>Browser search and website opening</li>
            <li>Calendar capture from natural language</li>
            <li>Time, weather, and daily utility tools</li>
          </ul>
        </article>
      </section>
    </main>
  );
}

export default App;

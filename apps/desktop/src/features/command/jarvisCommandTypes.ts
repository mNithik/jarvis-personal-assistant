import {
  BrowserAliasRecord,
  ConversationInterpretation,
  EmailRecord,
  FileRecord,
  LearnedIntentRecord,
  NoteRecord,
  SkillBuildRequest,
  VoiceCorrectionRecord,
} from "../../types/jarvis";
import { ConversationBackend, SpeechOutputBackend, VoiceBackend } from "../../types/voice";
import type { GatewayConfig, GatewayPreview, IntegrationHandoff } from "../../services/jarvisApi";
import type { GoogleCalendarEventRecord } from "../../services/googleCalendar";
import type { SpotifyPlaybackState } from "../../services/spotify";

export type ConversationBackendComparison = {
  prompt: string;
  heuristics: string;
  heuristicsAction: string;
  ollama: string;
  ollamaAction: string;
  autoRouteLabel: string;
  autoDecision: string;
  autoReason: string;
};

export type ConversationTurn = {
  id: number;
  role: "user" | "jarvis";
  text: string;
  routeLabel?: string;
};

export type VoiceReplyMode = "quiet" | "brief" | "normal" | "detailed";

export type AssistantDefaults = {
  voiceBackend: VoiceBackend;
  speechOutputBackend: SpeechOutputBackend;
  voiceAutoRouteEnabled: boolean;
  conversationBackend: ConversationBackend;
  voiceReplyMode: VoiceReplyMode;
  voiceResponseEnabled: boolean;
};

export const RECOMMENDED_ASSISTANT_DEFAULTS: AssistantDefaults = {
  voiceBackend: "browser",
  speechOutputBackend: "browser",
  voiceAutoRouteEnabled: false,
  conversationBackend: "auto",
  voiceReplyMode: "normal",
  voiceResponseEnabled: true,
};

export type ModelProviderId =
  | "local_ollama"
  | "lm_studio"
  | "nvidia_nim"
  | "gemini"
  | "groq"
  | "openrouter"
  | "huggingface"
  | "openai"
  | "anthropic";

export type ModelTaskType =
  | "general_chat"
  | "coding"
  | "reasoning"
  | "private_memory"
  | "draft";

export type ModelProviderConfig = {
  providerId: ModelProviderId;
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  codingModel: string;
  reasoningModel: string;
};

export type ModelRouterConfig = {
  defaultProvider: ModelProviderId;
  codingProvider: ModelProviderId;
  reasoningProvider: ModelProviderId;
  privateProvider: ModelProviderId;
  enablePaidProviders: boolean;
  maxMonthlyApiSpend: number;
  allowCloudForPrivateMemory: boolean;
  experimentalLocalReasoningModel: string;
  providers: Record<ModelProviderId, ModelProviderConfig>;
};

export type ModelRouteDecision = {
  taskType: ModelTaskType;
  providerId: ModelProviderId;
  model: string;
  baseUrl: string;
  blocked: boolean;
  reason: string;
};

export type GeneratedModelDraft = {
  id: string;
  prompt: string;
  taskType: ModelTaskType;
  providerId: ModelProviderId;
  model: string;
  text: string;
  latencyMs: number;
  createdAt: string;
};

export type ModelRouterTestResult = {
  providerId: ModelProviderId;
  model: string;
  ok: boolean;
  message: string;
  latencyMs?: number;
  checkedAt: string;
};

export type ModelProviderUsageRecord = {
  id: string;
  providerId: ModelProviderId;
  model: string;
  taskType: ModelTaskType;
  prompt: string;
  ok: boolean;
  latencyMs: number | null;
  totalTokens: number | null;
  createdAt: string;
  errorMessage?: string;
};

export type ModelBenchmarkResult = {
  id: string;
  providerId: ModelProviderId;
  model: string;
  ok: boolean;
  latencyMs: number | null;
  message: string;
  checkedAt: string;
};

export type ModelComparisonResult = {
  id: string;
  providerId: ModelProviderId;
  model: string;
  ok: boolean;
  text: string;
  latencyMs: number | null;
  errorMessage?: string;
};

export type ModelComparisonRun = {
  prompt: string;
  taskType: ModelTaskType;
  createdAt: string;
  results: ModelComparisonResult[];
};

export type PersonMemoryRecord = {
  id: string;
  name: string;
  birthdayLabel: string;
  month: number;
  day: number;
  age: number | null;
  relationship: string | null;
  giftNotes: string[];
  contactNotes: string[];
  lastContactLabel: string | null;
  followUpDueLabel: string | null;
  followUpReason: string | null;
  reminderLeadDays: number;
  calendarLinkedAt: string | null;
  source: "manual" | "gmail";
  createdAt: string;
  updatedAt: string;
};

export type TravelMemoryRecord = {
  id: string;
  title: string;
  sourceEmailSubject: string;
  transport: string | null;
  departure: string | null;
  arrival: string | null;
  hotel: string | null;
  checkIn: string | null;
  checkOut: string | null;
  confirmationCode: string | null;
  calendarLinkedAt: string | null;
  segmentCount: number;
  timeline: string[];
  checklist: string[];
  summary: string;
  createdAt: string;
};

export type TravelExtraction = {
  transport: string[];
  departures: string[];
  arrivals: string[];
  hotels: string[];
  checkIns: string[];
  checkOuts: string[];
  stays: string[];
  bookings: string[];
  addresses: string[];
  dates: string[];
  confirmationCodes: string[];
};

export type ExpenseMemoryRecord = {
  id: string;
  title: string;
  sourceEmailSubject: string;
  merchant: string | null;
  amount: string | null;
  amountValue: number | null;
  category: string | null;
  expenseDate: string | null;
  orderNumber: string | null;
  recurringLikely: boolean;
  summary: string;
  createdAt: string;
};

export type ExpenseExtraction = {
  merchants: string[];
  amounts: string[];
  categories: string[];
  dates: string[];
  orderNumbers: string[];
  notes: string[];
  normalizedCategory: string | null;
  primaryAmountValue: number | null;
  primaryDate: string | null;
  recurringLikely: boolean;
};

export type PackageMemoryRecord = {
  id: string;
  title: string;
  sourceEmailSubject: string;
  carrier: string | null;
  merchant: string | null;
  itemLabel: string | null;
  status: string | null;
  deliveryDate: string | null;
  trackingNumber: string | null;
  statusHistory: string[];
  arrivingToday: boolean;
  arrivingTomorrow: boolean;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

export type PackageExtraction = {
  carriers: string[];
  merchants: string[];
  items: string[];
  statuses: string[];
  deliveryDates: string[];
  trackingNumbers: string[];
  addresses: string[];
  notes: string[];
};

export type MeetingPrepMemoryRecord = {
  id: string;
  eventTitle: string;
  summaryTitle: string;
  focusSummary: string;
  actionItems: string[];
  relatedPeople: string[];
  changesSinceLastPrep: string | null;
  summary: string;
  createdAt: string;
};

export type SchoolPlanMemoryRecord = {
  id: string;
  title: string;
  focusSummary: string;
  subjects: string[];
  sessions: string[];
  assignments: string[];
  examCountdowns: string[];
  summary: string;
  createdAt: string;
};

export type DesktopProjectRecord = {
  id: string;
  name: string;
  apps: string[];
  folders: string[];
  websites: string[];
  createdAt: string;
  updatedAt: string;
};

export type DesktopScheduleRecord = {
  id: string;
  projectName: string;
  actionLabel: string;
  dueAt: string;
  createdAt: string;
};

export type DesktopPermissionSettings = {
  confirmProjectChecks: boolean;
  confirmAppClose: boolean;
  confirmExecutorLaunch: boolean;
};

export type OcrScope = "screen" | "active_window" | "app_window" | "region" | "rect" | "global_selection";

export type OcrCaptureTarget = {
  scope?: OcrScope;
  appName?: string;
  region?: OcrRegion;
  rect?: OcrRect;
  useLast?: boolean;
};

export type OcrSnapshot = {
  screenshotPath: string;
  ocrText: string;
};

export type OcrHistoryMeta = {
  source?: string;
  matchType?: string;
  watchMatch?: boolean;
};
export type OcrRegion =
  | "selected"
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top left"
  | "top right"
  | "bottom left"
  | "bottom right";

export type OcrWatchTarget = {
  id: string;
  name: string;
  scope: OcrScope;
  appName?: string;
  region?: OcrRegion;
  rect?: OcrRect;
  status: "active" | "paused";
  intervalMs: number;
  logToNotion?: boolean;
  createTaskOnMatch?: boolean;
  action?: OcrWatchAction;
  rule?: OcrWatchRule;
  lastText?: string;
  lastMatchKey?: string;
  lastCheckedAt?: string;
};

export type OcrWatchAction =
  | { type: "open_app"; appName: string }
  | { type: "open_workspace"; query: string }
  | { type: "copy_text" };

export type OcrWatchRule = {
  type: "any_change" | "keyword" | "error" | "price" | "price_below" | "price_above";
  keyword?: string;
  amount?: number;
};

export type OcrRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrHistoryRecord = {
  id: string;
  target: string;
  text: string;
  summary: string;
  screenshotPath: string;
  createdAt: string;
  source?: string;
  matchType?: string;
};

export type OcrHistoryFilter = {
  query?: string;
  source?: string;
  since?: Date;
  label: string;
};

export type OcrCorrectionRecord = {
  from: string;
  to: string;
  createdAt: string;
};

export type OcrWatchTemplate = {
  name: string;
  rule?: OcrWatchRule;
  intervalMs: number;
  logToNotion?: boolean;
  createTaskOnMatch?: boolean;
  action?: OcrWatchAction;
};

export type OcrSelectionState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  viewStartX: number;
  viewStartY: number;
  viewCurrentX: number;
  viewCurrentY: number;
} | null;

export type JarvisPanelId =
  | "ocr"
  | "voice"
  | "workspaces"
  | "memory"
  | "integrations"
  | "automation"
  | "builder";

export type JarvisHomeAppId =
  | "command"
  | "vision"
  | "memory"
  | "automation"
  | "workspaces"
  | "connections"
  | "models"
  | "builder";

export type JarvisModuleDescriptor = {
  id: JarvisPanelId;
  name: string;
  description: string;
  accent: string;
};

export type JarvisPanelRecord = {
  id: JarvisPanelId;
  x: number;
  y: number;
  minimized: boolean;
};

export type PanelDragState = {
  id: JarvisPanelId;
  offsetX: number;
  offsetY: number;
} | null;

export type ShellBarPlacement = "bottom" | "top" | "free";

export type ShellBarDragState = {
  offsetX: number;
  offsetY: number;
} | null;

export type JarvisUiPreferences = {
  shellBarVisible: boolean;
  shellBarPlacement: ShellBarPlacement;
  shellBarPosition: { x: number; y: number };
  cockpitMode: boolean;
  activeHomeApp: JarvisHomeAppId;
};

export type CommandIntent =
  | { kind: "study_setup" }
  | { kind: "launch_desktop_app"; appName: string }
  | { kind: "focus_desktop_app"; appName: string }
  | { kind: "open_named_folder"; folderName: string }
  | { kind: "capture_desktop_screenshot" }
  | { kind: "open_screenshots_folder" }
  | { kind: "read_clipboard_text" }
  | { kind: "write_clipboard_text"; text: string }
  | { kind: "open_clipboard_target" }
  | { kind: "search_clipboard_on_google" }
  | { kind: "save_clipboard_to_notion" }
  | { kind: "create_desktop_project"; name: string }
  | { kind: "create_desktop_project_template"; templateName: string; projectName: string }
  | { kind: "list_desktop_projects" }
  | { kind: "open_desktop_project"; query: string }
  | { kind: "add_app_to_desktop_project"; projectQuery: string; appName: string }
  | { kind: "add_folder_to_desktop_project"; projectQuery: string; folderName: string }
  | { kind: "add_website_to_desktop_project"; projectQuery: string; url: string }
  | { kind: "rename_desktop_project"; projectQuery: string; newName: string }
  | { kind: "delete_desktop_project"; projectQuery: string }
  | { kind: "remove_app_from_desktop_project"; projectQuery: string; appName: string }
  | { kind: "remove_folder_from_desktop_project"; projectQuery: string; folderName: string }
  | { kind: "remove_website_from_desktop_project"; projectQuery: string; url: string }
  | { kind: "schedule_desktop_project"; query: string; whenLabel: string; dueAt: Date }
  | { kind: "start_desktop_project_for_duration"; query: string; durationMinutes: number }
  | { kind: "list_desktop_schedules" }
  | { kind: "save_screenshot_to_notion" }
  | { kind: "save_last_screenshot_to_notion" }
  | { kind: "read_screen_text"; useLast?: boolean; scope?: OcrScope; appName?: string; region?: OcrRegion; rect?: OcrRect }
  | { kind: "save_screen_text_to_notion"; scope?: OcrScope; appName?: string; region?: OcrRegion; rect?: OcrRect }
  | { kind: "create_screen_task_list"; scope?: OcrScope; appName?: string; region?: OcrRegion; rect?: OcrRect; confirmed?: boolean; taskTitles?: string[] }
  | { kind: "start_ocr_watch"; scope?: OcrScope; appName?: string; region?: OcrRegion; rect?: OcrRect; intervalMs: number; logToNotion?: boolean; createTaskOnMatch?: boolean; action?: OcrWatchAction; rule?: OcrWatchRule }
  | { kind: "stop_ocr_watch" }
  | { kind: "pause_ocr_watches" }
  | { kind: "resume_ocr_watches" }
  | { kind: "show_ocr_watches" }
  | { kind: "name_latest_ocr_watch"; name: string }
  | { kind: "pause_ocr_watch_by_name"; name: string }
  | { kind: "resume_ocr_watch_by_name"; name: string }
  | { kind: "delete_ocr_watch_by_name"; name: string }
  | { kind: "save_latest_ocr_watch_template"; name: string }
  | { kind: "start_ocr_watch_template"; templateName: string; appName: string }
  | { kind: "begin_ocr_region_selection" }
  | { kind: "begin_app_ocr_region_selection" }
  | { kind: "show_ocr_history" }
  | { kind: "search_ocr_history"; query?: string; source?: string; since?: Date; label: string }
  | { kind: "save_ocr_history_to_notion" }
  | { kind: "clear_ocr_history" }
  | { kind: "export_ocr_history_to_clipboard" }
  | { kind: "copy_latest_ocr_text" }
  | { kind: "correct_ocr_text"; from: string; to: string }
  | { kind: "remember_latest_ocr" }
  | { kind: "summarize_screen"; mode: "brief" | "error" | "study_notes" | "flashcards"; scope?: OcrScope; appName?: string }
  | { kind: "cleanup_clipboard"; mode: "clean" | "summarize" | "format" }
  | { kind: "run_project_checks"; confirmed?: boolean }
  | { kind: "open_project_in_vscode" }
  | { kind: "minimize_jarvis_window" }
  | { kind: "maximize_jarvis_window" }
  | { kind: "restore_jarvis_window" }
  | { kind: "control_desktop_app_window"; appName: string; action: "minimize" | "maximize" | "close"; confirmed?: boolean }
  | { kind: "check_desktop_app_window_status"; appName: string }
  | { kind: "show_desktop_permissions" }
  | { kind: "set_desktop_permission"; permission: keyof DesktopPermissionSettings; enabled: boolean }
  | { kind: "open_jarvis_panel"; panel: JarvisPanelId }
  | { kind: "close_jarvis_panel"; panel?: JarvisPanelId }
  | { kind: "minimize_jarvis_panel"; panel?: JarvisPanelId }
  | { kind: "set_shell_bar"; visible: boolean }
  | { kind: "set_cockpit_mode"; active: boolean }
  | { kind: "set_home_app"; app: JarvisHomeAppId }
  | { kind: "set_conversation_backend"; backend: ConversationBackend }
  | { kind: "test_model_provider"; providerId: ModelProviderId }
  | { kind: "generate_model_draft"; prompt: string; taskType?: ModelTaskType; confirmedCloud?: boolean }
  | { kind: "explain_model_route"; prompt: string }
  | { kind: "copy_latest_model_draft" }
  | { kind: "save_latest_model_draft_to_notion" }
  | { kind: "run_model_benchmark" }
  | { kind: "compare_model_responses"; prompt: string }
  | { kind: "choose_model_comparison_winner"; providerId: ModelProviderId; taskType?: ModelTaskType }
  | { kind: "recommend_model_routes" }
  | { kind: "set_model_provider_for_task"; taskType: "chat" | "coding" | "reasoning"; providerId: ModelProviderId }
  | { kind: "set_private_model_mode"; localOnly: boolean }
  | { kind: "open_last_desktop_context" }
  | { kind: "export_desktop_projects_to_clipboard" }
  | { kind: "import_desktop_projects_from_clipboard" }
  | { kind: "create_screen_task" }
  | { kind: "create_builder_handoff"; request: string; launchExecutor: boolean; confirmed?: boolean }
  | { kind: "google_search"; query: string }
  | { kind: "open_url"; url: string }
  | { kind: "create_note"; content: string }
  | {
      kind: "remember_person_birthday";
      name: string;
      birthdayLabel: string;
      month: number;
      day: number;
      age?: number | null;
      relationship?: string | null;
      reminderLeadDays?: number | null;
      addToCalendar?: boolean;
    }
  | { kind: "list_birthdays" }
  | { kind: "list_upcoming_birthdays" }
  | { kind: "show_person_birthday"; query: string }
  | { kind: "update_person_relationship"; query: string; relationship: string }
  | { kind: "update_person_age"; query: string; age: number }
  | { kind: "add_person_gift_note"; query: string; note: string }
  | { kind: "add_person_contact_note"; query: string; note: string }
  | { kind: "set_person_last_contact"; query: string; whenLabel: string }
  | { kind: "set_person_follow_up"; query: string; dueLabel: string; reason: string | null }
  | { kind: "list_people_follow_ups" }
  | { kind: "list_people_check_ins" }
  | { kind: "set_person_birthday_reminder"; query: string; daysBefore: number }
  | { kind: "add_person_birthday_to_calendar"; query: string }
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
  | { kind: "list_today_calendar_events" }
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
  | { kind: "spotify_play_query"; query: string }
  | { kind: "spotify_play_artist"; query: string }
  | { kind: "spotify_play_playlist"; query: string }
  | { kind: "spotify_play_album"; query: string }
  | { kind: "spotify_pause" }
  | { kind: "spotify_next" }
  | { kind: "spotify_previous" }
  | { kind: "spotify_status" }
  | { kind: "spotify_queue_query"; query: string }
  | { kind: "spotify_like_current" }
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
  | { kind: "save_current_email_travel_to_calendar" }
  | { kind: "save_email_travel_to_calendar_by_index"; index: number }
  | { kind: "save_email_travel_to_calendar_by_query"; query: string }
  | { kind: "show_current_travel_checklist" }
  | { kind: "show_current_travel_timeline" }
  | { kind: "extract_current_email_expense" }
  | { kind: "extract_email_expense"; index: number | null }
  | { kind: "extract_email_expense_by_query"; query: string }
  | { kind: "save_current_email_expense_to_notion" }
  | { kind: "save_email_expense_to_notion_by_index"; index: number }
  | { kind: "save_email_expense_to_notion_by_query"; query: string }
  | { kind: "list_weekly_expenses" }
  | { kind: "list_monthly_expenses" }
  | { kind: "list_monthly_expenses_by_category"; category: string }
  | { kind: "list_recurring_expenses" }
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
  | { kind: "list_packages_arriving_tomorrow" }
  | { kind: "list_delayed_packages" }
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

export type ClarificationChoice = {
  label: string;
  intent: CommandIntent;
};

export type IntentConfidence = "high" | "medium" | "low";

export type PendingClarification = {
  prompt: string;
  choices: ClarificationChoice[];
  originalPhrase?: string;
  confidence?: IntentConfidence;
  confidenceScore?: number;
  suggestedLearning?: {
    originalPhrase: string;
    sourcePhrase: string;
    intent: CommandIntent;
    confidence: IntentConfidence;
    confidenceScore: number;
    familyLabel: string;
    familyPhraseCount: number;
  };
  suggestedWorkflow?: {
    workflowId: string;
    workflowName: string;
    triggerPhrase: string;
    candidateId: string;
    candidateLabel: string;
    confidence: IntentConfidence;
    confidenceScore: number;
  };
  suggestedSemanticIntent?: {
    candidateId: string;
    candidateLabel: string;
    confidence: IntentConfidence;
    confidenceScore: number;
  };
};

export type UserPreferenceMemory = {
  noteApp: "notion";
  musicProvider: "spotify" | null;
  defaultWorkspaceName: string | null;
};

export type SemanticConversationMemoryRecord = {
  id: string;
  text: string;
  summary: string;
  intentKind: string | null;
  contextLabel: string | null;
  embedding: number[];
  embeddingBackend: EmbeddingBackend;
  createdAt: string;
};

export type EmbeddingBackend = "local" | "ollama" | "transformers";
export type TransformersEmbeddingExtractor = {
  (input: string, options: { pooling: "mean"; normalize: boolean }): Promise<unknown>;
};

export type NaturalConversationResolution =
  | {
      kind: "reply";
      title: string;
      detail: string;
      spoken: string;
    }
  | {
      kind: "intent";
      intent: CommandIntent;
    };

export type SemanticIntentCandidate =
  | {
      id: string;
      source: "builtin" | "learned";
      label: string;
      examples: string[];
      resolve: (command: string) => CommandIntent | null;
      previewIntent: CommandIntent;
      weight?: number;
      highThreshold?: number;
      mediumThreshold?: number;
    }
  | {
      id: string;
      source: "workflow";
      label: string;
      examples: string[];
      workflow: SavedWorkflowRecord;
      weight?: number;
      highThreshold?: number;
      mediumThreshold?: number;
    };

export type SemanticIntentRank = {
  candidate: SemanticIntentCandidate;
  score: number;
  confidence: IntentConfidence;
  matchedExample: string;
};

export type SemanticIntentFeedbackRecord = {
  id: string;
  phrase: string;
  normalizedPhrase: string;
  candidateId: string;
  candidateLabel: string;
  accepted: boolean;
  createdAt: string;
};

export type SemanticIntentDebugMatch = {
  id: string;
  label: string;
  source: SemanticIntentCandidate["source"];
  score: number;
  confidence: IntentConfidence;
  matchedExample: string;
};

export type ConversationTopicRecord = {
  phrase: string;
  intentLabel: string;
  actionType: string;
  contextLabel: string | null;
  createdAt: string;
};

export type ConversationContextStackEntry = ActiveConversationContext & {
  lastUsedAt: string;
};

export type TrainingModeSession = {
  targetCount: number;
  currentIndex: number;
  phase: "awaiting_phrase" | "awaiting_meaning";
  pendingPhrase: string | null;
  learnedExamples: Array<{
    phrase: string;
    meaning: string;
    label: string;
  }>;
};

export type TeachingInstruction =
  | {
      kind: "teach_phrase";
      phrase: string;
      meaning: string;
    }
  | {
      kind: "teach_workflow";
      phrase: string;
      steps: string[];
    }
  | {
      kind: "set_music_provider";
      provider: "spotify";
    }
  | {
      kind: "set_note_app";
      app: "notion";
    }
  | {
      kind: "set_default_workspace";
      workspaceName: string;
    };

export type CorrectionInstruction =
  | {
      kind: "correct_phrase";
      meaning: string;
    }
  | {
      kind: "correct_workflow";
      steps: string[];
    };

export type FollowUpWindow = {
  active: boolean;
  reason: "wake" | "reply" | "clarification";
};

export const FOLLOW_UP_WINDOW_MS = 12000;

export type PlannerTaskRecord = {
  id: string;
  title: string;
  dueLabel: string | null;
  dueDate: Date | null;
  status: "today" | "upcoming" | "overdue" | "unscheduled" | "done";
  sourceNote: NoteRecord;
};

export type EmailSignals = {
  deadlines: string[];
  birthdays: string[];
  meetings: string[];
  addresses: string[];
  reminders: string[];
};

export type PdfTaskCandidate = {
  title: string;
  dueLabel: string | null;
};

export type ActiveConversationContext =
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
    }
  | {
      kind: "desktop_app";
      appName: string;
      label: string;
    }
  | {
      kind: "desktop_folder";
      folderName: string;
      label: string;
    }
  | {
      kind: "desktop_workspace";
      projectName: string;
      label: string;
    }
  | {
      kind: "screenshot";
      path: string;
      label: string;
    };

export type PresentedCollectionContext =
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

export type ModelInterpretationResult =
  | { kind: "intent"; intent: CommandIntent }
  | { kind: "clarification"; prompt: string }
  | { kind: "unsupported" };

export type RunCommandOutcome =
  | { status: "completed" }
  | { status: "empty" }
  | { status: "clarification" }
  | { status: "missing_skill" }
  | { status: "failed" };

export type SavedWorkflowRecord = {
  id: string;
  name: string;
  triggerPhrase: string;
  steps: string[];
  createdAt: string;
  basedOnCount: number;
};

export type WorkflowSuggestionRecord = {
  signature: string;
  name: string;
  triggerPhrase: string;
  steps: string[];
  basedOnCount: number;
  sampleCommand: string;
};

export type WorkflowTemplateRecord = {
  id: string;
  name: string;
  description: string;
  triggerPhrase: string;
  steps: string[];
};

export type CrossFeatureSuggestionRecord = {
  id: string;
  title: string;
  detail: string;
  intent?: CommandIntent;
  intents?: CommandIntent[];
};

export type WorkflowStepResolution =
  | { action: "run"; step: string }
  | { action: "skip" }
  | { action: "stop" };

export type PendingWorkflowExecution =
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

export const builtInBrowserAliases: Record<string, string> = {
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

export const canonicalHostRoots: Record<string, string> = {
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

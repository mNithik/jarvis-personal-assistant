import type { GatewayFeatures } from "../../services/jarvisApi";
import type { CommandIntent } from "./jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "./commandRouterTypes";
import { blockLegacyGatewayFeature, isGatewayFeatureActive } from "./gatewayLegacyGuard";

type GatewayFeatureKey = keyof GatewayFeatures;

type IntentGuardSpec = {
  label: string;
  feature?: GatewayFeatureKey;
  /** Block legacy when gateway is enabled (no per-feature flag). */
  gatewayOnly?: boolean;
};

const INTENT_GATEWAY_GUARD: Partial<Record<CommandIntent["kind"], IntentGuardSpec>> = {
  study_setup: { feature: "studyRoutine", label: "Study setup" },
  launch_desktop_app: { feature: "studyRoutine", label: "Desktop launch" },
  focus_desktop_app: { feature: "studyRoutine", label: "Desktop focus" },
  open_named_folder: { feature: "studyRoutine", label: "Folder open" },
  google_search: { feature: "studyRoutine", label: "Search" },
  open_url: { feature: "studyRoutine", label: "Browser" },
  open_jarvis_panel: { feature: "studyRoutine", label: "Shell panel" },
  close_jarvis_panel: { feature: "studyRoutine", label: "Shell panel" },
  minimize_jarvis_panel: { feature: "studyRoutine", label: "Shell panel" },
  minimize_jarvis_window: { feature: "studyRoutine", label: "Window" },
  maximize_jarvis_window: { feature: "studyRoutine", label: "Window" },
  restore_jarvis_window: { feature: "studyRoutine", label: "Window" },
  read_screen_text: { feature: "screenOcr", label: "Screen OCR" },
  capture_desktop_screenshot: { feature: "screenOcr", label: "Screenshot" },
  summarize_screen: { feature: "screenOcr", label: "Screen summary" },
  create_screen_task_list: { feature: "screenOcr", label: "Screen tasks" },
  create_screen_task: { feature: "screenOcr", label: "Screen task" },
  save_screen_text_to_notion: { feature: "ocrNotion", label: "OCR to Notion" },
  start_ocr_watch: { feature: "ocrNotion", label: "OCR watch" },
  stop_ocr_watch: { feature: "ocrNotion", label: "OCR watch" },
  name_latest_ocr_watch: { feature: "ocrNotion", label: "OCR watch" },
  pause_ocr_watch_by_name: { feature: "ocrNotion", label: "OCR watch" },
  resume_ocr_watch_by_name: { feature: "ocrNotion", label: "OCR watch" },
  delete_ocr_watch_by_name: { feature: "ocrNotion", label: "OCR watch" },
  save_latest_ocr_watch_template: { feature: "ocrNotion", label: "OCR watch" },
  start_ocr_watch_template: { feature: "ocrNotion", label: "OCR watch" },
  pause_ocr_watches: { feature: "ocrNotion", label: "OCR watch" },
  resume_ocr_watches: { feature: "ocrNotion", label: "OCR watch" },
  show_ocr_watches: { feature: "ocrNotion", label: "OCR watch" },
  show_ocr_history: { feature: "ocrNotion", label: "OCR history" },
  search_ocr_history: { feature: "ocrNotion", label: "OCR history" },
  save_ocr_history_to_notion: { feature: "ocrNotion", label: "OCR to Notion" },
  list_unread_emails: { feature: "gmail", label: "Gmail" },
  search_emails: { feature: "gmail", label: "Gmail" },
  read_email_by_index: { feature: "gmail", label: "Gmail" },
  read_email_by_query: { feature: "gmail", label: "Gmail" },
  extract_email_signals_by_query: { feature: "gmail", label: "Gmail" },
  create_calendar_event: { feature: "calendar", label: "Google Calendar" },
  list_today_calendar_events: { feature: "calendar", label: "Google Calendar" },
  create_reminder: { feature: "calendar", label: "Google Calendar" },
  create_calendar_event_from_email: { feature: "calendar", label: "Google Calendar" },
  create_calendar_event_from_current_email: { feature: "calendar", label: "Google Calendar" },
  create_calendar_event_from_email_query: { feature: "calendar", label: "Google Calendar" },
  save_latest_email_to_notion: { feature: "emailNotion", label: "Email to Notion" },
  save_current_email_to_notion: { feature: "emailNotion", label: "Email to Notion" },
  save_email_digest_to_notion: { feature: "emailNotion", label: "Email to Notion" },
  save_first_emails_to_notion: { feature: "emailNotion", label: "Email to Notion" },
  save_email_range_to_notion: { feature: "emailNotion", label: "Email to Notion" },
  save_email_to_notion_by_index: { feature: "emailNotion", label: "Email to Notion" },
  save_email_to_notion_by_query: { feature: "emailNotion", label: "Email to Notion" },
  save_current_email_travel_to_notion: { feature: "emailNotion", label: "Email to Notion" },
  save_email_travel_to_notion_by_index: { feature: "emailNotion", label: "Email to Notion" },
  save_email_travel_to_notion_by_query: { feature: "emailNotion", label: "Email to Notion" },
  save_current_email_expense_to_notion: { feature: "emailNotion", label: "Email to Notion" },
  save_email_expense_to_notion_by_index: { feature: "emailNotion", label: "Email to Notion" },
  save_email_expense_to_notion_by_query: { feature: "emailNotion", label: "Email to Notion" },
  save_current_email_package_to_notion: { feature: "emailNotion", label: "Email to Notion" },
  save_email_package_to_notion_by_index: { feature: "emailNotion", label: "Email to Notion" },
  save_email_package_to_notion_by_query: { feature: "emailNotion", label: "Email to Notion" },
  search_files: { gatewayOnly: true, label: "Local files" },
  list_recent_files: { gatewayOnly: true, label: "Local files" },
  open_file: { gatewayOnly: true, label: "Local files" },
  read_clipboard_text: { gatewayOnly: true, label: "Clipboard" },
  write_clipboard_text: { gatewayOnly: true, label: "Clipboard" },
  open_clipboard_target: { gatewayOnly: true, label: "Clipboard" },
  search_clipboard_on_google: { gatewayOnly: true, label: "Clipboard" },
  save_clipboard_to_notion: { gatewayOnly: true, label: "Clipboard" },
  cleanup_clipboard: { gatewayOnly: true, label: "Clipboard" },
  summarize_current_pdf: { gatewayOnly: true, label: "PDF summarize" },
  summarize_pdf_by_index: { gatewayOnly: true, label: "PDF summarize" },
  summarize_pdf_by_query: { gatewayOnly: true, label: "PDF summarize" },
  summarize_all_loaded_pdfs: { gatewayOnly: true, label: "PDF summarize" },
  summarize_pdf_range: { gatewayOnly: true, label: "PDF summarize" },
  remember_person_birthday: { feature: "memory", label: "Memory" },
  list_birthdays: { feature: "memory", label: "Memory" },
  list_upcoming_birthdays: { feature: "memory", label: "Memory" },
  show_person_birthday: { feature: "memory", label: "Memory" },
  list_travel_memory: { feature: "memory", label: "Memory" },
  show_current_travel_checklist: { feature: "memory", label: "Memory" },
  list_expense_memory: { feature: "memory", label: "Memory" },
  list_weekly_expenses: { feature: "memory", label: "Memory" },
  list_monthly_expenses: { feature: "memory", label: "Memory" },
  list_monthly_expenses_by_category: { feature: "memory", label: "Memory" },
  list_recurring_expenses: { feature: "memory", label: "Memory" },
  list_package_memory: { feature: "memory", label: "Memory" },
  list_packages_arriving_tomorrow: { feature: "memory", label: "Memory" },
  list_delayed_packages: { feature: "memory", label: "Memory" },
  list_meeting_prep_memory: { feature: "memory", label: "Memory" },
  create_daily_brief: { feature: "memory", label: "Daily brief" },
  create_note: { feature: "notion", label: "Notion" },
  create_task_note: { feature: "notion", label: "Notion" },
  list_notes: { feature: "notion", label: "Notion" },
  search_notes: { feature: "notion", label: "Notion" },
  spotify_play: { feature: "spotify", label: "Spotify" },
  spotify_play_query: { feature: "spotify", label: "Spotify" },
  spotify_play_artist: { feature: "spotify", label: "Spotify" },
  spotify_play_playlist: { feature: "spotify", label: "Spotify" },
  spotify_play_album: { feature: "spotify", label: "Spotify" },
  spotify_pause: { feature: "spotify", label: "Spotify" },
  spotify_next: { feature: "spotify", label: "Spotify" },
  spotify_previous: { feature: "spotify", label: "Spotify" },
  spotify_status: { feature: "spotify", label: "Spotify" },
  spotify_queue_query: { feature: "spotify", label: "Spotify" },
  spotify_like_current: { feature: "spotify", label: "Spotify" },
  create_builder_handoff: { feature: "builder", label: "Builder handoff" },
};

function isGatewayGuardActive(
  deps: ResolvedCommandRouterDeps,
  guard: IntentGuardSpec,
): boolean {
  if (guard.gatewayOnly) {
    return Boolean(deps.gatewayConfig?.enabled);
  }
  if (!guard.feature) {
    return false;
  }
  return isGatewayFeatureActive(deps.gatewayConfig, guard.feature);
}

function guardLabelForIntent(intent: CommandIntent): string {
  return INTENT_GATEWAY_GUARD[intent.kind]?.label ?? "This command";
}

/** When gateway owns this intent, block legacy TS execution. */
export function blockLegacyIntent(
  deps: ResolvedCommandRouterDeps,
  intent: CommandIntent,
): boolean {
  const guard = INTENT_GATEWAY_GUARD[intent.kind];
  if (!guard || !isGatewayGuardActive(deps, guard)) {
    return false;
  }

  if (guard.feature) {
    return blockLegacyGatewayFeature(deps, guard.feature, guard.label);
  }

  const detail = `${guard.label} runs through the JARVIS gateway when it is enabled. Say the command again or check gateway settings.`;
  deps.setCommandResult({
    title: `${guard.label} (gateway)`,
    detail,
  });
  deps.setStatusMessage(detail);
  deps.setVoiceSessionPhase("ready");
  deps.appendConversationTurn("jarvis", detail);
  deps.speakIfEnabled(detail);
  return true;
}

/** Gateway-owned intent with gateway disabled — legacy bodies are intentionally removed. */
export function legacyFallbackMessage(
  deps: ResolvedCommandRouterDeps,
  intent: CommandIntent,
): void {
  const label = guardLabelForIntent(intent);
  const detail = `${label} is handled by the JARVIS gateway. Enable the gateway in settings, then try again.`;
  deps.setCommandResult({
    title: `${label} (gateway required)`,
    detail,
  });
  deps.setStatusMessage(detail);
  deps.setVoiceSessionPhase("ready");
  deps.appendConversationTurn("jarvis", detail);
  deps.speakIfEnabled(detail);
}

export function isGatewayOwnedIntentKind(kind: CommandIntent["kind"]): boolean {
  return kind in INTENT_GATEWAY_GUARD;
}

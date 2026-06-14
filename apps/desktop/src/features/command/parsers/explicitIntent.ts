import type { BrowserAliasRecord, EmailRecord, FileRecord, NoteRecord } from "../../../types/jarvis";
import type {
  ActiveConversationContext,
  CommandIntent,
  DesktopPermissionSettings,
  JarvisUiPreferences,
  ModelProviderConfig,
  ModelProviderId,
  ModelRouterConfig,
  PendingClarification,
  PlannerTaskRecord,
  SavedWorkflowRecord,
  WorkflowStepResolution,
  WorkflowTemplateRecord,
} from "../jarvisCommandTypes";
import { builtInBrowserAliases, canonicalHostRoots } from "../jarvisCommandTypes";
import {
  getLoadedPdfFiles,
  hasExplicitOpenLanguage,
  hasExplicitSearchLanguage,
  isKnownBrowserTarget,
  buildSpotifySearchUrl,
  normalizeControlCommand,
  normalizeUrlTarget,
  parseBirthdayMonthDay,
  resolveBrowserAliasTarget,
  resolveLearnedIntent,
  resolveNaturalConversationFollowUp,
} from "../../semantic/intentRanking";
import { isStudyAppsCommand } from "./desktopIntentUtils";
import { parseDesktopControlIntent } from "./desktopIntent";
import { cleanConversationalCommand } from "./desktopIntentUtils";

export function parseExplicitCommandIntent(
  command: string,
  aliases: BrowserAliasRecord[],
): CommandIntent | null {
  const trimmed = command.trim();
  const normalized = trimmed.toLowerCase();

  if (isStudyAppsCommand(trimmed)) {
    return { kind: "study_setup" };
  }

  const desktopIntent = parseDesktopControlIntent(trimmed);
  if (desktopIntent) {
    return desktopIntent;
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

  if (
    normalized === "test model router" ||
    normalized === "test local model" ||
    normalized === "test ollama model"
  ) {
    return { kind: "test_model_provider", providerId: "local_ollama" };
  }

  if (normalized === "test nvidia model" || normalized === "test nvidia") {
    return { kind: "test_model_provider", providerId: "nvidia_nim" };
  }

  if (normalized === "test lm studio" || normalized === "test lm studio model") {
    return { kind: "test_model_provider", providerId: "lm_studio" };
  }

  if (normalized === "test gemini" || normalized === "test gemini model") {
    return { kind: "test_model_provider", providerId: "gemini" };
  }

  const routeModelMatch = trimmed.match(/^(?:what model would you use for|route model for)\s+(.+)$/i);
  if (routeModelMatch?.[1]?.trim()) {
    return { kind: "explain_model_route", prompt: routeModelMatch[1].trim() };
  }

  if (
    normalized === "copy latest draft" ||
    normalized === "copy the latest draft" ||
    normalized === "copy model draft"
  ) {
    return { kind: "copy_latest_model_draft" };
  }

  if (
    normalized === "save latest draft to notion" ||
    normalized === "save the latest draft to notion" ||
    normalized === "save model draft to notion"
  ) {
    return { kind: "save_latest_model_draft_to_notion" };
  }

  if (
    normalized === "run model benchmark" ||
    normalized === "benchmark models" ||
    normalized === "test all models"
  ) {
    return { kind: "run_model_benchmark" };
  }

  if (
    normalized === "open models" ||
    normalized === "open model router" ||
    normalized === "show models workspace"
  ) {
    return { kind: "set_home_app", app: "models" };
  }

  if (
    normalized === "recommend model routes" ||
    normalized === "recommend models" ||
    normalized === "auto recommend models"
  ) {
    return { kind: "recommend_model_routes" };
  }

  if (
    normalized === "local only mode" ||
    normalized === "turn on local only mode" ||
    normalized === "private mode" ||
    normalized === "turn on private mode"
  ) {
    return { kind: "set_private_model_mode", localOnly: true };
  }

  if (
    normalized === "allow cloud mode" ||
    normalized === "turn off local only mode" ||
    normalized === "allow cloud for private prompts"
  ) {
    return { kind: "set_private_model_mode", localOnly: false };
  }

  const compareModelsMatch = trimmed.match(/^(?:compare models for|compare model responses for|ask models about)\s+(.+)$/i);
  if (compareModelsMatch?.[1]?.trim()) {
    return { kind: "compare_model_responses", prompt: compareModelsMatch[1].trim() };
  }

  const chooseWinnerMatch = trimmed.match(/^choose\s+(.+?)\s+as\s+(?:the\s+)?model\s+winner$/i);
  if (chooseWinnerMatch?.[1]?.trim()) {
    const providerName = chooseWinnerMatch[1].trim().toLowerCase();
    const providerId = (Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[]).find(
      (id) => MODEL_PROVIDER_LABELS[id].toLowerCase().includes(providerName) || id.replace(/_/g, " ").includes(providerName),
    );
    if (providerId) {
      return { kind: "choose_model_comparison_winner", providerId };
    }
  }

  const modelDraftMatch = trimmed.match(/^(?:generate|create|write)\s+(?:a\s+)?draft(?: for| about|:)?\s+(.+)$/i);
  if (modelDraftMatch?.[1]?.trim()) {
    return { kind: "generate_model_draft", prompt: modelDraftMatch[1].trim(), taskType: "draft" };
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

  const rememberBirthdayWithCalendarMatch = trimmed.match(
    /^remember(?: that)?\s+(.+?)['â€™]s birthday is\s+(.+?)\s+and add it to calendar$/i,
  );
  if (rememberBirthdayWithCalendarMatch) {
    const parsed = parseBirthdayMonthDay(rememberBirthdayWithCalendarMatch[2]);
    if (parsed) {
      return {
        kind: "remember_person_birthday",
        name: rememberBirthdayWithCalendarMatch[1].trim(),
        birthdayLabel: parsed.birthdayLabel,
        month: parsed.month,
        day: parsed.day,
        addToCalendar: true,
      };
    }
  }

  const saveBirthdayWithCalendarMatch = trimmed.match(
    /^save\s+(.+?)['â€™]s birthday as\s+(.+?)\s+and add it to calendar$/i,
  );
  if (saveBirthdayWithCalendarMatch) {
    const parsed = parseBirthdayMonthDay(saveBirthdayWithCalendarMatch[2]);
    if (parsed) {
      return {
        kind: "remember_person_birthday",
        name: saveBirthdayWithCalendarMatch[1].trim(),
        birthdayLabel: parsed.birthdayLabel,
        month: parsed.month,
        day: parsed.day,
        addToCalendar: true,
      };
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

  const setRelationshipMatch = trimmed.match(/^set\s+(.+?)\s+relationship\s+to\s+(.+)$/i);
  if (setRelationshipMatch) {
    return {
      kind: "update_person_relationship",
      query: setRelationshipMatch[1].trim(),
      relationship: setRelationshipMatch[2].trim(),
    };
  }

  const setAgeMatch = trimmed.match(/^set\s+(.+?)\s+age\s+to\s+(\d{1,3})$/i);
  if (setAgeMatch) {
    return {
      kind: "update_person_age",
      query: setAgeMatch[1].trim(),
      age: Number(setAgeMatch[2]),
    };
  }

  const giftNoteMatch = trimmed.match(/^add gift note for\s+(.+?)\s+(.+)$/i);
  if (giftNoteMatch) {
    return {
      kind: "add_person_gift_note",
      query: giftNoteMatch[1].trim(),
      note: giftNoteMatch[2].trim(),
    };
  }

  const contactNoteMatch = trimmed.match(/^add (?:contact )?note for\s+(.+?)\s+(.+)$/i);
  if (contactNoteMatch) {
    return {
      kind: "add_person_contact_note",
      query: contactNoteMatch[1].trim(),
      note: contactNoteMatch[2].trim(),
    };
  }

  const lastContactMatch = trimmed.match(/^i last talked to\s+(.+?)\s+(.+)$/i);
  if (lastContactMatch) {
    return {
      kind: "set_person_last_contact",
      query: lastContactMatch[1].trim(),
      whenLabel: lastContactMatch[2].trim(),
    };
  }

  const followUpMatch = trimmed.match(/^remind me to check in with\s+(.+?)\s+(.+)$/i);
  if (followUpMatch) {
    return {
      kind: "set_person_follow_up",
      query: followUpMatch[1].trim(),
      dueLabel: followUpMatch[2].trim(),
      reason: "check in",
    };
  }

  if (
    normalized === "show people follow ups" ||
    normalized === "show people followups" ||
    normalized === "show follow ups" ||
    normalized === "show followups"
  ) {
    return { kind: "list_people_follow_ups" };
  }

  if (
    normalized === "who should i check in with this week" ||
    normalized === "who do i need to check in with this week" ||
    normalized === "show people to check in with"
  ) {
    return { kind: "list_people_check_ins" };
  }

  const reminderMatch = trimmed.match(/^set birthday reminder for\s+(.+?)\s+to\s+(\d+)\s+days?\s+before$/i);
  if (reminderMatch) {
    return {
      kind: "set_person_birthday_reminder",
      query: reminderMatch[1].trim(),
      daysBefore: Number(reminderMatch[2]),
    };
  }

  const remindMeBirthdayMatch = trimmed.match(/^remind me\s+(\d+)\s+days?\s+before\s+(.+?)['â€™]s birthday$/i);
  if (remindMeBirthdayMatch) {
    return {
      kind: "set_person_birthday_reminder",
      query: remindMeBirthdayMatch[2].trim(),
      daysBefore: Number(remindMeBirthdayMatch[1]),
    };
  }

  const birthdayCalendarMatch = trimmed.match(/^add\s+(.+?)['â€™]s birthday\s+to\s+calendar$/i);
  if (birthdayCalendarMatch) {
    return {
      kind: "add_person_birthday_to_calendar",
      query: birthdayCalendarMatch[1].trim(),
    };
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

  const spotifyPlayArtistMatch = trimmed.match(
    /^(?:can you |could you |would you )?play artist (.+) on spotify$/i,
  );
  if (spotifyPlayArtistMatch?.[1]?.trim()) {
    return { kind: "spotify_play_artist", query: spotifyPlayArtistMatch[1].trim() };
  }

  const spotifyPlayPlaylistMatch = trimmed.match(
    /^(?:can you |could you |would you )?play playlist (.+) on spotify$/i,
  );
  if (spotifyPlayPlaylistMatch?.[1]?.trim()) {
    return { kind: "spotify_play_playlist", query: spotifyPlayPlaylistMatch[1].trim() };
  }

  const spotifyPlayAlbumMatch = trimmed.match(
    /^(?:can you |could you |would you )?play album (.+) on spotify$/i,
  );
  if (spotifyPlayAlbumMatch?.[1]?.trim()) {
    return { kind: "spotify_play_album", query: spotifyPlayAlbumMatch[1].trim() };
  }

  const spotifyPlayQueryMatch = trimmed.match(
    /^(?:can you |could you |would you )?play (.+) on spotify$/i,
  );
  if (spotifyPlayQueryMatch?.[1]?.trim()) {
    return { kind: "spotify_play_query", query: spotifyPlayQueryMatch[1].trim() };
  }

  const spotifyQueueMatch = trimmed.match(
    /^(?:can you |could you |would you )?(?:queue|add) (.+) on spotify$/i,
  );
  if (spotifyQueueMatch?.[1]?.trim()) {
    return { kind: "spotify_queue_query", query: spotifyQueueMatch[1].trim() };
  }

  if (
    normalized === "like this song" ||
    normalized === "save this song" ||
    normalized === "like current song" ||
    normalized === "save current song" ||
    normalized === "like current track" ||
    normalized === "save current track"
  ) {
    return { kind: "spotify_like_current" };
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
    normalized === "show travel checklist" ||
    normalized === "what do i need for this trip" ||
    normalized === "what do i need for this travel"
  ) {
    return { kind: "show_current_travel_checklist" };
  }

  if (
    normalized === "show trip timeline" ||
    normalized === "show travel timeline" ||
    normalized === "what is the trip timeline"
  ) {
    return { kind: "show_current_travel_timeline" };
  }

  if (
    normalized === "show expense memory" ||
    normalized === "list expense memory" ||
    normalized === "show my expenses"
  ) {
    return { kind: "list_expense_memory" };
  }

  if (
    normalized === "show weekly expenses" ||
    normalized === "list weekly expenses" ||
    normalized === "what did i spend this week"
  ) {
    return { kind: "list_weekly_expenses" };
  }

  if (
    normalized === "show monthly expenses" ||
    normalized === "list monthly expenses" ||
    normalized === "what did i spend this month"
  ) {
    return { kind: "list_monthly_expenses" };
  }

  const monthlyCategoryExpenseMatch = trimmed.match(/^how much did i spend on\s+(.+?)\s+this month\??$/i);
  if (monthlyCategoryExpenseMatch) {
    return {
      kind: "list_monthly_expenses_by_category",
      category: monthlyCategoryExpenseMatch[1].trim(),
    };
  }

  if (
    normalized === "show subscriptions" ||
    normalized === "show recurring expenses" ||
    normalized === "list subscriptions"
  ) {
    return { kind: "list_recurring_expenses" };
  }

  if (
    normalized === "show package memory" ||
    normalized === "list package memory" ||
    normalized === "show my packages"
  ) {
    return { kind: "list_package_memory" };
  }

  if (normalized === "what's arriving tomorrow" || normalized === "what is arriving tomorrow") {
    return { kind: "list_packages_arriving_tomorrow" };
  }

  if (normalized === "show delayed packages" || normalized === "list delayed packages") {
    return { kind: "list_delayed_packages" };
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
    normalized === "what should i study today" ||
    normalized === "build my study plan for next 3 days"
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
    normalized === "add this travel to calendar" ||
    normalized === "save this travel to calendar" ||
    normalized === "add travel from this email to calendar"
  ) {
    return { kind: "save_current_email_travel_to_calendar" };
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

  const saveTravelCalendarIndexedEmailMatch = normalized.match(
    /^(?:add|save) travel from email (\d+) to calendar$/i,
  );
  if (saveTravelCalendarIndexedEmailMatch) {
    return { kind: "save_email_travel_to_calendar_by_index", index: Number(saveTravelCalendarIndexedEmailMatch[1]) };
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

  const saveTravelCalendarQueriedEmailMatch = normalized.match(
    /^(?:add|save) travel from (?:the )?email about (.+) to calendar$/i,
  );
  if (saveTravelCalendarQueriedEmailMatch) {
    return { kind: "save_email_travel_to_calendar_by_query", query: saveTravelCalendarQueriedEmailMatch[1].trim() };
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

export function resolveTeachableIntent(
  command: string,
  aliases: BrowserAliasRecord[],
): CommandIntent | null {
  return (
    parseExplicitCommandIntent(command, aliases) ??
    parseConversationalCommandIntent(command, aliases)
  );
}

export function parseConversationalCommandIntent(
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
    normalized === "switch to heuristics" ||
    normalized === "use heuristics" ||
    normalized === "set brain to heuristics" ||
    normalized === "use heuristic mode"
  ) {
    return { kind: "set_conversation_backend", backend: "heuristics" };
  }

  if (
    normalized === "switch to ollama" ||
    normalized === "use ollama" ||
    normalized === "set brain to ollama" ||
    normalized === "use ollama mode"
  ) {
    return { kind: "set_conversation_backend", backend: "ollama" };
  }

  if (
    normalized === "switch to auto mode" ||
    normalized === "use auto mode" ||
    normalized === "set brain to auto" ||
    normalized === "use auto routing"
  ) {
    return { kind: "set_conversation_backend", backend: "auto" };
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

  const spotifyPlayArtistMatch = cleaned.match(
    /^(?:can you |could you |would you )?play artist (.+) on spotify$/i,
  );
  if (spotifyPlayArtistMatch?.[1]?.trim()) {
    return { kind: "spotify_play_artist", query: spotifyPlayArtistMatch[1].trim() };
  }

  const spotifyPlayPlaylistMatch = cleaned.match(
    /^(?:can you |could you |would you )?play playlist (.+) on spotify$/i,
  );
  if (spotifyPlayPlaylistMatch?.[1]?.trim()) {
    return { kind: "spotify_play_playlist", query: spotifyPlayPlaylistMatch[1].trim() };
  }

  const spotifyPlayAlbumMatch = cleaned.match(
    /^(?:can you |could you |would you )?play album (.+) on spotify$/i,
  );
  if (spotifyPlayAlbumMatch?.[1]?.trim()) {
    return { kind: "spotify_play_album", query: spotifyPlayAlbumMatch[1].trim() };
  }

  const spotifyPlayQueryMatch = cleaned.match(
    /^(?:can you |could you |would you )?play (.+) on spotify$/i,
  );
  if (spotifyPlayQueryMatch?.[1]?.trim()) {
    return { kind: "spotify_play_query", query: spotifyPlayQueryMatch[1].trim() };
  }

  const spotifyQueueMatch = cleaned.match(
    /^(?:can you |could you |would you )?(?:queue|add) (.+) on spotify$/i,
  );
  if (spotifyQueueMatch?.[1]?.trim()) {
    return { kind: "spotify_queue_query", query: spotifyQueueMatch[1].trim() };
  }

  if (
    normalized === "like this song" ||
    normalized === "save this song" ||
    normalized === "like current song" ||
    normalized === "save current song" ||
    normalized === "like current track" ||
    normalized === "save current track"
  ) {
    return { kind: "spotify_like_current" };
  }

  const spotifySearchPatterns = [
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

export function buildClarificationForCommand(
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
      confidence: "low",
      confidenceScore: 0.34,
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
      confidence: "low",
      confidenceScore: 0.32,
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
      confidence: "low",
      confidenceScore: 0.28,
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

export function resolveClarificationReply(
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

export function getErrorDetail(
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

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function parseClockTime(value: string) {
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

export function resolveDayReference(dayToken: string, now: Date) {
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

export function parseDurationMinutes(command: string) {
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

export function extractDueLabel(text: string) {
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

export function parseTaskCommandIntent(command: string) {
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

export function parseCalendarCommandIntent(command: string) {
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

export function parseReminderCommandIntent(command: string) {
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

export function formatGoogleCalendarDate(date: Date) {
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

export function buildGoogleCalendarEventUrl(title: string, start: Date, end: Date) {
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

export function buildGoogleSearchUrl(query: string) {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", query);
  return url.toString();
}

export const workflowLeadPattern =
  /^(open|read|show|save|add|search|find|make|create|complete|reopen|move|summarize|analyze|extract|play|pause|launch|check|list|filter)\b/i;

export const SAVED_WORKFLOWS_STORAGE_KEY = "jarvis_saved_workflows_v1";
export const WORKFLOW_COUNTS_STORAGE_KEY = "jarvis_workflow_counts_v1";
export const DISMISSED_WORKFLOWS_STORAGE_KEY = "jarvis_dismissed_workflows_v1";
export const VOICE_REPLY_MODE_STORAGE_KEY = "jarvis_voice_reply_mode_v1";
export const CONVERSATION_BACKEND_STORAGE_KEY = "jarvis_conversation_backend_v1";
export const ASSISTANT_DEFAULTS_STORAGE_KEY = "jarvis_assistant_defaults_v1";
export const USER_PREFERENCE_MEMORY_STORAGE_KEY = "jarvis_user_preference_memory_v1";
export const SEMANTIC_CONVERSATION_MEMORY_STORAGE_KEY = "jarvis_semantic_conversation_memory_v1";
export const SEMANTIC_INTENT_FEEDBACK_STORAGE_KEY = "jarvis_semantic_intent_feedback_v1";
export const EMBEDDING_CONFIG_STORAGE_KEY = "jarvis_embedding_config_v1";
export const MODEL_ROUTER_CONFIG_STORAGE_KEY = "jarvis_model_router_config_v1";
export const MODEL_ROUTER_USAGE_STORAGE_KEY = "jarvis_model_router_usage_v1";
export const PEOPLE_MEMORY_STORAGE_KEY = "jarvis_people_memory_v1";
export const TRAVEL_MEMORY_STORAGE_KEY = "jarvis_travel_memory_v1";
export const EXPENSE_MEMORY_STORAGE_KEY = "jarvis_expense_memory_v1";
export const PACKAGE_MEMORY_STORAGE_KEY = "jarvis_package_memory_v1";
export const MEETING_PREP_MEMORY_STORAGE_KEY = "jarvis_meeting_prep_memory_v1";
export const SCHOOL_PLAN_MEMORY_STORAGE_KEY = "jarvis_school_plan_memory_v1";
export const DESKTOP_PROJECTS_STORAGE_KEY = "jarvis_desktop_projects_v1";
export const DESKTOP_SCHEDULES_STORAGE_KEY = "jarvis_desktop_schedules_v1";
export const DESKTOP_PERMISSION_SETTINGS_STORAGE_KEY = "jarvis_desktop_permissions_v1";
export const OCR_HISTORY_STORAGE_KEY = "jarvis_ocr_history_v1";
export const OCR_WATCHES_STORAGE_KEY = "jarvis_ocr_watches_v1";
export const OCR_CORRECTIONS_STORAGE_KEY = "jarvis_ocr_corrections_v1";
export const OCR_WATCH_TEMPLATES_STORAGE_KEY = "jarvis_ocr_watch_templates_v1";
export const UI_PREFERENCES_STORAGE_KEY = "jarvis_ui_preferences_v1";

export const MODEL_PROVIDER_LABELS: Record<ModelProviderId, string> = {
  local_ollama: "Local Ollama",
  lm_studio: "LM Studio",
  nvidia_nim: "NVIDIA NIM",
  gemini: "Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
  huggingface: "Hugging Face",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

export const PAID_MODEL_PROVIDERS = new Set<ModelProviderId>(["openai", "anthropic"]);
export const CLOUD_MODEL_PROVIDERS = new Set<ModelProviderId>([
  "nvidia_nim",
  "gemini",
  "groq",
  "openrouter",
  "huggingface",
  "openai",
  "anthropic",
]);
export const OPENAI_COMPATIBLE_PROVIDER_IDS = new Set<ModelProviderId>([
  "local_ollama",
  "lm_studio",
  "nvidia_nim",
  "gemini",
  "groq",
  "openrouter",
  "huggingface",
  "openai",
]);

export const MODEL_PROVIDER_PRESETS: Array<{
  id: string;
  providerId: ModelProviderId;
  label: string;
  chatModel: string;
  codingModel: string;
  reasoningModel: string;
}> = [
  {
    id: "groq-fast-free",
    providerId: "groq",
    label: "Groq fast free",
    chatModel: "llama-3.1-8b-instant",
    codingModel: "llama-3.3-70b-versatile",
    reasoningModel: "llama-3.3-70b-versatile",
  },
  {
    id: "openrouter-free-qwen",
    providerId: "openrouter",
    label: "OpenRouter free Qwen",
    chatModel: "qwen/qwen-2.5-72b-instruct:free",
    codingModel: "qwen/qwen-2.5-coder-32b-instruct:free",
    reasoningModel: "qwen/qwen-2.5-72b-instruct:free",
  },
  {
    id: "openrouter-free-deepseek",
    providerId: "openrouter",
    label: "OpenRouter free DeepSeek",
    chatModel: "deepseek/deepseek-chat-v3-0324:free",
    codingModel: "deepseek/deepseek-chat-v3-0324:free",
    reasoningModel: "deepseek/deepseek-r1:free",
  },
];

export function createDefaultModelRouterConfig(): ModelRouterConfig {
  const provider = (
    providerId: ModelProviderId,
    baseUrl: string,
    chatModel = "",
    codingModel = "",
    reasoningModel = "",
    enabled = false,
  ): ModelProviderConfig => ({
    providerId,
    enabled,
    baseUrl,
    apiKey: "",
    chatModel,
    codingModel,
    reasoningModel,
  });

  return {
    defaultProvider: "local_ollama",
    codingProvider: "nvidia_nim",
    reasoningProvider: "nvidia_nim",
    privateProvider: "local_ollama",
    enablePaidProviders: false,
    maxMonthlyApiSpend: 0,
    allowCloudForPrivateMemory: false,
    experimentalLocalReasoningModel:
      "Jackrong/Qwen3.5-4B-Claude-4.6-Opus-Reasoning-Distilled-v2-GGUF",
    providers: {
      local_ollama: provider("local_ollama", "http://127.0.0.1:11434/v1", "qwen3:4b", "qwen3:4b", "qwen3:4b", true),
      lm_studio: provider("lm_studio", "http://127.0.0.1:1234/v1"),
      nvidia_nim: provider("nvidia_nim", "https://integrate.api.nvidia.com/v1"),
      gemini: provider("gemini", "https://generativelanguage.googleapis.com/v1beta", "gemini-2.5-flash", "gemini-2.5-flash", "gemini-2.5-flash"),
      groq: provider("groq", "https://api.groq.com/openai/v1"),
      openrouter: provider("openrouter", "https://openrouter.ai/api/v1"),
      huggingface: provider("huggingface", ""),
      openai: provider("openai", "https://api.openai.com/v1"),
      anthropic: provider("anthropic", "https://api.anthropic.com/v1"),
    },
  };
}

export function mergeModelRouterConfig(saved: Partial<ModelRouterConfig> | null): ModelRouterConfig {
  const defaults = createDefaultModelRouterConfig();
  if (!saved) {
    return defaults;
  }

  const providers = { ...defaults.providers };
  if (saved.providers) {
    for (const providerId of Object.keys(providers) as ModelProviderId[]) {
      providers[providerId] = {
        ...providers[providerId],
        ...(saved.providers[providerId] ?? {}),
        apiKey: "",
        providerId,
      };
    }
  }

  const isProviderId = (value: unknown): value is ModelProviderId =>
    typeof value === "string" && value in defaults.providers;

  return {
    ...defaults,
    ...saved,
    defaultProvider: isProviderId(saved.defaultProvider) ? saved.defaultProvider : defaults.defaultProvider,
    codingProvider: isProviderId(saved.codingProvider) ? saved.codingProvider : defaults.codingProvider,
    reasoningProvider: isProviderId(saved.reasoningProvider) ? saved.reasoningProvider : defaults.reasoningProvider,
    privateProvider: isProviderId(saved.privateProvider) ? saved.privateProvider : defaults.privateProvider,
    enablePaidProviders: saved.enablePaidProviders === true,
    maxMonthlyApiSpend:
      typeof saved.maxMonthlyApiSpend === "number" && Number.isFinite(saved.maxMonthlyApiSpend)
        ? Math.max(0, saved.maxMonthlyApiSpend)
        : defaults.maxMonthlyApiSpend,
    allowCloudForPrivateMemory: saved.allowCloudForPrivateMemory === true,
    providers,
  };
}
export const DEFAULT_DESKTOP_PERMISSION_SETTINGS: DesktopPermissionSettings = {
  confirmProjectChecks: true,
  confirmAppClose: true,
  confirmExecutorLaunch: true,
};

export const DEFAULT_UI_PREFERENCES: JarvisUiPreferences = {
  shellBarVisible: true,
  shellBarPlacement: "bottom",
  shellBarPosition: { x: 0, y: 0 },
  cockpitMode: false,
  activeHomeApp: "command",
};

export const workflowTemplates: WorkflowTemplateRecord[] = [
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

export function splitWorkflowCommand(command: string) {
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

export function normalizeWorkflowStep(step: string) {
  return normalizeControlCommand(step);
}

export function buildWorkflowSignature(steps: string[]) {
  return steps.map(normalizeWorkflowStep).join(" -> ");
}

export function generateWorkflowName(steps: string[]) {
  const firstStep = steps[0] ?? "workflow";
  const cleaned = cleanConversationalCommand(firstStep)
    .replace(/\b(the|this|that|my)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, 4);
  const label = words.length > 0 ? words.join(" ") : "workflow";
  return label.replace(/\b\w/g, (match) => match.toUpperCase());
}

export function generateWorkflowTriggerPhrase(name: string) {
  return `run ${name.toLowerCase()}`;
}

export function resolveSavedWorkflowInvocation(
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

export function renderWorkflowStep(
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

export function evaluateWorkflowCondition(
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

export function resolveWorkflowConditionalStep(
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


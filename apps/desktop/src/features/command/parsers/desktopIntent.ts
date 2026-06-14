import {
  builtInBrowserAliases,
  type CommandIntent,
  type DesktopPermissionSettings,
  type OcrWatchAction,
  type OcrWatchRule,
} from "../jarvisCommandTypes";
import {
  getOcrHistorySince,
  normalizeJarvisHomeAppName,
  normalizeJarvisPanelName,
  normalizeOcrRegion,
  parseWatchIntervalMs,
} from "../../ocr/ocrText";
import { normalizeUrlTarget } from "../../semantic/intentRanking";
import {
  cleanConversationalCommand,
  desktopAppAliases,
  namedFolderAliases,
} from "./desktopIntentUtils";

export function normalizeDesktopTarget(target: string) {
  return target
    .trim()
    .replace(/\b(app|application|program)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeDesktopProjectName(name: string) {
  return name
    .trim()
    .replace(/\b(workspace|desktop project|project)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseWorkspaceScheduleDate(label: string) {
  const normalized = label.trim().toLowerCase();
  const now = new Date();
  const relativeMatch = normalized.match(/^in\s+(\d{1,3})\s*(minutes?|mins?|hours?|hrs?)$/i);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    const minutes = /hour|hr/.test(unit) ? amount * 60 : amount;
    return new Date(now.getTime() + minutes * 60 * 1000);
  }

  const timeMatch = normalized.match(/^(?:(today|tomorrow)\s+)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (timeMatch) {
    const date = new Date(now);
    if (timeMatch[1] === "tomorrow") {
      date.setDate(date.getDate() + 1);
    }
    let hours = Number(timeMatch[2]);
    const minutes = timeMatch[3] ? Number(timeMatch[3]) : 0;
    const meridiem = timeMatch[4]?.toLowerCase();
    if (meridiem === "pm" && hours < 12) {
      hours += 12;
    }
    if (meridiem === "am" && hours === 12) {
      hours = 0;
    }
    date.setHours(hours, minutes, 0, 0);
    if (!timeMatch[1] && date.getTime() < now.getTime()) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  return null;
}

export function parseDurationMinutesFromText(text: string) {
  const match = text.trim().match(/^(\d{1,3})\s*(minutes?|mins?|hours?|hrs?)$/i);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  return /hour|hr/.test(match[2].toLowerCase()) ? amount * 60 : amount;
}

export function parseDesktopProjectIntent(command: string): CommandIntent | null {
  const trimmed = command.trim();
  const normalized = trimmed.toLowerCase().replace(/[.!?]+$/g, "").trim();

  if (
    normalized === "show desktop projects" ||
    normalized === "list desktop projects" ||
    normalized === "show workspaces" ||
    normalized === "list workspaces"
  ) {
    return { kind: "list_desktop_projects" };
  }

  const templateMatch = trimmed.match(
    /^(?:create|make|add)\s+(?:a\s+)?(coding|code|school|study|focus|music)\s+(?:workspace|desktop project)\s+template$/i,
  );
  if (templateMatch) {
    const templateName = normalizeDesktopProjectName(templateMatch[1]).toLowerCase();
    const projectName =
      templateName === "code" ? "coding" : templateName === "study" ? "school" : templateName;
    return { kind: "create_desktop_project_template", templateName, projectName };
  }

  const namedTemplateMatch = trimmed.match(
    /^(?:create|make|add)\s+(?:a\s+)?(coding|code|school|study|focus|music)\s+(?:workspace|desktop project)\s+(?:called|named)\s+(.+)$/i,
  );
  if (namedTemplateMatch) {
    const templateName = normalizeDesktopProjectName(namedTemplateMatch[1]).toLowerCase();
    const projectName = normalizeDesktopProjectName(namedTemplateMatch[2]);
    if (projectName) {
      return { kind: "create_desktop_project_template", templateName, projectName };
    }
  }

  const createMatch = trimmed.match(/^(?:create|save|make)\s+(?:a\s+)?(?:desktop\s+project|workspace)\s+(?:called\s+|named\s+)?(.+)$/i);
  if (createMatch) {
    const name = normalizeDesktopProjectName(createMatch[1]);
    if (name) {
      return { kind: "create_desktop_project", name };
    }
  }

  const openMatch = trimmed.match(/^(?:open|launch|start)\s+(?:my\s+)?(.+?)\s+(?:workspace|desktop project)$/i);
  if (openMatch) {
    const query = normalizeDesktopProjectName(openMatch[1]);
    if (query) {
      return { kind: "open_desktop_project", query };
    }
  }

  const durationMatch = trimmed.match(/^(?:start|open|launch)\s+(?:my\s+)?(.+?)\s+(?:workspace|desktop project|mode)\s+for\s+(.+)$/i);
  if (durationMatch) {
    const query = normalizeDesktopProjectName(durationMatch[1]);
    const durationMinutes = parseDurationMinutesFromText(durationMatch[2]);
    if (query && durationMinutes) {
      return { kind: "start_desktop_project_for_duration", query, durationMinutes };
    }
  }

  const scheduleMatch = trimmed.match(/^(?:open|launch|start)\s+(?:my\s+)?(.+?)\s+(?:workspace|desktop project|mode)\s+(?:at|in)\s+(.+)$/i);
  if (scheduleMatch) {
    const query = normalizeDesktopProjectName(scheduleMatch[1]);
    const whenLabel = scheduleMatch[2].trim();
    const dueAt = parseWorkspaceScheduleDate(scheduleMatch[0].toLowerCase().includes(" in ") ? `in ${whenLabel}` : whenLabel);
    if (query && dueAt) {
      return { kind: "schedule_desktop_project", query, whenLabel, dueAt };
    }
  }

  if (
    normalized === "show workspace schedules" ||
    normalized === "show scheduled workspaces" ||
    normalized === "list workspace schedules" ||
    normalized === "list scheduled workspaces"
  ) {
    return { kind: "list_desktop_schedules" };
  }

  const renameMatch = trimmed.match(/^rename\s+(?:my\s+)?(.+?)\s+(?:workspace|desktop project)\s+to\s+(.+)$/i);
  if (renameMatch) {
    const projectQuery = normalizeDesktopProjectName(renameMatch[1]);
    const newName = normalizeDesktopProjectName(renameMatch[2]);
    if (projectQuery && newName) {
      return { kind: "rename_desktop_project", projectQuery, newName };
    }
  }

  const deleteMatch = trimmed.match(/^(?:delete|remove|forget)\s+(?:my\s+)?(.+?)\s+(?:workspace|desktop project)$/i);
  if (deleteMatch) {
    const projectQuery = normalizeDesktopProjectName(deleteMatch[1]);
    if (projectQuery) {
      return { kind: "delete_desktop_project", projectQuery };
    }
  }

  const addAppMatch = trimmed.match(/^add\s+(.+?)(?:\s+(?:app|application|program))?\s+to\s+(?:my\s+)?(.+?)\s+(?:workspace|desktop project)$/i);
  if (addAppMatch) {
    const appName = normalizeDesktopTarget(addAppMatch[1]);
    const projectQuery = normalizeDesktopProjectName(addAppMatch[2]);
    if (appName && projectQuery && desktopAppAliases.has(appName)) {
      return { kind: "add_app_to_desktop_project", projectQuery, appName };
    }
  }

  const addFolderMatch = trimmed.match(/^add\s+(.+?\s+folder|downloads|documents|desktop|jarvis project|project)\s+to\s+(?:my\s+)?(.+?)\s+(?:workspace|desktop project)$/i);
  if (addFolderMatch) {
    const folderName = normalizeDesktopTarget(addFolderMatch[1]);
    const projectQuery = normalizeDesktopProjectName(addFolderMatch[2]);
    if (folderName && projectQuery && namedFolderAliases.has(folderName)) {
      return { kind: "add_folder_to_desktop_project", projectQuery, folderName };
    }
  }

  const addWebsiteMatch = trimmed.match(/^add\s+(.+?)\s+to\s+(?:my\s+)?(.+?)\s+(?:workspace|desktop project)$/i);
  if (addWebsiteMatch) {
    const rawTarget = addWebsiteMatch[1].trim();
    const projectQuery = normalizeDesktopProjectName(addWebsiteMatch[2]);
    const normalizedTarget = normalizeDesktopTarget(rawTarget);
    const resolvedAlias = builtInBrowserAliases[normalizedTarget] ?? null;
    if (projectQuery && !desktopAppAliases.has(normalizedTarget) && !namedFolderAliases.has(normalizedTarget)) {
      return {
        kind: "add_website_to_desktop_project",
        projectQuery,
        url: resolvedAlias ?? normalizeUrlTarget(rawTarget),
      };
    }
  }

  const removeAppMatch = trimmed.match(/^(?:remove|delete)\s+(.+?)(?:\s+(?:app|application|program))?\s+from\s+(?:my\s+)?(.+?)\s+(?:workspace|desktop project)$/i);
  if (removeAppMatch) {
    const appName = normalizeDesktopTarget(removeAppMatch[1]);
    const projectQuery = normalizeDesktopProjectName(removeAppMatch[2]);
    if (appName && projectQuery && desktopAppAliases.has(appName)) {
      return { kind: "remove_app_from_desktop_project", projectQuery, appName };
    }
  }

  const removeFolderMatch = trimmed.match(/^(?:remove|delete)\s+(.+?\s+folder|downloads|documents|desktop|jarvis project|project)\s+from\s+(?:my\s+)?(.+?)\s+(?:workspace|desktop project)$/i);
  if (removeFolderMatch) {
    const folderName = normalizeDesktopTarget(removeFolderMatch[1]);
    const projectQuery = normalizeDesktopProjectName(removeFolderMatch[2]);
    if (folderName && projectQuery && namedFolderAliases.has(folderName)) {
      return { kind: "remove_folder_from_desktop_project", projectQuery, folderName };
    }
  }

  const removeWebsiteMatch = trimmed.match(/^(?:remove|delete)\s+(.+?)\s+from\s+(?:my\s+)?(.+?)\s+(?:workspace|desktop project)$/i);
  if (removeWebsiteMatch) {
    const rawTarget = removeWebsiteMatch[1].trim();
    const projectQuery = normalizeDesktopProjectName(removeWebsiteMatch[2]);
    const normalizedTarget = normalizeDesktopTarget(rawTarget);
    const resolvedAlias = builtInBrowserAliases[normalizedTarget] ?? null;
    if (projectQuery && !desktopAppAliases.has(normalizedTarget) && !namedFolderAliases.has(normalizedTarget)) {
      return {
        kind: "remove_website_from_desktop_project",
        projectQuery,
        url: resolvedAlias ?? normalizeUrlTarget(rawTarget),
      };
    }
  }

  return null;
}

export function parseDesktopControlIntent(command: string): CommandIntent | null {
  const trimmed = command.trim();
  const normalized = trimmed.toLowerCase().replace(/[.!?]+$/g, "").trim();

  const projectIntent = parseDesktopProjectIntent(trimmed);
  if (projectIntent) {
    return projectIntent;
  }

  if (
    normalized === "hide jarvis bar" ||
    normalized === "hide command bar" ||
    normalized === "hide quick bar" ||
    normalized === "dismiss command bar"
  ) {
    return { kind: "set_shell_bar", visible: false };
  }

  if (
    normalized === "show jarvis bar" ||
    normalized === "show command bar" ||
    normalized === "show quick bar" ||
    normalized === "bring back command bar"
  ) {
    return { kind: "set_shell_bar", visible: true };
  }

  if (
    normalized === "open cockpit" ||
    normalized === "show cockpit" ||
    normalized === "enter cockpit mode" ||
    normalized === "open jarvis cockpit" ||
    normalized === "show jarvis cockpit"
  ) {
    return { kind: "set_cockpit_mode", active: true };
  }

  if (
    normalized === "close cockpit" ||
    normalized === "exit cockpit mode" ||
    normalized === "hide cockpit" ||
    normalized === "close jarvis cockpit"
  ) {
    return { kind: "set_cockpit_mode", active: false };
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

  const homeAppMatch = trimmed.match(/^(?:open|show|switch to|go to)\s+(?:the\s+)?(.+?)(?:\s+(?:app|section|page))?$/i);
  if (homeAppMatch) {
    const app = normalizeJarvisHomeAppName(homeAppMatch[1]);
    if (app) {
      return { kind: "set_home_app", app };
    }
  }

  const openPanelMatch = trimmed.match(/^(?:open|show|bring up|launch)\s+(?:the\s+)?(.+?)(?:\s+(?:panel|module|app|window))?$/i);
  if (openPanelMatch) {
    const panel = normalizeJarvisPanelName(openPanelMatch[1]);
    if (panel) {
      return { kind: "open_jarvis_panel", panel };
    }
  }

  const closePanelMatch = trimmed.match(/^(?:close|dismiss|hide)\s+(?:the\s+)?(.+?)(?:\s+(?:panel|module|app|window))?$/i);
  if (closePanelMatch) {
    const target = closePanelMatch[1].trim().toLowerCase();
    if (["all", "everything", "all panels", "all modules"].includes(target)) {
      return { kind: "close_jarvis_panel" };
    }
    const panel = normalizeJarvisPanelName(target);
    if (panel) {
      return { kind: "close_jarvis_panel", panel };
    }
  }

  const minimizePanelMatch = trimmed.match(/^(?:minimize|collapse)\s+(?:the\s+)?(.+?)(?:\s+(?:panel|module|app|window))?$/i);
  if (minimizePanelMatch) {
    const target = minimizePanelMatch[1].trim().toLowerCase();
    if (["all", "everything", "all panels", "all modules"].includes(target)) {
      return { kind: "minimize_jarvis_panel" };
    }
    const panel = normalizeJarvisPanelName(target);
    if (panel) {
      return { kind: "minimize_jarvis_panel", panel };
    }
  }

  if (
    /\b(take|capture|grab)\s+(a\s+)?screenshot\b/i.test(normalized) ||
    /\bscreenshot\s+(this|screen|desktop)\b/i.test(normalized)
  ) {
    return { kind: "capture_desktop_screenshot" };
  }

  if (
    normalized === "open screenshots" ||
    normalized === "open screenshots folder" ||
    normalized === "show screenshots" ||
    normalized === "show screenshots folder"
  ) {
    return { kind: "open_screenshots_folder" };
  }

  if (
    normalized === "show clipboard" ||
    normalized === "read clipboard" ||
    normalized === "what is on my clipboard" ||
    normalized === "what's on my clipboard"
  ) {
    return { kind: "read_clipboard_text" };
  }

  if (
    normalized === "open clipboard" ||
    normalized === "open clipboard target" ||
    normalized === "open what is on my clipboard" ||
    normalized === "open what's on my clipboard"
  ) {
    return { kind: "open_clipboard_target" };
  }

  if (
    normalized === "search clipboard" ||
    normalized === "search clipboard on google" ||
    normalized === "search what is on my clipboard" ||
    normalized === "search what's on my clipboard" ||
    normalized === "google my clipboard"
  ) {
    return { kind: "search_clipboard_on_google" };
  }

  if (
    normalized === "save clipboard to notion" ||
    normalized === "save my clipboard to notion" ||
    normalized === "make a notion note from clipboard" ||
    normalized === "make a note from clipboard"
  ) {
    return { kind: "save_clipboard_to_notion" };
  }

  if (
    normalized === "take screenshot and save to notion" ||
    normalized === "take a screenshot and save to notion" ||
    normalized === "screenshot to notion" ||
    normalized === "capture screenshot to notion"
  ) {
    return { kind: "save_screenshot_to_notion" };
  }

  if (
    normalized === "save last screenshot to notion" ||
    normalized === "save the last screenshot to notion"
  ) {
    return { kind: "save_last_screenshot_to_notion" };
  }

  if (normalized === "read last screenshot") {
    return { kind: "read_screen_text", useLast: true };
  }

  if (
    normalized === "select ocr area" ||
    normalized === "select global ocr area" ||
    normalized === "select desktop ocr area" ||
    normalized === "global ocr selection" ||
    normalized === "select screen area" ||
    normalized === "read selected box"
  ) {
    return { kind: "begin_ocr_region_selection" };
  }

  if (
    normalized === "select app ocr area" ||
    normalized === "select jarvis ocr area" ||
    normalized === "drag select ocr"
  ) {
    return { kind: "begin_app_ocr_region_selection" };
  }

  if (
    normalized === "show ocr history" ||
    normalized === "show screen read history" ||
    normalized === "show screen history"
  ) {
    return { kind: "show_ocr_history" };
  }

  const searchOcrHistoryMatch = trimmed.match(/^(?:find|search)\s+(?:ocr|screen read|screen|screen history)\s+(?:history\s+)?(?:for|about)\s+(.+)$/i);
  if (searchOcrHistoryMatch) {
    const query = searchOcrHistoryMatch[1].trim();
    return { kind: "search_ocr_history", query, label: `matching "${query}"` };
  }

  const sourceOcrHistoryMatch = trimmed.match(/^show\s+(?:ocr|screen read|screen)\s+history\s+from\s+(.+)$/i);
  if (sourceOcrHistoryMatch) {
    const source = normalizeDesktopTarget(sourceOcrHistoryMatch[1]);
    return { kind: "search_ocr_history", source, label: `from ${source}` };
  }

  const timeOcrHistoryMatch = trimmed.match(/^show\s+(?:ocr|screen read|screen)\s+history\s+(today|from last hour|this week)$/i);
  if (timeOcrHistoryMatch) {
    const label = timeOcrHistoryMatch[1];
    const since = getOcrHistorySince(label);
    if (since) {
      return { kind: "search_ocr_history", since, label };
    }
  }

  if (
    normalized === "save ocr history to notion" ||
    normalized === "save screen history to notion" ||
    normalized === "save screen read history to notion"
  ) {
    return { kind: "save_ocr_history_to_notion" };
  }

  const readRegionMatch = trimmed.match(
    /^read\s+(?:the\s+)?(selected|selection|center|middle|top|bottom|left|right|top left|top right|bottom left|bottom right)(?:\s+(?:area|region|half|corner))?$/i,
  );
  if (readRegionMatch) {
    const region = normalizeOcrRegion(readRegionMatch[1]);
    if (region) {
      return { kind: "read_screen_text", scope: "region", region };
    }
  }

  if (
    normalized === "read active window" ||
    normalized === "read focused window" ||
    normalized === "ocr active window" ||
    normalized === "extract text from active window"
  ) {
    return { kind: "read_screen_text", scope: "active_window" };
  }

  const readAppWindowMatch = trimmed.match(/^(?:read|ocr)\s+(?:the\s+)?(.+?)(?:\s+window|\s+app)?$/i);
  if (readAppWindowMatch) {
    const appName = normalizeDesktopTarget(readAppWindowMatch[1]);
    if (desktopAppAliases.has(appName)) {
      return { kind: "read_screen_text", scope: "app_window", appName };
    }
  }

  if (
    normalized === "read screen" ||
    normalized === "read my screen" ||
    normalized === "ocr screen" ||
    normalized === "extract text from screen" ||
    normalized === "extract screen text"
  ) {
    return { kind: "read_screen_text" };
  }

  if (
    normalized === "save screen text to notion" ||
    normalized === "save screenshot text to notion" ||
    normalized === "ocr screen to notion" ||
    normalized === "read screen and save to notion"
  ) {
    return { kind: "save_screen_text_to_notion" };
  }

  if (
    normalized === "save active window text to notion" ||
    normalized === "save focused window text to notion" ||
    normalized === "read active window and save to notion"
  ) {
    return { kind: "save_screen_text_to_notion", scope: "active_window" };
  }

  const saveRegionTextMatch = trimmed.match(
    /^save\s+(?:the\s+)?(selected|selection|center|middle|top|bottom|left|right|top left|top right|bottom left|bottom right)(?:\s+(?:area|region|half|corner))?\s+text\s+(?:to|in)\s+notion$/i,
  );
  if (saveRegionTextMatch) {
    const region = normalizeOcrRegion(saveRegionTextMatch[1]);
    if (region) {
      return { kind: "save_screen_text_to_notion", scope: "region", region };
    }
  }

  const saveAppWindowTextMatch = trimmed.match(
    /^(?:save|read)\s+(?:the\s+)?(.+?)(?:\s+window|\s+app)?\s+text\s+(?:to|in)\s+notion$/i,
  );
  if (saveAppWindowTextMatch) {
    const appName = normalizeDesktopTarget(saveAppWindowTextMatch[1]);
    if (desktopAppAliases.has(appName)) {
      return { kind: "save_screen_text_to_notion", scope: "app_window", appName };
    }
  }

  if (
    normalized === "screen to task list" ||
    normalized === "make task list from screen" ||
    normalized === "create tasks from screen" ||
    normalized === "turn screen into tasks"
  ) {
    return { kind: "create_screen_task_list" };
  }

  const regionTaskListMatch = trimmed.match(
    /^(?:make|create|turn)\s+(?:a\s+)?(?:task\s+list|tasks)\s+from\s+(?:the\s+)?(selected|selection|center|middle|top|bottom|left|right|top left|top right|bottom left|bottom right)(?:\s+(?:area|region|half|corner))?$/i,
  );
  if (regionTaskListMatch) {
    const region = normalizeOcrRegion(regionTaskListMatch[1]);
    if (region) {
      return { kind: "create_screen_task_list", scope: "region", region };
    }
  }

  if (
    normalized === "active window to task list" ||
    normalized === "make task list from active window" ||
    normalized === "create tasks from active window" ||
    normalized === "turn active window into tasks"
  ) {
    return { kind: "create_screen_task_list", scope: "active_window" };
  }

  const appWindowTaskListMatch = trimmed.match(
    /^(?:make|create|turn)\s+(?:a\s+)?(?:task\s+list|tasks)\s+from\s+(?:the\s+)?(.+?)(?:\s+window|\s+app)?$/i,
  );
  if (appWindowTaskListMatch) {
    const appName = normalizeDesktopTarget(appWindowTaskListMatch[1]);
    if (desktopAppAliases.has(appName)) {
      return { kind: "create_screen_task_list", scope: "app_window", appName };
    }
  }

  if (normalized === "stop watching screen" || normalized === "stop screen watch" || normalized === "stop ocr watch") {
    return { kind: "stop_ocr_watch" };
  }

  if (normalized === "pause ocr watches" || normalized === "pause screen watches" || normalized === "pause watching screen") {
    return { kind: "pause_ocr_watches" };
  }

  if (normalized === "resume ocr watches" || normalized === "resume screen watches" || normalized === "resume watching screen") {
    return { kind: "resume_ocr_watches" };
  }

  if (normalized === "show ocr watches" || normalized === "show screen watches" || normalized === "show watch dashboard") {
    return { kind: "show_ocr_watches" };
  }

  const namedWatchControlMatch = trimmed.match(/^(pause|resume|delete|remove)\s+(?:ocr\s+)?watch\s+(.+)$/i);
  if (namedWatchControlMatch) {
    const action = namedWatchControlMatch[1].toLowerCase();
    const name = namedWatchControlMatch[2].trim();
    if (action === "pause") return { kind: "pause_ocr_watch_by_name", name };
    if (action === "resume") return { kind: "resume_ocr_watch_by_name", name };
    return { kind: "delete_ocr_watch_by_name", name };
  }

  const nameWatchMatch = trimmed.match(/^(?:save|name|rename)\s+(?:this|latest|current)\s+(?:ocr\s+)?watch\s+(?:as|to)\s+(.+)$/i);
  if (nameWatchMatch) {
    return { kind: "name_latest_ocr_watch", name: nameWatchMatch[1].trim() };
  }

  const saveWatchTemplateMatch = trimmed.match(/^save\s+(?:this|latest|current)\s+(?:ocr\s+)?watch\s+template\s+(?:as|to)\s+(.+)$/i);
  if (saveWatchTemplateMatch) {
    return { kind: "save_latest_ocr_watch_template", name: saveWatchTemplateMatch[1].trim() };
  }

  const startTemplateMatch = trimmed.match(/^start\s+(.+?)\s+(?:watch\s+)?(?:template\s+)?on\s+(.+)$/i);
  if (startTemplateMatch) {
    const templateName = startTemplateMatch[1].trim();
    const appName = normalizeDesktopTarget(startTemplateMatch[2]);
    if (desktopAppAliases.has(appName)) {
      return { kind: "start_ocr_watch_template", templateName, appName };
    }
  }

  if (normalized === "clear ocr history" || normalized === "clear screen read history") {
    return { kind: "clear_ocr_history" };
  }

  if (normalized === "export ocr history" || normalized === "copy ocr history" || normalized === "copy ocr history to clipboard") {
    return { kind: "export_ocr_history_to_clipboard" };
  }

  if (
    normalized === "copy latest ocr" ||
    normalized === "copy latest screen read" ||
    normalized === "copy last ocr text"
  ) {
    return { kind: "copy_latest_ocr_text" };
  }

  if (normalized === "remember this from my screen" || normalized === "remember latest ocr") {
    return { kind: "remember_latest_ocr" };
  }

  const correctOcrMatch = trimmed.match(/^correct\s+ocr\s+(.+?)\s+to\s+(.+)$/i);
  if (correctOcrMatch) {
    return { kind: "correct_ocr_text", from: correctOcrMatch[1].trim(), to: correctOcrMatch[2].trim() };
  }

  if (normalized === "summarize screen" || normalized === "briefly summarize this screen") {
    return { kind: "summarize_screen", mode: "brief" };
  }
  if (normalized === "explain this error" || normalized === "explain screen error") {
    return { kind: "summarize_screen", mode: "error" };
  }
  if (normalized === "make study notes from this screen") {
    return { kind: "summarize_screen", mode: "study_notes" };
  }
  if (normalized === "turn this screen into flashcards") {
    return { kind: "summarize_screen", mode: "flashcards" };
  }

  const watchMatch = trimmed.match(
    /^watch\s+(?:the\s+)?(.+?)(?:\s+(?:for\s+changes|with\s+ocr))?(?:\s+(?:for|if)\s+(errors?|price|price\s+(?:below|under|above|over)\s+[$₹€£]?\s?\d+(?:[.,]\d{1,2})?|keyword\s+.+?))?(?:\s+(?:and\s+)?(?:log|save)\s+(?:to|in)\s+notion)?(?:\s+(?:and\s+)?create\s+(?:a\s+)?task)?(?:\s+and\s+open\s+(.+?))?(?:\s+and\s+copy\s+(?:text|ocr))?(?:\s+every\s+(.+))?$/i,
  );
  if (watchMatch) {
    const target = watchMatch[1].trim();
    const ruleLabel = watchMatch[2]?.trim();
    const actionLabel = watchMatch[3]?.trim();
    const intervalMs = parseWatchIntervalMs(watchMatch[4]);
    const logToNotion = /\b(log|save)\s+(?:to|in)\s+notion\b/i.test(trimmed);
    const createTaskOnMatch = /\bcreate\s+(?:a\s+)?task\b/i.test(trimmed);
    const copyOnMatch = /\band\s+copy\s+(?:text|ocr)\b/i.test(trimmed);
    const normalizedAction = actionLabel ? normalizeDesktopTarget(actionLabel.replace(/\b(workspace|desktop project)\b/gi, "").trim()) : "";
    const action: OcrWatchAction | undefined = copyOnMatch
      ? { type: "copy_text" }
      : actionLabel && /\b(workspace|desktop project)\b/i.test(actionLabel)
        ? { type: "open_workspace", query: normalizeDesktopProjectName(actionLabel) }
        : normalizedAction && desktopAppAliases.has(normalizedAction)
          ? { type: "open_app", appName: normalizedAction }
          : undefined;
    const rule: OcrWatchRule | undefined = ruleLabel
      ? /^errors?$/i.test(ruleLabel)
        ? { type: "error" }
        : /^price$/i.test(ruleLabel)
          ? { type: "price" }
          : /^price\s+(?:below|under)\s+/i.test(ruleLabel)
            ? { type: "price_below", amount: Number(ruleLabel.replace(/^price\s+(?:below|under)\s+[$₹€£]?\s?/i, "").replace(",", ".")) }
            : /^price\s+(?:above|over)\s+/i.test(ruleLabel)
              ? { type: "price_above", amount: Number(ruleLabel.replace(/^price\s+(?:above|over)\s+[$₹€£]?\s?/i, "").replace(",", ".")) }
          : /^keyword\s+(.+)$/i.test(ruleLabel)
            ? { type: "keyword", keyword: ruleLabel.replace(/^keyword\s+/i, "").trim() }
            : undefined
      : undefined;
    const normalizedTarget = normalizeDesktopTarget(target);
    if (normalizedTarget === "screen" || normalizedTarget === "my screen") {
      return { kind: "start_ocr_watch", scope: "screen", intervalMs, logToNotion, createTaskOnMatch, action, rule };
    }
    if (normalizedTarget === "active window" || normalizedTarget === "focused window") {
      return { kind: "start_ocr_watch", scope: "active_window", intervalMs, logToNotion, createTaskOnMatch, action, rule };
    }
    const region = normalizeOcrRegion(normalizedTarget);
    if (region) {
      return { kind: "start_ocr_watch", scope: "region", region, intervalMs, logToNotion, createTaskOnMatch, action, rule };
    }
    if (desktopAppAliases.has(normalizedTarget)) {
      return { kind: "start_ocr_watch", scope: "app_window", appName: normalizedTarget, intervalMs, logToNotion, createTaskOnMatch, action, rule };
    }
  }

  if (normalized === "clean clipboard" || normalized === "cleanup clipboard") {
    return { kind: "cleanup_clipboard", mode: "clean" };
  }

  if (normalized === "summarize clipboard" || normalized === "summarise clipboard") {
    return { kind: "cleanup_clipboard", mode: "summarize" };
  }

  if (normalized === "format clipboard" || normalized === "make clipboard a list") {
    return { kind: "cleanup_clipboard", mode: "format" };
  }

  if (
    normalized === "run project checks" ||
    normalized === "run jarvis checks" ||
    normalized === "check the project"
  ) {
    return { kind: "run_project_checks" };
  }

  if (normalized === "show desktop permissions" || normalized === "show desktop safety settings") {
    return { kind: "show_desktop_permissions" };
  }

  const permissionMatch = trimmed.match(
    /^(turn\s+on|turn\s+off|enable|disable)\s+(project\s+checks?|app\s+close|close\s+app|executor\s+launch|coding\s+agent)\s+confirmations?$/i,
  );
  if (permissionMatch) {
    const enabled = /turn\s+on|enable/i.test(permissionMatch[1]);
    const target = permissionMatch[2].toLowerCase();
    const permission: keyof DesktopPermissionSettings = /project/.test(target)
      ? "confirmProjectChecks"
      : /executor|coding/.test(target)
        ? "confirmExecutorLaunch"
        : "confirmAppClose";
    return { kind: "set_desktop_permission", permission, enabled };
  }

  if (
    normalized === "open project in vs code" ||
    normalized === "open jarvis in vs code" ||
    normalized === "open repo in vs code"
  ) {
    return { kind: "open_project_in_vscode" };
  }

  if (normalized === "minimize jarvis" || normalized === "minimize jarvis window") {
    return { kind: "minimize_jarvis_window" };
  }

  if (normalized === "maximize jarvis" || normalized === "maximize jarvis window") {
    return { kind: "maximize_jarvis_window" };
  }

  if (
    normalized === "restore jarvis" ||
    normalized === "restore jarvis window" ||
    normalized === "unmaximize jarvis"
  ) {
    return { kind: "restore_jarvis_window" };
  }

  const externalWindowMatch = trimmed.match(/^(minimize|maximize|close)\s+(?:the\s+)?(.+?)(?:\s+app|\s+window|\s+program)?$/i);
  if (externalWindowMatch) {
    const action = externalWindowMatch[1].toLowerCase() as "minimize" | "maximize" | "close";
    const appName = normalizeDesktopTarget(externalWindowMatch[2]);
    if (desktopAppAliases.has(appName)) {
      return { kind: "control_desktop_app_window", appName, action };
    }
  }

  const windowStatusMatch =
    trimmed.match(/^(?:is)\s+(?:the\s+)?(.+?)(?:\s+app|\s+window|\s+program)?\s+(?:open|running)$/i) ??
    trimmed.match(/^(?:check|show)\s+(?:the\s+)?(.+?)(?:\s+app|\s+window|\s+program)?$/i) ??
    trimmed.match(/^(?:status of|show status of)\s+(?:the\s+)?(.+?)(?:\s+app|\s+window|\s+program)?$/i);
  if (windowStatusMatch) {
    const appName = normalizeDesktopTarget(windowStatusMatch[1]);
    if (desktopAppAliases.has(appName)) {
      return { kind: "check_desktop_app_window_status", appName };
    }
  }

  if (
    normalized === "make task from screen" ||
    normalized === "create task from screen" ||
    normalized === "turn screen into task"
  ) {
    return { kind: "create_screen_task" };
  }

  const builderMatch = trimmed.match(/^(?:build|change|add|fix|implement)\s+(.+?)\s+(?:in|for)\s+jarvis$/i);
  if (builderMatch) {
    return { kind: "create_builder_handoff", request: builderMatch[0], launchExecutor: true };
  }

  const handoffMatch = trimmed.match(/^(?:create|make|prepare)\s+(?:a\s+)?(?:build|coding)\s+handoff\s+(?:for\s+)?(.+)$/i);
  if (handoffMatch) {
    return { kind: "create_builder_handoff", request: handoffMatch[1].trim(), launchExecutor: false };
  }

  if (
    normalized === "open that again" ||
    normalized === "open it again" ||
    normalized === "switch back" ||
    normalized === "go back to that"
  ) {
    return { kind: "open_last_desktop_context" };
  }

  if (
    normalized === "export workspaces" ||
    normalized === "export desktop projects" ||
    normalized === "copy workspaces to clipboard"
  ) {
    return { kind: "export_desktop_projects_to_clipboard" };
  }

  if (
    normalized === "import workspaces" ||
    normalized === "import desktop projects" ||
    normalized === "import workspaces from clipboard"
  ) {
    return { kind: "import_desktop_projects_from_clipboard" };
  }

  const clipboardWriteMatch = trimmed.match(/^(?:copy|put|set)\s+(.+?)\s+(?:to|on|in)\s+(?:my\s+)?clipboard$/i);
  if (clipboardWriteMatch) {
    const text = clipboardWriteMatch[1].trim();
    if (text) {
      return { kind: "write_clipboard_text", text };
    }
  }

  const folderMatch = trimmed.match(/^(?:open|show|launch)\s+(?:my\s+)?(.+?\s+folder|downloads|documents|desktop|jarvis project|project)$/i);
  if (folderMatch) {
    const folderName = normalizeDesktopTarget(folderMatch[1]);
    if (namedFolderAliases.has(folderName)) {
      return { kind: "open_named_folder", folderName };
    }
  }

  const focusMatch = trimmed.match(/^(?:focus|switch to|bring up|bring forward|go to)\s+(?:the\s+)?(.+?)(?:\s+app|\s+application|\s+window|\s+program)?$/i);
  if (focusMatch) {
    const appName = normalizeDesktopTarget(focusMatch[1]);
    if (desktopAppAliases.has(appName)) {
      return { kind: "focus_desktop_app", appName };
    }
  }

  const appMatch = trimmed.match(/^(?:open|launch|start|focus)\s+(?:the\s+)?(.+?)(?:\s+app|\s+application|\s+program)?$/i);
  if (appMatch) {
    const appName = normalizeDesktopTarget(appMatch[1]);
    if (desktopAppAliases.has(appName)) {
      return { kind: "launch_desktop_app", appName };
    }
  }

  return null;
}

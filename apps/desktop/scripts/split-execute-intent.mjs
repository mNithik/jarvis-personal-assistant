import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commandDir = path.join(__dirname, "../src/features/command");
const outDir = path.join(commandDir, "executeIntent");

const headRouter = execSync(
  "git show HEAD:apps/desktop/src/features/command/createJarvisCommandRouter.ts",
  { cwd: path.join(__dirname, "../.."), encoding: "utf8" },
);
const headLines = headRouter.split(/\r?\n/);

const tryStart = headLines.findIndex((line) => line.trim() === "try {") + 1;
const tryEnd = headLines.findIndex((line) => line.trim().startsWith("if (intent.kind.startsWith(\"spotify_\"))"));
const tryBody = headLines.slice(tryStart, tryEnd);

function findBlockStart(predicate) {
  return tryBody.findIndex((line) => predicate(line.trim()));
}

const calendarStart = findBlockStart((line) => line.startsWith("} else if (intent.kind === \"create_calendar_event\")"));
const spotifyStart = findBlockStart((line) => line.startsWith("} else if (intent.kind === \"spotify_play_query\")"));
const gmailStart = findBlockStart((line) => line.startsWith("} else if (intent.kind === \"list_unread_emails\")"));
const taskStart = findBlockStart((line) => line.startsWith("} else if (intent.kind === \"complete_task_by_index\")"));

const handlerDelegations = [
  "      } else if (await handleCalendarIntent(deps, intent)) {",
  "      } else if (await handleFileIntent(deps, intent)) {",
  "      } else if (await handlePdfIntent(deps, intent)) {",
];

const gmailDelegations = [
  "      } else if (await handleGmailIntent(deps, intent)) {",
  "      } else if (await handleEmailNotionIntent(deps, intent)) {",
];

const mergedTryBody = [
  ...tryBody.slice(0, calendarStart),
  ...handlerDelegations,
  ...tryBody.slice(spotifyStart, gmailStart),
  ...gmailDelegations,
  ...tryBody.slice(taskStart),
];

const imports = `// Legacy intent execution (gateway-off fallback). Gateway-on paths block via legacyIntentGuards.
import { getCurrentWindow } from "@tauri-apps/api/window";
import * as J from "../legacy/appHelpers";
import type { CommandIntent, CrossFeatureSuggestionRecord } from "./jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "./commandRouterTypes";
import {
  captureDesktopScreenshot,
  controlDesktopAppWindow,
  createBuildHandoffArtifact,
  createNotionNote,
  createNotionTask,
  extractImageOcrText,
  focusDesktopApp,
  getDesktopAppWindowStatus,
  launchDesktopApp,
  launchExecutorHandoff,
  launchStudySetup,
  openBrowserUrl,
  openLocalFile,
  openNamedFolder,
  openScreenshotsFolder,
  readClipboardText,
  runJarvisProjectChecks,
  searchGoogle,
  writeClipboardText,
} from "../../services/jarvisApi";
import { createGoogleCalendarEvent } from "../../services/googleCalendar";
import { listUnreadGmailMessages } from "../../services/gmail";
import {
  playSpotifySearchResult,
  queueSpotifyTrack,
  saveSpotifyTrack,
  searchSpotifyPlayable,
  spotifyPausePlayback,
  spotifyResumePlayback,
  spotifySkipToNext,
  spotifySkipToPrevious,
} from "../../services/spotify";
import { handleCalendarIntent } from "./handlers/calendarHandlers";
import { handleEmailNotionIntent } from "./handlers/emailNotionHandlers";
import { handleFileIntent } from "./handlers/fileHandlers";
import { handleGmailIntent } from "./handlers/gmailHandlers";
import { handlePdfIntent } from "./handlers/pdfHandlers";
import { blockLegacyIntent } from "./legacyIntentGuards";
`;

const executeIntentRouter = `${imports}
export function createExecuteIntent(deps: ResolvedCommandRouterDeps) {
  async function executeIntent(intent: CommandIntent): Promise<boolean> {
    deps.setIsRoutingCommand(true);
    deps.setVoiceSessionPhase("processing");
    deps.setStatusMessage("Routing command through JARVIS.");
    let completed = false;

    if (blockLegacyIntent(deps, intent)) {
      deps.setIsRoutingCommand(false);
      return false;
    }

    try {
${mergedTryBody.join("\n")}

      if (intent.kind.startsWith("spotify_")) {
        deps.setActiveConversationContext(J.createActiveBrowserContext("https://open.spotify.com/"));
      }

      completed = true;
      await deps.loadMemoryView();
    } catch (error) {
      deps.setVoiceSessionPhase("error");
      deps.setCommandResult({
        title: "Command failed",
        detail: J.getErrorDetail(
          error,
          "JARVIS could not complete that browser or study action through the native bridge.",
        ),
      });
      deps.appendConversationTurn("jarvis", J.buildFailureReply());
      deps.speakIfEnabled("I could not complete that.");
    } finally {
      deps.setIsRoutingCommand(false);
    }

    return completed;
  }

  return executeIntent;
}

export function createCrossFeatureHandler(
  deps: ResolvedCommandRouterDeps,
  executeIntent: (intent: CommandIntent) => Promise<boolean>,
) {
  async function handleApplyCrossFeatureSuggestion(suggestion: CrossFeatureSuggestionRecord) {
    const intents = suggestion.intents ?? (suggestion.intent ? [suggestion.intent] : []);
    if (intents.length === 0) {
      return;
    }

    let completed = true;
    for (const intent of intents) {
      const stepCompleted = await executeIntent(intent);
      if (!stepCompleted) {
        completed = false;
        break;
      }
    }
    if (completed) {
      deps.setCrossFeatureSuggestions((current) =>
        current.filter((entry) => entry.id !== suggestion.id),
      );
      deps.setProactiveCrossSuggestion((current) => (current?.id === suggestion.id ? null : current));
    }
  }
  return handleApplyCrossFeatureSuggestion;
}
`;

const tempRouterPath = path.join(commandDir, ".executeIntentRouter.rebuild.ts");
fs.writeFileSync(tempRouterPath, executeIntentRouter);

// --- split into domain modules ---

const KIND_DOMAIN = {
  open_clipboard_target: "clipboard",
  search_clipboard_on_google: "clipboard",
  save_clipboard_to_notion: "clipboard",
  export_ocr_history_to_clipboard: "clipboard",
  export_desktop_projects_to_clipboard: "clipboard",
  read_clipboard_text: "clipboard",
  write_clipboard_text: "clipboard",
  cleanup_clipboard: "clipboard",

  study_setup: "desktop",
  launch_desktop_app: "desktop",
  focus_desktop_app: "desktop",
  open_named_folder: "desktop",
  capture_desktop_screenshot: "desktop",
  open_screenshots_folder: "desktop",
  save_screenshot_to_notion: "desktop",
  save_last_screenshot_to_notion: "desktop",
  create_desktop_project: "desktop",
  create_desktop_project_template: "desktop",
  list_desktop_projects: "desktop",
  add_app_to_desktop_project: "desktop",
  add_folder_to_desktop_project: "desktop",
  add_website_to_desktop_project: "desktop",
  rename_desktop_project: "desktop",
  delete_desktop_project: "desktop",
  remove_app_from_desktop_project: "desktop",
  remove_folder_from_desktop_project: "desktop",
  remove_website_from_desktop_project: "desktop",
  open_desktop_project: "desktop",
  schedule_desktop_project: "desktop",
  start_desktop_project_for_duration: "desktop",
  list_desktop_schedules: "desktop",
  run_project_checks: "desktop",
  open_project_in_vscode: "desktop",
  control_desktop_app_window: "desktop",
  check_desktop_app_window_status: "desktop",
  show_desktop_permissions: "desktop",
  set_desktop_permission: "desktop",
  open_last_desktop_context: "desktop",
  google_search: "desktop",
  open_url: "desktop",

  open_jarvis_panel: "shell",
  close_jarvis_panel: "shell",
  minimize_jarvis_panel: "shell",
  set_shell_bar: "shell",
  set_cockpit_mode: "shell",
  set_home_app: "shell",
  set_conversation_backend: "shell",
  minimize_jarvis_window: "shell",
  maximize_jarvis_window: "shell",
  restore_jarvis_window: "shell",
  set_voice_reply_mode: "shell",
  report_voice_reply_mode: "shell",
  open_current_browser_target: "shell",
  standby_mode: "shell",
  sleep_mode: "shell",
  shutdown_app: "shell",

  test_model_provider: "model",
  explain_model_route: "model",
  generate_model_draft: "model",
  copy_latest_model_draft: "model",
  save_latest_model_draft_to_notion: "model",
  run_model_benchmark: "model",
  compare_model_responses: "model",
  choose_model_comparison_winner: "model",
  recommend_model_routes: "model",
  set_model_provider_for_task: "model",
  set_private_model_mode: "model",

  read_screen_text: "ocr",
  save_screen_text_to_notion: "ocr",
  begin_ocr_region_selection: "ocr",
  begin_app_ocr_region_selection: "ocr",
  start_ocr_watch: "ocr",
  stop_ocr_watch: "ocr",
  name_latest_ocr_watch: "ocr",
  pause_ocr_watch_by_name: "ocr",
  resume_ocr_watch_by_name: "ocr",
  delete_ocr_watch_by_name: "ocr",
  save_latest_ocr_watch_template: "ocr",
  start_ocr_watch_template: "ocr",
  pause_ocr_watches: "ocr",
  resume_ocr_watches: "ocr",
  show_ocr_watches: "ocr",
  show_ocr_history: "ocr",
  search_ocr_history: "ocr",
  save_ocr_history_to_notion: "ocr",
  clear_ocr_history: "ocr",
  copy_latest_ocr_text: "ocr",
  correct_ocr_text: "ocr",
  remember_latest_ocr: "ocr",
  summarize_screen: "ocr",
  create_screen_task_list: "ocr",
  create_screen_task: "ocr",

  create_builder_handoff: "builder",

  remember_person_birthday: "memory",
  list_birthdays: "memory",
  list_upcoming_birthdays: "memory",
  show_person_birthday: "memory",
  update_person_relationship: "memory",
  update_person_age: "memory",
  add_person_gift_note: "memory",
  add_person_contact_note: "memory",
  set_person_last_contact: "memory",
  set_person_follow_up: "memory",
  list_people_follow_ups: "memory",
  list_people_check_ins: "memory",
  set_person_birthday_reminder: "memory",
  add_person_birthday_to_calendar: "memory",
  list_travel_memory: "memory",
  show_current_travel_checklist: "memory",
  show_current_travel_timeline: "memory",
  list_expense_memory: "memory",
  list_weekly_expenses: "memory",
  list_monthly_expenses: "memory",
  list_monthly_expenses_by_category: "memory",
  list_recurring_expenses: "memory",
  list_package_memory: "memory",
  list_packages_arriving_tomorrow: "memory",
  list_delayed_packages: "memory",
  list_meeting_prep_memory: "memory",
  list_school_memory: "memory",
  create_school_plan: "memory",
  save_school_plan_to_notion: "memory",

  create_note: "notion",
  create_task_note: "notion",
  list_notes: "notion",
  search_notes: "notion",
  read_current_note: "notion",
  read_note_by_index: "notion",
  open_current_note: "notion",
  open_note_by_index: "notion",
  list_today_tasks: "notion",
  list_upcoming_tasks: "notion",
  list_overdue_tasks: "notion",
  list_done_tasks: "notion",
  list_open_tasks: "notion",
  filter_tasks_by_query: "notion",
  complete_task_by_index: "notion",
  complete_task_by_query: "notion",
  update_task_by_index: "notion",
  update_task_by_query: "notion",
  reopen_task_by_index: "notion",
  reopen_task_by_query: "notion",
  move_task_by_index: "notion",
  move_task_by_query: "notion",
  complete_current_task: "notion",
  reopen_current_task: "notion",
  move_current_task: "notion",
  complete_all_overdue_tasks: "notion",
  complete_task_range: "notion",
  create_daily_brief: "notion",
};

const DOMAIN_ORDER = [
  "clipboard",
  "desktop",
  "shell",
  "model",
  "ocr",
  "builder",
  "memory",
  "notion",
  "integrations",
];

function extractKindsFromCondition(condition) {
  const kinds = [];
  const regex = /intent\.kind\s*===\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(condition)) !== null) {
    kinds.push(match[1]);
  }
  return kinds;
}

function guessDomain(condition) {
  const kinds = extractKindsFromCondition(condition);
  if (kinds.length > 0) {
    const domains = kinds.map((kind) => KIND_DOMAIN[kind]).filter(Boolean);
    if (domains.length > 0) {
      const unique = [...new Set(domains)];
      if (unique.length === 1) {
        return unique[0];
      }
    }

    const kind = kinds[0];
    if (kind.startsWith("spotify_")) return "integrations";
    if (kind.includes("clipboard")) return "clipboard";
    if (kind.includes("ocr") || kind.startsWith("read_screen") || kind.startsWith("summarize_screen")) {
      return "ocr";
    }
    if (kind.includes("desktop") || kind.includes("screenshot") || kind === "study_setup") {
      return "desktop";
    }
    if (kind.includes("jarvis") || kind.includes("cockpit") || kind.includes("shell")) {
      return "shell";
    }
    if (kind.includes("model")) return "model";
    if (kind.includes("notion") || kind.includes("task") || kind.includes("note")) return "notion";
    if (
      kind.includes("email") ||
      kind.includes("gmail") ||
      kind.includes("calendar") ||
      kind.includes("pdf") ||
      kind.includes("file")
    ) {
      return "integrations";
    }
    if (
      kind.includes("birthday") ||
      kind.includes("person") ||
      kind.includes("travel") ||
      kind.includes("expense") ||
      kind.includes("package") ||
      kind.includes("meeting") ||
      kind.includes("school") ||
      kind.includes("brief")
    ) {
      return "memory";
    }
  }

  if (condition.includes("handleCalendarIntent")) return "integrations";
  if (condition.includes("handleFileIntent")) return "integrations";
  if (condition.includes("handlePdfIntent")) return "integrations";
  if (condition.includes("handleGmailIntent")) return "integrations";
  if (condition.includes("handleEmailNotionIntent")) return "integrations";
  if (condition.includes("spotify_")) return "integrations";

  throw new Error(`Could not assign domain for condition: ${condition.slice(0, 160)}`);
}

function isBranchHeader(line) {
  return /^      if \(/.test(line) || /^      \} else if \(/.test(line);
}

function trimBranchBody(lines) {
  const copy = [...lines];
  while (copy.length > 0) {
    const last = copy[copy.length - 1];
    if (last.trim() === "" || /^      \}$/.test(last)) {
      copy.pop();
      continue;
    }
    break;
  }
  return copy;
}

function parseTopLevelBlocks(sourceLines) {
  const headers = [];

  for (let i = 0; i < sourceLines.length; i++) {
    if (!isBranchHeader(sourceLines[i])) {
      continue;
    }

    const headerLines = [sourceLines[i]];
    let j = i;
    while (j < sourceLines.length && !headerLines.join("\n").includes(") {")) {
      j += 1;
      if (j < sourceLines.length) {
        headerLines.push(sourceLines[j]);
      }
    }

    const rawHeader = headerLines.join(" ").trim();
    const condition = rawHeader
      .replace(/^if \(/, "")
      .replace(/^} else if \(/, "")
      .replace(/\) \{\s*$/, "")
      .trim();

    headers.push({
      condition,
      bodyStart: j + 1,
      headerStart: i,
    });
    i = j;
  }

  const blocks = [];
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];
    const bodyEnd =
      index + 1 < headers.length ? headers[index + 1].headerStart : sourceLines.length;
    const body = trimBranchBody(sourceLines.slice(header.bodyStart, bodyEnd));
    blocks.push({
      condition: header.condition,
      body,
      domain: guessDomain(header.condition),
    });
  }

  return blocks;
}

function transformBody(bodyLines) {
  const transformed = [];
  for (const line of bodyLines) {
    if (line.trim() === "completed = false;") {
      transformed.push('        return { status: "return", completed: false };');
      continue;
    }
    if (line.trim() === "completed = true;") {
      continue;
    }
    if (line.trim() === "return;" || line.trim() === "return false;") {
      transformed.push('        return { status: "return", completed: false };');
      continue;
    }
    if (line.trim() === "return completed;") {
      transformed.push('        return { status: "return", completed: true };');
      continue;
    }
    transformed.push(line);
  }
  return transformed;
}

function buildDomainHandler(domain, blocks) {
  const fnName =
    domain === "integrations"
      ? "handleIntegrationsIntent"
      : `handle${domain[0].toUpperCase()}${domain.slice(1)}Intent`;

  const lines = [];
  blocks.forEach((block, index) => {
    const prefix = index === 0 ? "  if" : "  } else if";
    lines.push(`${prefix} (${block.condition}) {`);
    if (block.condition.startsWith("await handle")) {
      lines.push('    return { status: "handled" };');
      return;
    }

    const transformedBody = transformBody(block.body);
    lines.push(...transformedBody);
    const hasExplicitReturn = transformedBody.some((line) =>
      line.includes('return { status: "return"'),
    );
    if (!hasExplicitReturn) {
      lines.push('    return { status: "handled" };');
    }
  });
  if (blocks.length > 0) {
    lines.push("  }");
  }
  lines.push('  return { status: "unhandled" };');

  return { fnName, body: lines.join("\n") };
}

const rebuildLines = mergedTryBody;
const blocks = parseTopLevelBlocks(rebuildLines);
const byDomain = Object.fromEntries(DOMAIN_ORDER.map((domain) => [domain, []]));
for (const block of blocks) {
  byDomain[block.domain].push(block);
}

fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, "types.ts"),
  `import type { CommandIntent } from "../jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";

export type ExecuteIntentFn = (intent: CommandIntent) => Promise<boolean>;

export type ExecuteIntentResult =
  | { status: "handled" }
  | { status: "return"; completed: boolean }
  | { status: "unhandled" };

export type ExecuteIntentHandler = (
  deps: ResolvedCommandRouterDeps,
  intent: CommandIntent,
  executeIntent: ExecuteIntentFn,
) => Promise<ExecuteIntentResult>;
`,
);

const DOMAIN_IMPORTS = {
  clipboard: `import * as J from "../../legacy/appHelpers";
import type { DesktopProjectRecord } from "../jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import {
  createNotionNote,
  openBrowserUrl,
  openLocalFile,
  readClipboardText,
  searchGoogle,
  writeClipboardText,
} from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";
`,
  desktop: `import { getCurrentWindow } from "@tauri-apps/api/window";
import * as J from "../../legacy/appHelpers";
import type { DesktopPermissionSettings, DesktopScheduleRecord } from "../jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import {
  captureDesktopScreenshot,
  controlDesktopAppWindow,
  createNotionNote,
  focusDesktopApp,
  getDesktopAppWindowStatus,
  launchDesktopApp,
  openBrowserUrl,
  openLocalFile,
  openNamedFolder,
  openScreenshotsFolder,
  runJarvisProjectChecks,
  launchStudySetup,
  searchGoogle,
} from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";
`,
  shell: `import { getCurrentWindow } from "@tauri-apps/api/window";
import * as J from "../../legacy/appHelpers";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import { openBrowserUrl } from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";
`,
  model: `import * as J from "../../legacy/appHelpers";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import { createNotionNote, writeClipboardText } from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";
`,
  ocr: `import * as J from "../../legacy/appHelpers";
import type { OcrWatchTarget, OcrWatchTemplate } from "../jarvisCommandTypes";
import type { NoteRecord } from "../../../types/jarvis";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import {
  captureDesktopScreenshot,
  createNotionNote,
  createNotionTask,
  extractImageOcrText,
  readClipboardText,
  writeClipboardText,
} from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";
`,
  builder: `import * as J from "../../legacy/appHelpers";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import {
  createBuildHandoffArtifact,
  launchExecutorHandoff,
} from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";
`,
  memory: `import * as J from "../../legacy/appHelpers";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import { createNotionNote, openBrowserUrl } from "../../../services/jarvisApi";
import { createGoogleCalendarEvent } from "../../../services/googleCalendar";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";
`,
  notion: `import * as J from "../../legacy/appHelpers";
import type { PlannerTaskRecord } from "../jarvisCommandTypes";
import type { NoteRecord } from "../../../types/jarvis";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import {
  createNotionNote,
  createNotionTask,
  listNotionNotes,
  openBrowserUrl,
  searchNotionNotes,
  updateNotionTask,
} from "../../../services/jarvisApi";
import { listTodayGoogleCalendarEvents } from "../../../services/googleCalendar";
import { listUnreadGmailMessages } from "../../../services/gmail";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";
`,
  integrations: `import * as J from "../../legacy/appHelpers";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import {
  playSpotifySearchResult,
  queueSpotifyTrack,
  saveSpotifyTrack,
  searchSpotifyPlayable,
  spotifyPausePlayback,
  spotifyResumePlayback,
  spotifySkipToNext,
  spotifySkipToPrevious,
} from "../../../services/spotify";
import { handleCalendarIntent } from "../handlers/calendarHandlers";
import { handleEmailNotionIntent } from "../handlers/emailNotionHandlers";
import { handleFileIntent } from "../handlers/fileHandlers";
import { handleGmailIntent } from "../handlers/gmailHandlers";
import { handlePdfIntent } from "../handlers/pdfHandlers";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";
`,
};

for (const domain of DOMAIN_ORDER) {
  const { fnName, body } = buildDomainHandler(domain, byDomain[domain]);
  const content = `${DOMAIN_IMPORTS[domain]}
export async function ${fnName}(
  deps: ResolvedCommandRouterDeps,
  intent: import("../jarvisCommandTypes").CommandIntent,
  executeIntent: ExecuteIntentFn,
): Promise<ExecuteIntentResult> {
${body}
}
`;
  fs.writeFileSync(path.join(outDir, `${domain}.ts`), content);
}

const indexContent = `import * as J from "../../legacy/appHelpers";
import type { CommandIntent, CrossFeatureSuggestionRecord } from "../jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import { blockLegacyIntent } from "../legacyIntentGuards";
import { handleBuilderIntent } from "./builder";
import { handleClipboardIntent } from "./clipboard";
import { handleDesktopIntent } from "./desktop";
import { handleIntegrationsIntent } from "./integrations";
import { handleMemoryIntent } from "./memory";
import { handleModelIntent } from "./model";
import { handleNotionIntent } from "./notion";
import { handleOcrIntent } from "./ocr";
import { handleShellIntent } from "./shell";
import type { ExecuteIntentHandler } from "./types";

const INTENT_HANDLERS: ExecuteIntentHandler[] = [
  handleClipboardIntent,
  handleDesktopIntent,
  handleShellIntent,
  handleModelIntent,
  handleOcrIntent,
  handleBuilderIntent,
  handleMemoryIntent,
  handleNotionIntent,
  handleIntegrationsIntent,
];

export function createExecuteIntent(deps: ResolvedCommandRouterDeps) {
  async function executeIntent(intent: CommandIntent): Promise<boolean> {
    deps.setIsRoutingCommand(true);
    deps.setVoiceSessionPhase("processing");
    deps.setStatusMessage("Routing command through JARVIS.");
    let completed = false;

    if (blockLegacyIntent(deps, intent)) {
      deps.setIsRoutingCommand(false);
      return false;
    }

    try {
      let handled = false;
      for (const handler of INTENT_HANDLERS) {
        const result = await handler(deps, intent, executeIntent);
        if (result.status === "return") {
          return result.completed;
        }
        if (result.status === "handled") {
          handled = true;
          break;
        }
      }

      if (handled) {
        if (intent.kind.startsWith("spotify_")) {
          deps.setActiveConversationContext(J.createActiveBrowserContext("https://open.spotify.com/"));
        }

        completed = true;
        await deps.loadMemoryView();
      }
    } catch (error) {
      deps.setVoiceSessionPhase("error");
      deps.setCommandResult({
        title: "Command failed",
        detail: J.getErrorDetail(
          error,
          "JARVIS could not complete that browser or study action through the native bridge.",
        ),
      });
      deps.appendConversationTurn("jarvis", J.buildFailureReply());
      deps.speakIfEnabled("I could not complete that.");
    } finally {
      deps.setIsRoutingCommand(false);
    }

    return completed;
  }

  return executeIntent;
}

export function createCrossFeatureHandler(
  deps: ResolvedCommandRouterDeps,
  executeIntent: (intent: CommandIntent) => Promise<boolean>,
) {
  async function handleApplyCrossFeatureSuggestion(suggestion: CrossFeatureSuggestionRecord) {
    const intents = suggestion.intents ?? (suggestion.intent ? [suggestion.intent] : []);
    if (intents.length === 0) {
      return;
    }

    let completed = true;
    for (const intent of intents) {
      const stepCompleted = await executeIntent(intent);
      if (!stepCompleted) {
        completed = false;
        break;
      }
    }
    if (completed) {
      deps.setCrossFeatureSuggestions((current) =>
        current.filter((entry) => entry.id !== suggestion.id),
      );
      deps.setProactiveCrossSuggestion((current) => (current?.id === suggestion.id ? null : current));
    }
  }
  return handleApplyCrossFeatureSuggestion;
}
`;

fs.writeFileSync(path.join(outDir, "index.ts"), indexContent);
fs.writeFileSync(
  path.join(commandDir, "executeIntentRouter.ts"),
  `export { createExecuteIntent, createCrossFeatureHandler } from "./executeIntent";\n`,
);
fs.unlinkSync(tempRouterPath);

console.log(`Rebuilt and split executeIntent (${blocks.length} blocks across ${DOMAIN_ORDER.length} modules).`);

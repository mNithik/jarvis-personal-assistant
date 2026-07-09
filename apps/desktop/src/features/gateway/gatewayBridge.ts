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

import type { CommandIntent } from "../command/jarvisCommandTypes";
import { builtInBrowserAliases, canonicalHostRoots } from "../command/jarvisCommandTypes";
import { parseExplicitCommandIntent } from "../command/parsers/explicitIntent";
import { isStudyAppsCommand } from "../command/parsers/desktopIntentUtils";
import { normalizeControlCommand } from "../semantic/intentRanking";

export { isStudyAppsCommand };

export function formatGatewayPreview(preview: GatewayPreview | null): string | null {
  const route = preview?.result.route;
  if (!route) {
    return null;
  }

  return `${route.capabilityLabel} / ${toTitleCase(route.decisionPolicy)} / ${toTitleCase(route.confidence)} confidence`;
}

export function formatGatewayFollowUp(preview: GatewayPreview | null): string | null {
  const route = preview?.result.route;
  if (!route) {
    return null;
  }

  if (route.decisionPolicy === "confirm") {
    return `Did you mean ${route.capabilityLabel}? I would confirm before acting because: ${route.decisionReason}`;
  }

  if (route.decisionPolicy === "teach") {
    return `I am not sure what this means yet. Teach me with: "when I say this, I mean..."`;
  }

  return null;
}

export function isGatewayConfirmationYes(command: string): boolean {
  return ["yes", "yeah", "yep", "sure", "ok", "okay", "confirm", "do it"].includes(
    normalizeControlCommand(command),
  );
}

export function isGatewayConfirmationNo(command: string): boolean {
  return ["no", "nope", "cancel", "stop", "never mind", "nevermind"].includes(
    normalizeControlCommand(command),
  );
}

export function toTitleCase(value: string): string {
  return value
    .split("_")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function parsePositiveInteger(value: string | null | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized || !/^\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isReadScreenCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized === "read screen" ||
    normalized === "read my screen" ||
    normalized === "ocr screen" ||
    normalized.includes("read my screen") ||
    normalized.includes("what's on screen") ||
    normalized.includes("whats on screen") ||
    normalized.includes("on screen")
  );
}

export function isSearchFilesCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.startsWith("search files for ") ||
    normalized.startsWith("find file ") ||
    normalized.startsWith("find files for ")
  );
}

export function isNotionGatewayCommand(command: string) {
  const trimmed = command.trim();
  const normalized = trimmed.toLowerCase();

  if (
    normalized === "show my notes" ||
    normalized === "list my notes" ||
    normalized === "show notes" ||
    normalized === "list notes" ||
    normalized === "what are my notes"
  ) {
    return true;
  }

  const searchPrefixes = ["search notion for ", "search notes for ", "find notion note "];
  for (const prefix of searchPrefixes) {
    if (normalized.startsWith(prefix) && trimmed.slice(prefix.length).trim()) {
      return true;
    }
  }

  const notePrefixes = [
    "make a note to ",
    "make a note ",
    "make me a note to ",
    "make me a note ",
    "create a note to ",
    "create a note ",
    "note this down: ",
    "note this down ",
    "remember this: ",
    "remember this ",
  ];
  for (const prefix of notePrefixes) {
    if (normalized.startsWith(prefix) && trimmed.slice(prefix.length).trim()) {
      return true;
    }
  }

  const taskPrefixes = ["create a task ", "add a task ", "new task "];
  for (const prefix of taskPrefixes) {
    if (normalized.startsWith(prefix) && trimmed.slice(prefix.length).trim()) {
      return true;
    }
  }

  return false;
}

export function isSpotifyGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  const mentionsSpotify = normalized.includes("spotify");
  const mentionsMusic =
    normalized.includes("music") &&
    (normalized.includes("play") || normalized.includes("pause") || normalized.includes("skip"));

  if (!mentionsSpotify && !mentionsMusic) {
    return false;
  }

  return (
    normalized.includes("play") ||
    normalized.includes("pause") ||
    normalized.includes("skip") ||
    normalized.includes("next") ||
    normalized.includes("previous")
  );
}

export function isGmailGatewayCommand(command: string) {
  const trimmed = command.trim();
  const normalized = trimmed.toLowerCase();

  if (
    normalized === "read this email" ||
    normalized === "read current email" ||
    normalized === "read the current email" ||
    normalized === "show this email"
  ) {
    return true;
  }

  if (/^(?:read|show) email \d+$/i.test(normalized)) {
    return true;
  }

  if (/^(?:read|show) (?:the )?email about .+$/i.test(normalized)) {
    return true;
  }

  if (
    normalized === "check my email" ||
    normalized === "check my emails" ||
    normalized === "check email" ||
    normalized === "check gmail" ||
    normalized === "read my email" ||
    normalized === "read my emails" ||
    normalized === "show unread emails" ||
    normalized === "list unread emails" ||
    normalized.includes("unread email")
  ) {
    return true;
  }

  return (
    normalized.startsWith("search gmail for ") ||
    normalized.startsWith("search email for ") ||
    normalized.startsWith("search emails for ") ||
    normalized.startsWith("find email ")
  );
}

export function isCalendarGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();

  if (
    normalized === "what's on my calendar today" ||
    normalized === "whats on my calendar today" ||
    normalized === "show today's events" ||
    normalized === "show todays events" ||
    normalized === "what is on my calendar today" ||
    normalized === "list today's events" ||
    normalized === "list todays events" ||
    normalized.includes("calendar today")
  ) {
    return true;
  }

  if (
    normalized === "add this email to calendar" ||
    normalized === "schedule this email" ||
    normalized === "put this meeting on my calendar" ||
    normalized === "make a calendar event from this email" ||
    normalized === "turn this email into a calendar event"
  ) {
    return true;
  }

  return (
    normalized.includes("calendar") ||
    normalized.startsWith("schedule ") ||
    (normalized.startsWith("add ") && normalized.includes("calendar"))
  );
}

export function isSlackGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.startsWith("summarize slack channel ") ||
    normalized.startsWith("summarise slack channel ") ||
    normalized.startsWith("summarize slack thread ") ||
    normalized.startsWith("summarise slack thread ") ||
    normalized.startsWith("draft a slack update for ") ||
    normalized.startsWith("send this to slack ") ||
    normalized === "save slack action items to planner" ||
    (normalized.startsWith("what changed in #") && normalized.endsWith(" today"))
  );
}

export function isOcrWatchGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  if (
    normalized === "stop watching screen" ||
    normalized === "stop screen watch" ||
    normalized === "stop ocr watch" ||
    normalized === "pause ocr watches" ||
    normalized === "resume ocr watches" ||
    normalized === "show ocr watches" ||
    normalized === "show screen watches" ||
    normalized === "show watch dashboard" ||
    normalized === "show ocr history" ||
    normalized.startsWith("search ocr history")
  ) {
    return true;
  }
  return normalized.startsWith("watch ");
}

export function isScreenshotGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.includes("screenshot") ||
    normalized === "capture screen" ||
    normalized === "capture desktop"
  );
}

export function isOcrNotionGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();

  if (isOcrWatchGatewayCommand(command)) {
    return true;
  }

  if (
    normalized === "save ocr history to notion" ||
    normalized === "save screen history to notion" ||
    normalized === "save screen read history to notion" ||
    normalized === "save screen text to notion" ||
    normalized === "save screenshot text to notion" ||
    normalized === "ocr screen to notion" ||
    normalized === "read screen and save to notion"
  ) {
    return true;
  }

  return (
    normalized.includes("notion") &&
    (normalized.includes("ocr") || normalized.includes("screen text") || normalized.includes("screen history"))
  );
}

export function isEmailNotionGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();

  if (
    normalized === "save this email to notion" ||
    normalized === "save this email as a note" ||
    normalized === "save current email to notion" ||
    normalized === "save latest email to notion" ||
    normalized === "save my latest email to notion" ||
    normalized === "save email digest to notion" ||
    normalized === "save my email digest to notion" ||
    normalized === "save unread emails to notion" ||
    normalized === "summarize unread emails into notion" ||
    normalized === "save this travel to notion" ||
    normalized === "save travel from this email to notion" ||
    normalized === "save current email travel to notion" ||
    normalized === "save this expense to notion" ||
    normalized === "save expense from this email to notion" ||
    normalized === "save current email expense to notion" ||
    normalized === "save this package to notion" ||
    normalized === "save package from this email to notion" ||
    normalized === "save current email package to notion"
  ) {
    return true;
  }

  if (/^save first \d+ emails to notion$/i.test(normalized)) {
    return true;
  }

  if (/^save email \d+ to notion$/i.test(normalized)) {
    return true;
  }

  if (/^save (?:the )?email about .+ to notion$/i.test(normalized)) {
    return true;
  }

  if (/^save travel from email \d+ to notion$/i.test(normalized)) {
    return true;
  }

  if (/^save expense from email \d+ to notion$/i.test(normalized)) {
    return true;
  }

  if (/^save package from email \d+ to notion$/i.test(normalized)) {
    return true;
  }

  if (/^save travel from (?:the )?email about .+ to notion$/i.test(normalized)) {
    return true;
  }

  if (/^save expense from (?:the )?email about .+ to notion$/i.test(normalized)) {
    return true;
  }

  if (/^save package from (?:the )?email about .+ to notion$/i.test(normalized)) {
    return true;
  }

  if (normalized.startsWith("save email to notion about ")) {
    return true;
  }

  return (
    normalized.includes("email") &&
    normalized.includes("notion") &&
    normalized.includes("save")
  );
}

export function mapIntegrationHandoffToIntent(handoff: IntegrationHandoff): CommandIntent | null {
  if (handoff.capabilityId === "integrations.spotify") {
    switch (handoff.action) {
      case "play":
        return { kind: "spotify_play" };
      case "pause":
        return { kind: "spotify_pause" };
      case "skip":
        return { kind: "spotify_next" };
      case "previous":
        return { kind: "spotify_previous" };
      case "play_query":
        if (handoff.payload?.trim()) {
          return { kind: "spotify_play_query", query: handoff.payload.trim() };
        }
        return { kind: "spotify_play" };
      default:
        return null;
    }
  }

  if (handoff.capabilityId === "integrations.google") {
    // Gmail executes in the Rust gateway; avoid TS re-entry via handoff.
    return null;
  }

  if (
    handoff.capabilityId === "command.search" ||
    handoff.capabilityId === "research.web"
  ) {
    switch (handoff.action) {
      case "search_google":
        if (handoff.payload?.trim()) {
          return { kind: "google_search", query: handoff.payload.trim() };
        }
        return null;
      default:
        return null;
    }
  }

  if (handoff.capabilityId === "command.files") {
    switch (handoff.action) {
      case "list_recent_files":
        return { kind: "list_recent_files" };
      default:
        return null;
    }
  }

  if (handoff.capabilityId === "integrations.calendar") {
    // Calendar executes in the Rust gateway; avoid TS re-entry via handoff.
    return null;
  }

  if (handoff.capabilityId === "integrations.ocr_notion") {
    switch (handoff.action) {
      case "save_ocr_history_to_notion":
        return { kind: "save_ocr_history_to_notion" };
      case "save_screen_text_to_notion":
        if (handoff.payload === "app_window") {
          return { kind: "save_screen_text_to_notion", scope: "app_window" };
        }
        return { kind: "save_screen_text_to_notion" };
      case "start_ocr_watch":
        if (handoff.payload?.trim()) {
          const watchIntent = parseExplicitCommandIntent(handoff.payload.trim(), []);
          if (watchIntent?.kind === "start_ocr_watch" || watchIntent?.kind === "start_ocr_watch_template") {
            return watchIntent;
          }
        }
        return null;
      case "stop_ocr_watch":
        return { kind: "stop_ocr_watch" };
      case "show_ocr_watches":
        return { kind: "show_ocr_watches" };
      case "pause_ocr_watches":
        return { kind: "pause_ocr_watches" };
      case "resume_ocr_watches":
        return { kind: "resume_ocr_watches" };
      default:
        return null;
    }
  }

  if (handoff.capabilityId === "integrations.email_notion") {
    switch (handoff.action) {
      case "save_current_email":
      case "save_latest_email":
        // Executed in Rust when gateway email_notion is enabled.
        return null;
      case "save_email_digest":
        return { kind: "save_email_digest_to_notion" };
      case "save_first_emails": {
        const count = Number.parseInt(handoff.payload ?? "", 10);
        if (Number.isFinite(count) && count > 0) {
          return { kind: "save_first_emails_to_notion", count };
        }
        return null;
      }
      case "save_travel_current":
        return { kind: "save_current_email_travel_to_notion" };
      case "save_expense_current":
        return { kind: "save_current_email_expense_to_notion" };
      case "save_package_current":
        return { kind: "save_current_email_package_to_notion" };
      case "save_email_by_index": {
        const index = Number.parseInt(handoff.payload ?? "", 10);
        if (Number.isFinite(index) && index > 0) {
          return { kind: "save_email_to_notion_by_index", index };
        }
        return null;
      }
      case "save_email_by_query":
        if (handoff.payload?.trim()) {
          return { kind: "save_email_to_notion_by_query", query: handoff.payload.trim() };
        }
        return null;
      case "save_travel_by_index": {
        const index = Number.parseInt(handoff.payload ?? "", 10);
        if (Number.isFinite(index) && index > 0) {
          return { kind: "save_email_travel_to_notion_by_index", index };
        }
        return null;
      }
      case "save_travel_by_query":
        if (handoff.payload?.trim()) {
          return { kind: "save_email_travel_to_notion_by_query", query: handoff.payload.trim() };
        }
        return null;
      case "save_expense_by_index": {
        const index = Number.parseInt(handoff.payload ?? "", 10);
        if (Number.isFinite(index) && index > 0) {
          return { kind: "save_email_expense_to_notion_by_index", index };
        }
        return null;
      }
      case "save_expense_by_query":
        if (handoff.payload?.trim()) {
          return { kind: "save_email_expense_to_notion_by_query", query: handoff.payload.trim() };
        }
        return null;
      case "save_package_by_index": {
        const index = Number.parseInt(handoff.payload ?? "", 10);
        if (Number.isFinite(index) && index > 0) {
          return { kind: "save_email_package_to_notion_by_index", index };
        }
        return null;
      }
      case "save_package_by_query":
        if (handoff.payload?.trim()) {
          return { kind: "save_email_package_to_notion_by_query", query: handoff.payload.trim() };
        }
        return null;
      default:
        return null;
    }
  }

  if (handoff.capabilityId === "memory.life") {
    switch (handoff.action) {
      case "create_daily_brief":
        return { kind: "create_daily_brief" };
      default:
        return null;
    }
  }

  if (handoff.capabilityId === "builder.code") {
    switch (handoff.action) {
      case "create_builder_handoff": {
        if (!handoff.payload?.trim()) {
          return null;
        }
        try {
          const parsed = JSON.parse(handoff.payload) as {
            request?: string;
            launchExecutor?: boolean;
          };
          if (parsed.request?.trim()) {
            return {
              kind: "create_builder_handoff",
              request: parsed.request.trim(),
              launchExecutor: Boolean(parsed.launchExecutor),
            };
          }
        } catch {
          return null;
        }
        return null;
      }
      case "run_project_checks":
        return { kind: "run_project_checks" };
      case "open_project_in_vscode":
        return { kind: "open_project_in_vscode" };
      default:
        return null;
    }
  }

  return null;
}

export function isBuilderGatewayCommand(command: string) {
  const trimmed = command.trim();
  const normalized = trimmed.toLowerCase();

  if (
    normalized === "run project checks" ||
    normalized === "run jarvis checks" ||
    normalized === "check the project"
  ) {
    return true;
  }

  if (
    normalized === "open project in vs code" ||
    normalized === "open jarvis in vs code" ||
    normalized === "open repo in vs code"
  ) {
    return true;
  }

  if (/^(?:build|change|add|fix|implement)\s+.+\s+(?:in|for)\s+jarvis$/i.test(trimmed)) {
    return true;
  }

  if (/^(?:create|make|prepare)\s+(?:a\s+)?(?:build|coding)\s+handoff\s+(?:for\s+).+$/i.test(trimmed)) {
    return true;
  }

  return normalized.includes("debug this repo") || normalized.includes("debug the repo");
}

export function isMemoryGatewayCommand(command: string) {
  const trimmed = command.trim();
  const normalized = trimmed.toLowerCase();

  if (
    normalized === "create daily brief" ||
    normalized === "make my daily brief" ||
    normalized === "save daily brief to notion" ||
    normalized === "generate daily brief" ||
    normalized === "brief me for today" ||
    normalized === "morning brief"
  ) {
    return true;
  }

  if (
    normalized === "show my people memory" ||
    normalized === "show people memory" ||
    normalized === "list people memory" ||
    normalized === "who is in my people memory"
  ) {
    return true;
  }

  for (const prefix of [
    "remember that ",
    "remember ",
    "save that ",
    "please remember that ",
  ]) {
    if (normalized.startsWith(prefix) && trimmed.slice(prefix.length).trim()) {
      return true;
    }
  }

  if (normalized.includes("birthday")) {
    return true;
  }

  if (normalized.startsWith("recall ") && trimmed.slice("recall ".length).trim()) {
    return true;
  }

  if (
    normalized === "show travel memory" ||
    normalized === "list travel memory" ||
    normalized === "show my travel plans"
  ) {
    return true;
  }

  if (
    normalized === "show travel checklist" ||
    normalized === "what do i need for this trip" ||
    normalized === "what do i need for this travel" ||
    normalized === "show trip timeline" ||
    normalized === "show travel timeline" ||
    normalized === "what is the trip timeline"
  ) {
    return true;
  }

  if (
    normalized === "show expense memory" ||
    normalized === "list expense memory" ||
    normalized === "show my expenses"
  ) {
    return true;
  }

  if (
    normalized === "show weekly expenses" ||
    normalized === "list weekly expenses" ||
    normalized === "what did i spend this week" ||
    normalized === "show monthly expenses" ||
    normalized === "list monthly expenses" ||
    normalized === "what did i spend this month"
  ) {
    return true;
  }

  if (/^how much did i spend on .+ this month\??$/i.test(normalized)) {
    return true;
  }

  if (
    normalized === "show subscriptions" ||
    normalized === "show recurring expenses" ||
    normalized === "list subscriptions" ||
    normalized === "list recurring expenses"
  ) {
    return true;
  }

  if (
    normalized === "show package memory" ||
    normalized === "list package memory" ||
    normalized === "show my packages"
  ) {
    return true;
  }

  if (normalized === "what's arriving tomorrow" || normalized === "what is arriving tomorrow") {
    return true;
  }

  if (normalized === "show delayed packages" || normalized === "list delayed packages") {
    return true;
  }

  if (
    normalized === "show meeting prep memory" ||
    normalized === "list meeting prep memory" ||
    normalized === "show meeting prep"
  ) {
    return true;
  }

  if (
    normalized === "show school memory" ||
    normalized === "list school memory" ||
    normalized === "show school plans"
  ) {
    return true;
  }

  return false;
}

export function isGatewaySimulationMode(config: GatewayConfig): boolean {
  return config.mode === "dry_run" || config.mode === "plan_only";
}

export function formatSimulationBlockedHandoff(
  config: GatewayConfig,
  handoff: IntegrationHandoff,
): string {
  const modeLabel = config.mode === "plan_only" ? "Plan-only" : "Dry-run";
  return `${modeLabel} mode blocked integration handoff ${handoff.capabilityId}/${handoff.action}. No side effects were executed.`;
}

export function shouldBlockLegacyCommandInSimulation(
  command: string,
  config: GatewayConfig | null | undefined,
): boolean {
  return Boolean(config && isGatewaySimulationMode(config) && shouldDelegateToGateway(command, config));
}

export function shouldDelegateToGateway(command: string, config: GatewayConfig) {
  if (!config.enabled) {
    return false;
  }
  if (isStudyAppsCommand(command) && config.features.studyRoutine) {
    return true;
  }
  if (isReadScreenCommand(command) && config.features.screenOcr) {
    return true;
  }
  if (isScreenshotGatewayCommand(command) && config.features.screenOcr) {
    return true;
  }
  if (
    isOcrWatchGatewayCommand(command) &&
    (config.features.ocrNotion || config.features.screenOcr)
  ) {
    return true;
  }
  if (isSearchFilesCommand(command)) {
    return true;
  }
  if (isNotionGatewayCommand(command) && config.features.notion) {
    return true;
  }
  if (isSpotifyGatewayCommand(command) && config.features.spotify) {
    return true;
  }
  if (isGmailGatewayCommand(command) && config.features.gmail) {
    return true;
  }
  if (isCalendarGatewayCommand(command) && config.features.calendar) {
    return true;
  }
  if (isSlackGatewayCommand(command)) {
    return true;
  }
  if (isOcrNotionGatewayCommand(command) && config.features.ocrNotion) {
    return true;
  }
  if (isEmailNotionGatewayCommand(command) && config.features.emailNotion) {
    return true;
  }
  if (isMemoryGatewayCommand(command) && config.features.memory) {
    return true;
  }
  if (isBuilderGatewayCommand(command) && config.features.builder) {
    return true;
  }
  if (isDesktopGatewayCommand(command)) {
    return true;
  }
  if (isAutomationGatewayCommand(command)) {
    return true;
  }
  if (isSupervisorGatewayCommand(command)) {
    return true;
  }
  if (isMcpGatewayCommand(command)) {
    return true;
  }
  if (isVaultGatewayCommand(command) && config.features.memory) {
    return true;
  }
  if (isResearchGatewayCommand(command)) {
    return true;
  }
  if (isPdfGatewayCommand(command)) {
    return true;
  }
  if (isGoogleSearchGatewayCommand(command)) {
    return true;
  }
  if (isClipboardGatewayCommand(command)) {
    return true;
  }
  if (isFinanceGatewayCommand(command) && config.features.memory) {
    return true;
  }
  return false;
}

export function isClipboardGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.includes("clipboard") ||
    normalized.startsWith("read clipboard") ||
    normalized.startsWith("copy to clipboard")
  );
}

export function isFinanceGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.startsWith("how much did i spend") ||
    normalized.includes("expense summary") ||
    normalized.includes("spending report")
  );
}

export function isDesktopGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.startsWith("open ") ||
    normalized.startsWith("launch ") ||
    normalized.startsWith("focus ")
  );
}

export function isAutomationGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return normalized.startsWith("run workflow ") || normalized.startsWith("start workflow ");
}

export function isSupervisorGatewayCommand(command: string) {
  return command.toLowerCase().includes(" then ");
}

export function isMcpGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.startsWith("mcp ") ||
    isGithubMcpGatewayCommand(command) ||
    isJiraMcpGatewayCommand(command) ||
    isHuggingFaceMcpGatewayCommand(command) ||
    isZapierMcpGatewayCommand(command)
  );
}

export function isJiraMcpGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return normalized.includes("jira issues") || normalized.includes("jira issue") || normalized.includes("my jira tickets") || normalized.includes("search jira");
}

export function isHuggingFaceMcpGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return normalized.includes("huggingface") || normalized.includes("hf models");
}

export function isZapierMcpGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return normalized.includes("zapier") || normalized.includes("my zaps");
}

export function isGithubMcpGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.includes("github issues") ||
    normalized.includes("github issue") ||
    normalized.includes("list github issues") ||
    normalized.includes("github pr") ||
    normalized.includes("github pull") ||
    normalized.includes("open prs") ||
    normalized.includes("my github repos") ||
    normalized.includes("search github repos")
  );
}

export function isVaultGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.startsWith("search vault") ||
    normalized.startsWith("search my vault") ||
    normalized.startsWith("search obsidian") ||
    normalized.startsWith("backlinks for") ||
    normalized.startsWith("show backlinks") ||
    normalized.startsWith("what links to") ||
    normalized.startsWith("find in vault")
  );
}

export function isResearchGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.startsWith("research ") ||
    normalized.startsWith("look up ") ||
    normalized.startsWith("investigate ")
  );
}

export function isPdfGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.startsWith("list pdfs") ||
    normalized.startsWith("show pdfs") ||
    normalized.startsWith("search pdfs") ||
    normalized.startsWith("find pdf") ||
    normalized.startsWith("open pdf") ||
    normalized.startsWith("read pdf") ||
    normalized.startsWith("show pdf") ||
    normalized.startsWith("summarize pdf") ||
    normalized === "summarize this pdf"
  );
}

export function isGoogleSearchGatewayCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.startsWith("search google for ") ||
    normalized.startsWith("google search for ") ||
    normalized.startsWith("google for ") ||
    normalized.startsWith("search web for ") ||
    normalized.startsWith("search the web for ")
  );
}

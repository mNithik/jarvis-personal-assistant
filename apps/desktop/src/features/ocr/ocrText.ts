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

import type {
  JarvisHomeAppId,
  JarvisPanelId,
  OcrCorrectionRecord,
  OcrHistoryFilter,
  OcrHistoryRecord,
  OcrRect,
  OcrRegion,
  OcrScope,
  OcrWatchAction,
  OcrWatchRule,
  ShellBarPlacement,
} from "../command/jarvisCommandTypes";

export function cleanupClipboardText(text: string, mode: "clean" | "summarize" | "format") {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (mode === "summarize") {
    const sentences = cleaned
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    return sentences.slice(0, 3).join(" ");
  }

  if (mode === "format") {
    return cleaned
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
      .join("\n");
  }

  return cleaned;
}

export function cleanupOcrText(text: string) {
  const seen = new Set<string>();
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[|_~`^©®•]{2,}/g, " ").replace(/\s+/g, " ").trim())
    .filter((line) => {
      if (line.length < 3) {
        return false;
      }
      const lettersAndNumbers = line.replace(/[^a-z0-9]/gi, "").length;
      if (lettersAndNumbers / Math.max(line.length, 1) < 0.35) {
        return false;
      }
      const normalized = line.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    })
    .join("\n")
    .trim();
}

export function applyOcrCorrections(text: string, corrections: OcrCorrectionRecord[]) {
  return corrections.reduce((current, correction) => {
    if (!correction.from.trim()) {
      return current;
    }
    return current.split(correction.from).join(correction.to);
  }, text);
}

export function summarizeOcrText(text: string) {
  const cleaned = cleanupOcrText(text);
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return "";
  }
  const taskLike = lines.filter((line) => /(^[-*□☐\d.)]+\s+|\b(todo|task|deadline|due|finish|submit|call|email|review|fix|add|make|create)\b)/i.test(line));
  const chosen = taskLike.length >= 2 ? taskLike : lines;
  return chosen.slice(0, 8).join("\n");
}

export function buildOcrSummary(text: string, mode: "brief" | "error" | "study_notes" | "flashcards") {
  const cleaned = cleanupOcrText(text);
  const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);
  if (mode === "error") {
    const errorLines = lines.filter((line) => /\b(error|failed|exception|warning|denied|blocked|cannot|could not)\b/i.test(line));
    return (errorLines.length > 0 ? errorLines : lines.slice(0, 5)).map((line) => `- ${line}`).join("\n");
  }
  if (mode === "study_notes") {
    return lines.slice(0, 10).map((line) => `- ${line}`).join("\n");
  }
  if (mode === "flashcards") {
    return lines.slice(0, 8).map((line, index) => `Q${index + 1}: What should I remember about "${line.slice(0, 80)}"?\nA${index + 1}: ${line}`).join("\n\n");
  }
  return summarizeOcrText(cleaned) || lines.slice(0, 5).join("\n");
}

export function formatOcrResultDetail(rawText: string) {
  const cleaned = cleanupOcrText(rawText);
  const summary = summarizeOcrText(rawText);
  if (!cleaned) {
    return "";
  }
  if (summary && summary !== cleaned) {
    return `Useful summary:\n${summary}\n\nCleaned OCR:\n${cleaned.slice(0, 3500)}`;
  }
  return cleaned.slice(0, 4000);
}

export function extractOcrTaskTitles(text: string) {
  const cleaned = cleanupOcrText(text);
  const lines = cleaned
    .split("\n")
    .map((line) =>
      line
        .replace(/^[-*□☐✅\d.)\s]+/, "")
        .replace(/\b(todo|task|deadline|due)\s*[:\-]\s*/i, "")
        .trim(),
    )
    .filter((line) => line.length >= 5 && line.length <= 160);

  const taskLike = lines.filter((line) =>
    /\b(finish|submit|review|read|study|email|call|text|fix|add|make|create|schedule|prepare|pay|buy|send|complete|deadline|due)\b/i.test(line),
  );
  const candidates = taskLike.length > 0 ? taskLike : lines;
  const seen = new Set<string>();
  return candidates
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

export function normalizeOcrRegion(value: string): OcrRegion | null {
  const normalized = value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  if (normalized === "selected" || normalized === "selection") {
    return "selected";
  }
  if (normalized === "center" || normalized === "middle") {
    return "center";
  }
  if (normalized === "top" || normalized === "top half") {
    return "top";
  }
  if (normalized === "bottom" || normalized === "bottom half") {
    return "bottom";
  }
  if (normalized === "left" || normalized === "left half") {
    return "left";
  }
  if (normalized === "right" || normalized === "right half") {
    return "right";
  }
  if (["top left", "top right", "bottom left", "bottom right"].includes(normalized)) {
    return normalized as OcrRegion;
  }
  return null;
}

export function normalizeJarvisPanelName(value: string): JarvisPanelId | null {
  const normalized = value.trim().toLowerCase().replace(/\b(panel|module|app|window)\b/g, "").replace(/\s+/g, " ").trim();
  if (["ocr", "vision", "screen", "screen reader"].includes(normalized)) return "ocr";
  if (["voice", "voice core", "speech"].includes(normalized)) return "voice";
  if (["workspace", "workspaces", "desktop"].includes(normalized)) return "workspaces";
  if (["memory", "memories"].includes(normalized)) return "memory";
  if (["integrations", "integration", "connections"].includes(normalized)) return "integrations";
  if (["automation", "automations", "rules"].includes(normalized)) return "automation";
  if (["builder", "coding", "developer", "dev"].includes(normalized)) return "builder";
  return null;
}

export function normalizeJarvisHomeAppName(value: string): JarvisHomeAppId | null {
  const normalized = value.trim().toLowerCase().replace(/\b(app|section|page|workspace)\b/g, "").replace(/\s+/g, " ").trim();
  if (["command", "commands", "home", "command center"].includes(normalized)) return "command";
  if (["vision", "ocr", "screen", "screen reader"].includes(normalized)) return "vision";
  if (["memory", "memories", "people", "life"].includes(normalized)) return "memory";
  if (["automation", "automations", "workflow", "workflows", "rules"].includes(normalized)) return "automation";
  if (["workspace", "workspaces", "desktop"].includes(normalized)) return "workspaces";
  if (["connections", "connection", "integrations", "integration", "google", "notion", "spotify"].includes(normalized)) return "connections";
  if (["builder", "coding", "developer", "dev"].includes(normalized)) return "builder";
  return null;
}

export function isJarvisHomeAppId(value: unknown): value is JarvisHomeAppId {
  return (
    value === "command" ||
    value === "vision" ||
    value === "memory" ||
    value === "automation" ||
    value === "workspaces" ||
    value === "connections" ||
    value === "builder"
  );
}

export function isShellBarPlacement(value: unknown): value is ShellBarPlacement {
  return value === "bottom" || value === "top" || value === "free";
}

export function describeOcrTarget(scope: OcrScope = "screen", appName?: string, region?: OcrRegion, rect?: OcrRect) {
  if (scope === "active_window") {
    return "active window";
  }
  if (scope === "app_window" && appName) {
    return appName;
  }
  if (scope === "region" && region) {
    return region === "selected" ? "selected area" : `${region} area`;
  }
  if (scope === "rect" && rect) {
    return `selected rectangle ${Math.round(rect.width)}x${Math.round(rect.height)}`;
  }
  if (scope === "global_selection") {
    return "global selected area";
  }
  return "screen";
}

export function describeOcrWatchRule(rule?: OcrWatchRule) {
  if (!rule || rule.type === "any_change") {
    return "any readable text change";
  }
  if (rule.type === "keyword") {
    return `keyword "${rule.keyword ?? ""}"`;
  }
  if (rule.type === "error") {
    return "error-like text";
  }
  if (rule.type === "price_below") {
    return `price below ${rule.amount ?? ""}`;
  }
  if (rule.type === "price_above") {
    return `price above ${rule.amount ?? ""}`;
  }
  return "price-like text";
}

export function describeOcrWatchAction(action?: OcrWatchAction) {
  if (!action) {
    return "no automation action";
  }
  if (action.type === "open_app") {
    return `open ${action.appName}`;
  }
  if (action.type === "open_workspace") {
    return `open ${action.query} workspace`;
  }
  return "copy matched text";
}

export function extractOcrPrices(text: string) {
  return [...text.matchAll(/(?:[$₹€£]\s?(\d+(?:[.,]\d{1,2})?)|\b(\d+(?:[.,]\d{1,2})?)\s?(?:usd|inr|cad|eur|gbp)\b)/gi)]
    .map((match) => Number((match[1] ?? match[2] ?? "").replace(",", ".")))
    .filter((value) => Number.isFinite(value));
}

export function getOcrMatchKey(rule: OcrWatchRule | undefined, text: string) {
  const normalized = cleanupOcrText(text).toLowerCase();
  if (!rule || rule.type === "any_change") {
    return normalized.slice(0, 240);
  }
  if (rule.type === "keyword") {
    return `keyword:${rule.keyword?.toLowerCase() ?? ""}:${normalized.slice(0, 160)}`;
  }
  if (rule.type === "error") {
    const match = normalized.match(/\b(error|failed|failure|exception|crash|denied|blocked|warning|not responding|cannot|could not).{0,120}/i);
    return `error:${match?.[0] ?? normalized.slice(0, 160)}`;
  }
  const prices = extractOcrPrices(text).sort((left, right) => left - right);
  return `${rule.type}:${rule.amount ?? ""}:${prices.join(",")}`;
}

export function ocrWatchRuleMatches(rule: OcrWatchRule | undefined, previousText: string | undefined, nextText: string) {
  if (!nextText || previousText === nextText) {
    return false;
  }
  if (!rule || rule.type === "any_change") {
    return true;
  }
  if (rule.type === "keyword") {
    const keyword = rule.keyword?.trim().toLowerCase();
    return Boolean(keyword && nextText.toLowerCase().includes(keyword));
  }
  if (rule.type === "error") {
    return /\b(error|failed|failure|exception|crash|denied|blocked|warning|not responding|cannot|could not)\b/i.test(nextText);
  }
  const prices = extractOcrPrices(nextText);
  if (rule.type === "price_below") {
    return prices.some((price) => price < (rule.amount ?? 0));
  }
  if (rule.type === "price_above") {
    return prices.some((price) => price > (rule.amount ?? Number.POSITIVE_INFINITY));
  }
  if (rule.type === "price") {
    return prices.length > 0;
  }
  return /(?:[$₹€£]\s?\d+(?:[.,]\d{2})?|\b\d+(?:[.,]\d{2})?\s?(?:usd|inr|cad|eur|gbp)\b)/i.test(nextText);
}

export function getOcrSourceLabel(scope: OcrScope = "screen", appName?: string, region?: OcrRegion) {
  if (scope === "app_window" && appName) {
    return appName;
  }
  if (scope === "active_window") {
    return "active window";
  }
  if (scope === "region" && region) {
    return region;
  }
  if (scope === "global_selection") {
    return "global selection";
  }
  if (scope === "rect") {
    return "selected rectangle";
  }
  return "screen";
}

export function getOcrHistorySince(label: string) {
  const normalized = label.toLowerCase();
  const since = new Date();
  if (normalized.includes("last hour")) {
    since.setHours(since.getHours() - 1);
    return since;
  }
  if (normalized.includes("today")) {
    since.setHours(0, 0, 0, 0);
    return since;
  }
  if (normalized.includes("this week")) {
    since.setDate(since.getDate() - 7);
    return since;
  }
  return null;
}

export function filterOcrHistory(history: OcrHistoryRecord[], filter: OcrHistoryFilter) {
  const query = filter.query?.trim().toLowerCase();
  const source = filter.source?.trim().toLowerCase();
  return history.filter((entry) => {
    if (filter.since && new Date(entry.createdAt).getTime() < filter.since.getTime()) {
      return false;
    }
    if (source && !entry.target.toLowerCase().includes(source) && !entry.source?.toLowerCase().includes(source)) {
      return false;
    }
    if (!query) {
      return true;
    }
    return (
      entry.target.toLowerCase().includes(query) ||
      entry.summary.toLowerCase().includes(query) ||
      entry.text.toLowerCase().includes(query)
    );
  });
}

export function parseWatchIntervalMs(text?: string) {
  if (!text) {
    return 60_000;
  }
  const match = text.match(/(\d{1,3})\s*(seconds?|secs?|minutes?|mins?)/i);
  if (!match) {
    return 60_000;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const ms = /min/.test(unit) ? amount * 60_000 : amount * 1000;
  return Math.max(15_000, Math.min(ms, 30 * 60_000));
}

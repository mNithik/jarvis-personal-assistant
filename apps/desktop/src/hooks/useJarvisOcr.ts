import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import type { CommandIntent } from "../features/command/jarvisCommandTypes";
import type {
  OcrCorrectionRecord,
  OcrHistoryRecord,
  OcrRect,
  OcrRegion,
  OcrScope,
  OcrSelectionState,
  OcrWatchTarget,
  OcrWatchTemplate,
} from "../features/command/jarvisCommandTypes";
import {
  OCR_CORRECTIONS_STORAGE_KEY,
  OCR_HISTORY_STORAGE_KEY,
  OCR_WATCHES_STORAGE_KEY,
  OCR_WATCH_TEMPLATES_STORAGE_KEY,
  applyOcrCorrections,
  cleanupOcrText,
  createActiveScreenshotContext,
  describeOcrTarget,
  describeOcrWatchRule,
  formatOcrResultDetail,
  getErrorDetail,
  getOcrMatchKey,
  getOcrSourceLabel,
  ocrWatchRuleMatches,
  summarizeOcrText,
} from "../features/legacy/appHelpers";
import {
  captureActiveWindowScreenshot,
  captureDesktopAppWindowScreenshot,
  captureDesktopScreenshot,
  captureGlobalSelectionScreenshot,
  captureScreenRectScreenshot,
  captureScreenRegionScreenshot,
  createNotionNote,
  createNotionTask,
  extractImageOcrText,
  launchDesktopApp,
  listOcrWatches,
  recordAmbientSignal,
  saveOcrWatch,
  writeClipboardText,
} from "../services/jarvisApi";
import type { NoteRecord } from "../types/jarvis";
import type { ActiveConversationContext } from "../features/command/jarvisCommandTypes";
import { useOcrWatchScheduler } from "./useOcrWatchScheduler";

type CommandResult = { title: string; detail: string };

type UseJarvisOcrOptions = {
  appendConversationTurn: (role: "user" | "jarvis", text: string) => void;
  executeIntent: (intent: CommandIntent) => Promise<boolean | undefined>;
  gatewayEnabled?: boolean;
  setActiveConversationContext: (context: ActiveConversationContext | null) => void;
  setCommandResult: (result: CommandResult | null) => void;
  setRecentNotes: Dispatch<SetStateAction<NoteRecord[]>>;
  setStatusMessage: (message: string) => void;
  speakIfEnabled: (text: string) => void;
};

/** Wave 2 peel: OCR state, persistence, capture, watches, and selection from JarvisAppRoot.logic */
export function useJarvisOcr({
  appendConversationTurn,
  executeIntent,
  gatewayEnabled = false,
  setActiveConversationContext,
  setCommandResult,
  setRecentNotes,
  setStatusMessage,
  speakIfEnabled,
}: UseJarvisOcrOptions) {
  const [lastScreenshotPath, setLastScreenshotPath] = useState<string | null>(null);
  const [ocrWatchTargets, setOcrWatchTargets] = useState<OcrWatchTarget[]>([]);
  const [ocrHistory, setOcrHistory] = useState<OcrHistoryRecord[]>([]);
  const [ocrWatchMatches, setOcrWatchMatches] = useState<OcrHistoryRecord[]>([]);
  const [lastOcrText, setLastOcrText] = useState("");
  const [ocrCorrections, setOcrCorrections] = useState<OcrCorrectionRecord[]>([]);
  const [ocrWatchTemplates, setOcrWatchTemplates] = useState<OcrWatchTemplate[]>([]);
  const [isOcrSelecting, setIsOcrSelecting] = useState(false);
  const [ocrSelection, setOcrSelection] = useState<OcrSelectionState>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OCR_HISTORY_STORAGE_KEY);
      if (saved) {
        setOcrHistory(JSON.parse(saved) as OcrHistoryRecord[]);
      }
    } catch {
      setOcrHistory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(OCR_HISTORY_STORAGE_KEY, JSON.stringify(ocrHistory.slice(0, 20)));
    } catch {
      setStatusMessage("JARVIS could not persist OCR history locally.");
    }
  }, [ocrHistory, setStatusMessage]);

  useEffect(() => {
    if (gatewayEnabled) {
      void listOcrWatches()
        .then((watches) => {
          if (watches.length > 0) {
            setOcrWatchTargets(
              watches.map((watch) => ({
                id: watch.id,
                name: watch.name,
                scope: watch.scope as OcrScope,
                appName: watch.appName,
                region: watch.region as OcrRegion | undefined,
                rect: watch.rect as OcrWatchTarget["rect"],
                status: watch.status === "paused" ? "paused" : "active",
                intervalMs: watch.intervalMs,
                logToNotion: watch.logToNotion,
                createTaskOnMatch: watch.createTaskOnMatch,
                action: watch.action as OcrWatchTarget["action"],
                rule: watch.rule as OcrWatchTarget["rule"],
                lastText: watch.lastText,
                lastMatchKey: watch.lastMatchKey,
                lastCheckedAt: watch.lastCheckedAt,
              })),
            );
          }
        })
        .catch(() => {
          setStatusMessage("JARVIS could not load OCR watches from SQLite.");
        });
      return;
    }

    try {
      const saved = window.localStorage.getItem(OCR_WATCHES_STORAGE_KEY);
      if (saved) {
        setOcrWatchTargets(JSON.parse(saved) as OcrWatchTarget[]);
      }
    } catch {
      setOcrWatchTargets([]);
    }
  }, [gatewayEnabled, setStatusMessage]);

  useEffect(() => {
    try {
      window.localStorage.setItem(OCR_WATCHES_STORAGE_KEY, JSON.stringify(ocrWatchTargets));
    } catch {
      setStatusMessage("JARVIS could not persist OCR watches locally.");
    }
    if (!gatewayEnabled) {
      return;
    }
    void Promise.all(
      ocrWatchTargets.map((watch) =>
        saveOcrWatch({
          id: watch.id,
          name: watch.name,
          scope: watch.scope,
          appName: watch.appName,
          region: watch.region,
          rect: watch.rect,
          status: watch.status,
          intervalMs: watch.intervalMs,
          logToNotion: watch.logToNotion,
          createTaskOnMatch: watch.createTaskOnMatch,
          action: watch.action,
          rule: watch.rule,
          lastText: watch.lastText,
          lastMatchKey: watch.lastMatchKey,
          lastCheckedAt: watch.lastCheckedAt,
        }),
      ),
    ).catch(() => {
      setStatusMessage("JARVIS could not persist OCR watches to SQLite.");
    });
  }, [gatewayEnabled, ocrWatchTargets, setStatusMessage]);

  useEffect(() => {
    try {
      const savedCorrections = window.localStorage.getItem(OCR_CORRECTIONS_STORAGE_KEY);
      const savedTemplates = window.localStorage.getItem(OCR_WATCH_TEMPLATES_STORAGE_KEY);
      if (savedCorrections) {
        setOcrCorrections(JSON.parse(savedCorrections) as OcrCorrectionRecord[]);
      }
      if (savedTemplates) {
        setOcrWatchTemplates(JSON.parse(savedTemplates) as OcrWatchTemplate[]);
      }
    } catch {
      setOcrCorrections([]);
      setOcrWatchTemplates([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(OCR_CORRECTIONS_STORAGE_KEY, JSON.stringify(ocrCorrections.slice(0, 50)));
    } catch {
      setStatusMessage("JARVIS could not persist OCR corrections locally.");
    }
  }, [ocrCorrections, setStatusMessage]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        OCR_WATCH_TEMPLATES_STORAGE_KEY,
        JSON.stringify(ocrWatchTemplates.slice(0, 20)),
      );
    } catch {
      setStatusMessage("JARVIS could not persist OCR watch templates locally.");
    }
  }, [ocrWatchTemplates, setStatusMessage]);

  const captureOcrSnapshot = useCallback(
    async (target: {
      scope?: OcrScope;
      appName?: string;
      region?: OcrRegion;
      rect?: OcrRect;
      useLast?: boolean;
    }) => {
      if (target.useLast && !lastScreenshotPath) {
        throw new Error("There is no last screenshot yet. Ask JARVIS to take a screenshot first.");
      }

      const screenshotPath = target.useLast
        ? lastScreenshotPath!
        : target.scope === "active_window"
          ? await captureActiveWindowScreenshot()
          : target.scope === "app_window" && target.appName
            ? await captureDesktopAppWindowScreenshot(target.appName)
            : target.scope === "region" && target.region
              ? await captureScreenRegionScreenshot(target.region)
              : target.scope === "rect" && target.rect
                ? await captureScreenRectScreenshot(
                    Math.round(target.rect.x),
                    Math.round(target.rect.y),
                    Math.round(target.rect.width),
                    Math.round(target.rect.height),
                  )
                : target.scope === "global_selection"
                  ? await captureGlobalSelectionScreenshot()
                  : await captureDesktopScreenshot();
      setLastScreenshotPath(screenshotPath);
      setActiveConversationContext(createActiveScreenshotContext(screenshotPath));
      const ocrText = applyOcrCorrections(
        (await extractImageOcrText(screenshotPath)).trim(),
        ocrCorrections,
      );
      return { screenshotPath, ocrText };
    },
    [lastScreenshotPath, ocrCorrections, setActiveConversationContext],
  );

  const rememberOcrHistory = useCallback(
    (
      target: string,
      text: string,
      screenshotPath: string,
      options?: { source?: string; matchType?: string; watchMatch?: boolean },
    ) => {
      const cleaned = cleanupOcrText(text);
      if (!cleaned) {
        return null;
      }
      const record: OcrHistoryRecord = {
        id: `ocr-${Date.now()}`,
        target,
        text: cleaned.slice(0, 5000),
        summary: (summarizeOcrText(cleaned) || cleaned).slice(0, 1000),
        screenshotPath,
        createdAt: new Date().toISOString(),
        source: options?.source,
        matchType: options?.matchType,
      };
      setLastOcrText(record.text);
      setOcrHistory((current) => [record, ...current].slice(0, 20));
      if (options?.watchMatch) {
        setOcrWatchMatches((current) => [record, ...current].slice(0, 10));
      }
      return record;
    },
    [],
  );

  const runOcrWatchCheck = useCallback(
    async (watch: OcrWatchTarget) => {
      try {
        const snapshot = await captureOcrSnapshot(watch);
        const cleaned = cleanupOcrText(snapshot.ocrText);
        if (!cleaned) {
          return;
        }
        setOcrWatchTargets((currentTargets) =>
          currentTargets.map((current) => {
            if (current.id !== watch.id) {
              return current;
            }
            if (!ocrWatchRuleMatches(current.rule, current.lastText, cleaned)) {
              return { ...current, lastCheckedAt: new Date().toISOString() };
            }
            const matchKey = getOcrMatchKey(current.rule, cleaned);
            if (current.lastMatchKey === matchKey) {
              return { ...current, lastText: cleaned, lastCheckedAt: new Date().toISOString() };
            }
            const targetLabel = describeOcrTarget(
              current.scope,
              current.appName,
              current.region,
              current.rect,
            );
            const summary = summarizeOcrText(cleaned) || cleaned.slice(0, 800);
            void recordAmbientSignal(
              `OCR watch match on ${targetLabel}: ${summary.slice(0, 160)}`,
            ).catch(() => undefined);
            setCommandResult({
              title: "Screen watch changed",
              detail: `Detected ${describeOcrWatchRule(current.rule)} on ${targetLabel}.\n\n${formatOcrResultDetail(cleaned)}`,
            });
            setStatusMessage(`OCR watch noticed a change on ${targetLabel}.`);
            appendConversationTurn("jarvis", `I noticed the watched ${targetLabel} changed.`);
            speakIfEnabled(`I noticed the watched ${targetLabel} changed.`);
            const source = getOcrSourceLabel(current.scope, current.appName, current.region);
            rememberOcrHistory(targetLabel, cleaned, snapshot.screenshotPath, {
              source,
              matchType: describeOcrWatchRule(current.rule),
              watchMatch: true,
            });
            if (current.logToNotion) {
              void createNotionNote(
                `OCR Watch Change\n\nTarget: ${targetLabel}\nDetected: ${new Date().toLocaleString()}\nScreenshot: ${snapshot.screenshotPath}\n\nSummary\n${summary}\n\nCleaned OCR\n${cleaned}`,
              )
                .then((note) => setRecentNotes((notes) => [note, ...notes].slice(0, 5)))
                .catch(() => setStatusMessage("OCR watch changed, but Notion logging failed."));
            }
            if (current.createTaskOnMatch) {
              void createNotionTask(`Review OCR match on ${targetLabel}: ${summary.slice(0, 120)}`, null, null)
                .then((task) => setRecentNotes((notes) => [task, ...notes].slice(0, 5)))
                .catch(() => setStatusMessage("OCR watch matched, but task creation failed."));
            }
            if (current.action?.type === "open_app") {
              void launchDesktopApp(current.action.appName).catch(() =>
                setStatusMessage("OCR watch matched, but app launch failed."),
              );
            } else if (current.action?.type === "open_workspace") {
              void executeIntent({ kind: "open_desktop_project", query: current.action.query }).catch(() =>
                setStatusMessage("OCR watch matched, but workspace launch failed."),
              );
            } else if (current.action?.type === "copy_text") {
              void writeClipboardText(cleaned).catch(() =>
                setStatusMessage("OCR watch matched, but clipboard copy failed."),
              );
            }
            return {
              ...current,
              lastText: cleaned,
              lastMatchKey: matchKey,
              lastCheckedAt: new Date().toISOString(),
            };
          }),
        );
      } catch (error) {
        setStatusMessage(getErrorDetail(error, "OCR watch could not read the watched target."));
      }
    },
    [
      appendConversationTurn,
      captureOcrSnapshot,
      executeIntent,
      rememberOcrHistory,
      setCommandResult,
      setRecentNotes,
      setStatusMessage,
      speakIfEnabled,
    ],
  );

  useOcrWatchScheduler(ocrWatchTargets, runOcrWatchCheck);

  const beginOcrSelection = useCallback(() => {
    setIsOcrSelecting(true);
    setOcrSelection(null);
    setCommandResult({
      title: "Select OCR area",
      detail: "Drag a box over the area you want JARVIS to read. Press Escape or Cancel to stop.",
    });
    setStatusMessage("OCR selection mode active.");
  }, [setCommandResult, setStatusMessage]);

  const completeOcrSelection = useCallback(
    async (rect: OcrRect) => {
      setIsOcrSelecting(false);
      setOcrSelection(null);
      await executeIntent({ kind: "read_screen_text", scope: "rect", rect });
    },
    [executeIntent],
  );

  const selectionRect = useMemo(
    () =>
      ocrSelection
        ? {
            left: Math.min(ocrSelection.viewStartX, ocrSelection.viewCurrentX),
            top: Math.min(ocrSelection.viewStartY, ocrSelection.viewCurrentY),
            width: Math.abs(ocrSelection.viewCurrentX - ocrSelection.viewStartX),
            height: Math.abs(ocrSelection.viewCurrentY - ocrSelection.viewStartY),
          }
        : null,
    [ocrSelection],
  );

  const activeOcrWatches = useMemo(
    () => ocrWatchTargets.filter((watch) => watch.status === "active"),
    [ocrWatchTargets],
  );

  const primaryOcrWatch = ocrWatchTargets[0] ?? null;

  return {
    activeOcrWatches,
    beginOcrSelection,
    captureOcrSnapshot,
    completeOcrSelection,
    isOcrSelecting,
    lastOcrText,
    lastScreenshotPath,
    ocrCorrections,
    ocrHistory,
    ocrSelection,
    ocrWatchMatches,
    ocrWatchTargets,
    ocrWatchTemplates,
    primaryOcrWatch,
    rememberOcrHistory,
    runOcrWatchCheck,
    selectionRect,
    setIsOcrSelecting,
    setLastOcrText,
    setLastScreenshotPath,
    setOcrCorrections,
    setOcrHistory,
    setOcrSelection,
    setOcrWatchMatches,
    setOcrWatchTargets,
    setOcrWatchTemplates,
  };
}

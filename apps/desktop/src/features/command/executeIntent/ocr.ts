import * as J from "../../legacy/appHelpers";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import { createNotionNote, writeClipboardText } from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";

/** Gateway-owned OCR intents stripped in Wave R2; unguarded selection/clipboard helpers remain. */
export async function handleOcrIntent(
  deps: ResolvedCommandRouterDeps,
  intent: import("../jarvisCommandTypes").CommandIntent,
  _executeIntent: ExecuteIntentFn,
): Promise<ExecuteIntentResult> {
  if (intent.kind === "begin_ocr_region_selection") {
    const { screenshotPath, ocrText } = await deps.captureOcrSnapshot({ scope: "global_selection" });
    const detail = J.formatOcrResultDetail(ocrText);
    deps.rememberOcrHistory("global selected area", ocrText, screenshotPath);
    deps.setCommandResult({
      title: detail ? "Global selected area read" : "No selected-area text found",
      detail: detail || `OCR ran on ${screenshotPath}, but no readable text was found.`,
    });
    deps.setStatusMessage("Global OCR selection completed.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn(
      "jarvis",
      detail ? "I read the selected desktop area." : "I tried reading the selected area, but did not find readable text.",
    );
    deps.speakIfEnabled(
      detail ? "I read the selected desktop area." : "I tried reading the selected area, but did not find readable text.",
    );
    return { status: "handled" };
  }

  if (intent.kind === "begin_app_ocr_region_selection") {
    deps.beginOcrSelection();
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", "Drag a box over the area you want me to read.");
    deps.speakIfEnabled("Drag a box over the area you want me to read.");
    return { status: "handled" };
  }

  if (intent.kind === "clear_ocr_history") {
    deps.setOcrHistory([]);
    deps.setOcrWatchMatches([]);
    deps.setLastOcrText("");
    deps.setCommandResult({
      title: "OCR history cleared",
      detail: "Cleared local OCR history and watch match previews.",
    });
    deps.setStatusMessage("OCR history cleared.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", "I cleared OCR history.");
    deps.speakIfEnabled("I cleared OCR history.");
    return { status: "handled" };
  }

  if (intent.kind === "copy_latest_ocr_text") {
    const text = deps.lastOcrText || deps.ocrHistory[0]?.text || "";
    if (!text) {
      throw new Error("There is no OCR text to copy yet.");
    }
    await writeClipboardText(text);
    deps.setCommandResult({
      title: "Latest OCR copied",
      detail: "Copied the latest OCR text to your clipboard.",
    });
    deps.setStatusMessage("Latest OCR text copied.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", "I copied the latest OCR text.");
    deps.speakIfEnabled("I copied the latest OCR text.");
    return { status: "handled" };
  }

  if (intent.kind === "correct_ocr_text") {
    deps.setOcrCorrections((current) =>
      [{ from: intent.from, to: intent.to, createdAt: new Date().toISOString() }, ...current].slice(0, 50),
    );
    deps.setCommandResult({
      title: "OCR correction saved",
      detail: `JARVIS will replace "${intent.from}" with "${intent.to}" in future OCR reads.`,
    });
    deps.setStatusMessage("OCR correction saved.");
    deps.setVoiceSessionPhase("ready");
    return { status: "handled" };
  }

  if (intent.kind === "remember_latest_ocr") {
    const text = deps.lastOcrText || deps.ocrHistory[0]?.text || "";
    if (!text) {
      throw new Error("There is no OCR text to remember yet.");
    }
    const note = await createNotionNote(`Screen Memory\n\nSaved: ${new Date().toLocaleString()}\n\n${text}`);
    deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
    deps.setCommandResult({ title: "Screen memory saved", detail: `Saved latest OCR as "${note.title}".` });
    deps.setStatusMessage("Latest OCR saved as memory.");
    deps.setVoiceSessionPhase("ready");
    return { status: "handled" };
  }

  return { status: "unhandled" };
}

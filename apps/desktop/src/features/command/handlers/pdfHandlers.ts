import * as J from "../../legacy/appHelpers";
import type { CommandRouterDeps } from "../commandRouterDepTypes";
import type { CommandIntent } from "../jarvisCommandTypes";
import type { FileRecord } from "../../../types/jarvis";
import {
  createNotionNote,
  createNotionTask,
  extractPdfText,
} from "../../../services/jarvisApi";

type ResolvedCommandRouterDeps = Required<CommandRouterDeps>;

export async function handlePdfIntent(
  deps: ResolvedCommandRouterDeps,
  intent: CommandIntent,
): Promise<boolean> {
  if (intent.kind === "save_pdf_summary_to_notion_by_index") {
        const file = J.getPdfByIndex(deps.recentFiles, intent.index);
        if (!file) {
          throw new Error(`PDF ${intent.index} is not loaded right now. Ask JARVIS to find PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = J.summarizePdfText(file.name, text);
        const note = await createNotionNote(summary);
        deps.setCommandResult({
          title: "PDF summary saved",
          detail: `Saved the summary for ${file.name} to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("PDF summary saved to Notion through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", `I saved the summary for ${file.name} to Notion.`);
        deps.speakIfEnabled(`I saved the summary for ${file.name} to Notion.`);
    return true;
  }
  if (intent.kind === "save_current_pdf_summary_to_notion") {
        const file = J.getCurrentPdf(deps.recentFiles);
        if (!file) {
          throw new Error("There is no loaded PDF yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = J.summarizePdfText(file.name, text);
        const note = await createNotionNote(summary);
        deps.setCommandResult({
          title: "PDF summary saved",
          detail: `Saved the summary for ${file.name} to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("Current PDF summary saved to Notion through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", `I saved the summary for ${file.name} to Notion.`);
        deps.speakIfEnabled(`I saved the summary for ${file.name} to Notion.`);
    return true;
  }
  if (intent.kind === "save_pdf_summary_to_notion_by_query") {
        const file = J.findPdfByQuery(deps.recentFiles, intent.query);
        if (!file) {
          throw new Error(`I could not find a loaded PDF about ${intent.query}. Ask JARVIS to search PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const summary = J.summarizePdfText(file.name, text);
        const note = await createNotionNote(summary);
        deps.setCommandResult({
          title: "PDF summary saved",
          detail: `Saved the summary for ${file.name} to Notion as "${note.title}".`,
        });
        deps.setStatusMessage(`PDF summary for ${intent.query} saved to Notion through JARVIS.`);
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.appendConversationTurn("jarvis", `I saved the summary for ${file.name} to Notion.`);
        deps.speakIfEnabled(`I saved the summary for ${file.name} to Notion.`);
    return true;
  }
  if (intent.kind === "create_tasks_from_pdf_by_index") {
        const file = J.getPdfByIndex(deps.recentFiles, intent.index);
        if (!file) {
          throw new Error(`PDF ${intent.index} is not loaded right now. Ask JARVIS to find PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const tasks = J.extractTasksFromPdfText(text);
        if (tasks.length === 0) {
          throw new Error(`JARVIS could not find clear action items in ${file.name} yet.`);
        }

        for (const task of tasks) {
          await createNotionTask(task.title, task.dueLabel, J.getDueIsoFromLabel(task.dueLabel));
        }

        const reply = J.buildPdfTasksReply(file.name, tasks.length);
        deps.setCommandResult({
          title: "PDF tasks created",
          detail: tasks
            .map((task) => (task.dueLabel ? `${task.title} (${task.dueLabel})` : task.title))
            .join(" | "),
        });
        deps.setStatusMessage("Tasks were created from the PDF through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "create_tasks_from_current_pdf") {
        const file = J.getCurrentPdf(deps.recentFiles);
        if (!file) {
          throw new Error("There is no loaded PDF yet. Ask JARVIS to find PDFs or search PDFs first.");
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const tasks = J.extractTasksFromPdfText(text);
        if (tasks.length === 0) {
          throw new Error(`JARVIS could not find clear action items in ${file.name} yet.`);
        }

        for (const task of tasks) {
          await createNotionTask(task.title, task.dueLabel, J.getDueIsoFromLabel(task.dueLabel));
        }

        const reply = J.buildPdfTasksReply(file.name, tasks.length);
        deps.setCommandResult({
          title: "PDF tasks created",
          detail: tasks
            .map((task) => (task.dueLabel ? `${task.title} (${task.dueLabel})` : task.title))
            .join(" | "),
        });
        deps.setStatusMessage("Tasks were created from the current PDF through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "create_tasks_from_pdf_by_query") {
        const file = J.findPdfByQuery(deps.recentFiles, intent.query);
        if (!file) {
          throw new Error(`I could not find a loaded PDF about ${intent.query}. Ask JARVIS to search PDFs first.`);
        }

        deps.setActiveConversationContext(J.createActivePdfContext(file));
        const text = await extractPdfText(file.path);
        const tasks = J.extractTasksFromPdfText(text);
        if (tasks.length === 0) {
          throw new Error(`JARVIS could not find clear action items in ${file.name} yet.`);
        }

        for (const task of tasks) {
          await createNotionTask(task.title, task.dueLabel, J.getDueIsoFromLabel(task.dueLabel));
        }

        const reply = J.buildPdfTasksReply(file.name, tasks.length);
        deps.setCommandResult({
          title: "PDF tasks created",
          detail: tasks
            .map((task) => (task.dueLabel ? `${task.title} (${task.dueLabel})` : task.title))
            .join(" | "),
        });
        deps.setStatusMessage(`Tasks were created from the PDF about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  return false;
}
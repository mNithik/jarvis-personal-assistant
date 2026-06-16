import * as J from "../../legacy/appHelpers";
import type { PlannerTaskRecord } from "../jarvisCommandTypes";
import type { NoteRecord } from "../../../types/jarvis";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import { createNotionTask, openBrowserUrl, updateNotionTask } from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";

/** Gateway-owned note CRUD/list intents stripped in Wave R2; task workflows remain. */
export async function handleNotionIntent(
  deps: ResolvedCommandRouterDeps,
  intent: import("../jarvisCommandTypes").CommandIntent,
  executeIntent: ExecuteIntentFn,
): Promise<ExecuteIntentResult> {
  if (intent.kind === "read_current_note") {
        const note = J.resolveActiveNote(deps.activeConversationContext, deps.recentNotes);
        if (!note) {
          throw new Error("There is no active note in the conversation yet. Show, search, or save a note first.");
        }

        deps.setActiveConversationContext(J.createActiveNoteContext(note));
        const reply = J.buildReadNoteReply(note.title);
        deps.setCommandResult({
          title: `Note: ${note.title}`,
          detail: note.summary
            ? `${note.summary}\n\nOpen in Notion: ${note.url}`
            : `No summary is available for ${note.title} yet.\n\nOpen in Notion: ${note.url}`,
        });
        deps.setStatusMessage("Active Notion note loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "read_note_by_index") {
        const note = J.getNoteByIndex(deps.recentNotes, intent.index);
        if (!note) {
          throw new Error(`Note ${intent.index} is not loaded right now. Show or search your notes first.`);
        }

        deps.setActiveConversationContext(J.createActiveNoteContext(note));
        const reply = J.buildReadNoteReply(note.title);
        deps.setCommandResult({
          title: `Note ${intent.index}`,
          detail: note.summary
            ? `${note.summary}\n\nOpen in Notion: ${note.url}`
            : `No summary is available for ${note.title} yet.\n\nOpen in Notion: ${note.url}`,
        });
        deps.setStatusMessage(`Loaded note ${intent.index} through JARVIS.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "open_current_note") {
        const note = J.resolveActiveNote(deps.activeConversationContext, deps.recentNotes);
        if (!note) {
          throw new Error("There is no active note in the conversation yet. Show, search, or save a note first.");
        }

        deps.setActiveConversationContext(J.createActiveNoteContext(note));
        await openBrowserUrl(note.url);
        const reply = J.buildOpenNoteReply(note.title);
        deps.setCommandResult({
          title: "Notion note opened",
          detail: `Opened ${note.title} in Notion.`,
        });
        deps.setStatusMessage("Active Notion note opened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "open_note_by_index") {
        const note = J.getNoteByIndex(deps.recentNotes, intent.index);
        if (!note) {
          throw new Error(`Note ${intent.index} is not loaded right now. Show or search your notes first.`);
        }

        deps.setActiveConversationContext(J.createActiveNoteContext(note));
        await openBrowserUrl(note.url);
        const reply = J.buildOpenNoteReply(note.title);
        deps.setCommandResult({
          title: "Notion note opened",
          detail: `Opened note ${intent.index} (${note.title}) in Notion.`,
        });
        deps.setStatusMessage(`Opened note ${intent.index} through JARVIS.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "list_today_tasks") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status === "today");
        const detail = J.formatPlannerTaskList(filtered, "No task notes due today were found.");
        const reply = J.buildTodayTasksReply(filtered.length);
        deps.setCommandResult({
          title: "Today's task notes",
          detail,
        });
        deps.setStatusMessage("Today's task notes loaded from Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setPlannerTasks(filtered);
        deps.setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "list_upcoming_tasks") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status === "upcoming");
        const detail = J.formatPlannerTaskList(filtered, "No upcoming task notes were found.");
        const reply = J.buildUpcomingTasksReply(filtered.length);
        deps.setCommandResult({
          title: "Upcoming task notes",
          detail,
        });
        deps.setStatusMessage("Upcoming task notes loaded from Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setPlannerTasks(filtered);
        deps.setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "list_overdue_tasks") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status === "overdue");
        const detail = J.formatPlannerTaskList(filtered, "No overdue task notes were found.");
        const reply = J.buildOverdueTasksReply(filtered.length);
        deps.setCommandResult({
          title: "Overdue task notes",
          detail,
        });
        deps.setStatusMessage("Overdue task notes loaded from Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setPlannerTasks(filtered);
        deps.setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "list_done_tasks") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status === "done");
        deps.setCommandResult({
          title: "Done task notes",
          detail: J.formatPlannerTaskList(filtered, "No completed task notes were found."),
        });
        deps.setStatusMessage("Completed task notes loaded from Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setPlannerTasks(filtered);
        deps.setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        deps.appendConversationTurn("jarvis", `I found ${filtered.length} completed task${filtered.length === 1 ? "" : "s"}.`);
        deps.speakIfEnabled(`I found ${filtered.length} completed task${filtered.length === 1 ? "" : "s"}.`);
    return { status: "handled" };
  } else if (intent.kind === "list_open_tasks") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) => task.status !== "done");
        deps.setCommandResult({
          title: "Open task notes",
          detail: J.formatPlannerTaskList(filtered, "No open task notes were found."),
        });
        deps.setStatusMessage("Open task notes loaded from Notion.");
        deps.setVoiceSessionPhase("ready");
        deps.setPlannerTasks(filtered);
        deps.setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        deps.appendConversationTurn("jarvis", `I found ${filtered.length} open task${filtered.length === 1 ? "" : "s"}.`);
        deps.speakIfEnabled(`I found ${filtered.length} open task${filtered.length === 1 ? "" : "s"}.`);
    return { status: "handled" };
  } else if (intent.kind === "filter_tasks_by_query") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const filtered = parsedTasks.filter((task) =>
          `${task.title} ${task.dueLabel ?? ""} ${task.sourceNote.summary}`.toLowerCase().includes(intent.query.toLowerCase()),
        );
        const reply = `I found ${filtered.length} task${filtered.length === 1 ? "" : "s"} matching ${intent.query}.`;
        deps.setCommandResult({
          title: `Tasks about ${intent.query}`,
          detail: J.formatPlannerTaskList(filtered, `No task notes matched ${intent.query}.`),
        });
        deps.setStatusMessage(`Task notes filtered for ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.setPlannerTasks(filtered);
        deps.setPresentedCollectionContext({
          kind: "tasks",
          noteIds: filtered.map((task) => task.id),
        });
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "complete_task_by_index") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.getPlannerTaskByIndex(availableTasks, intent.index);
        if (!task) {
          throw new Error(
            `Task ${intent.index} is not loaded right now. Show your task notes first.`,
          );
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          J.getDueIsoFromLabel(task.dueLabel),
          "done",
        );
        const reply = J.buildCompleteTaskReply(task.title);
        deps.setCommandResult({
          title: "Task completed",
          detail: `Marked task ${intent.index} (${task.title}) as done in Notion.`,
        });
        deps.setStatusMessage("Task note marked done through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            status: "done",
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "complete_task_by_query") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.findPlannerTaskByQuery(availableTasks, intent.query);
        if (!task) {
          throw new Error(`I could not find a loaded task about ${intent.query}.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          J.getDueIsoFromLabel(task.dueLabel),
          "done",
        );
        const reply = J.buildCompleteTaskReply(task.title);
        deps.setCommandResult({
          title: "Task completed",
          detail: `Marked ${task.title} as done in Notion.`,
        });
        deps.setStatusMessage("Task note marked done through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            status: "done",
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "update_task_by_index") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.getPlannerTaskByIndex(availableTasks, intent.index);
        if (!task) {
          throw new Error(
            `Task ${intent.index} is not loaded right now. Show your task notes first.`,
          );
        }

        const updatedNote = await updateNotionTask(
          task.id,
          intent.title,
          intent.dueLabel,
          J.getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = J.buildUpdateTaskReply(intent.title);
        deps.setCommandResult({
          title: "Task updated",
          detail: intent.dueLabel
            ? `Updated task ${intent.index} to ${intent.title} due ${intent.dueLabel}.`
            : `Updated task ${intent.index} to ${intent.title}.`,
        });
        deps.setStatusMessage("Task note updated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            id: updatedNote.id,
            title: intent.title,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "update_task_by_query") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.findPlannerTaskByQuery(availableTasks, intent.query);
        if (!task) {
          throw new Error(`I could not find a loaded task about ${intent.query}.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          intent.title,
          intent.dueLabel,
          J.getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = J.buildUpdateTaskReply(intent.title);
        deps.setCommandResult({
          title: "Task updated",
          detail: intent.dueLabel
            ? `Updated ${task.title} to ${intent.title} due ${intent.dueLabel}.`
            : `Updated ${task.title} to ${intent.title}.`,
        });
        deps.setStatusMessage("Task note updated through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            id: updatedNote.id,
            title: intent.title,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "reopen_task_by_index") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.getPlannerTaskByIndex(availableTasks, intent.index);
        if (!task) {
          throw new Error(`Task ${intent.index} is not loaded right now. Show your task notes first.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          J.getDueIsoFromLabel(task.dueLabel),
          "open",
        );
        const reply = J.buildReopenTaskReply(task.title);
        deps.setCommandResult({
          title: "Task reopened",
          detail: `Reopened task ${intent.index} (${task.title}) in Notion.`,
        });
        deps.setStatusMessage("Task note reopened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "reopen_task_by_query") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.findPlannerTaskByQuery(availableTasks, intent.query);
        if (!task) {
          throw new Error(`I could not find a loaded task about ${intent.query}.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          J.getDueIsoFromLabel(task.dueLabel),
          "open",
        );
        const reply = J.buildReopenTaskReply(task.title);
        deps.setCommandResult({
          title: "Task reopened",
          detail: `Reopened ${task.title} in Notion.`,
        });
        deps.setStatusMessage("Task note reopened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "move_task_by_index") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.getPlannerTaskByIndex(availableTasks, intent.index);
        if (!task) {
          throw new Error(`Task ${intent.index} is not loaded right now. Show your task notes first.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          intent.dueLabel,
          J.getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = J.buildMoveTaskReply(task.title, intent.dueLabel);
        deps.setCommandResult({
          title: "Task moved",
          detail: `Moved task ${intent.index} (${task.title}) to ${intent.dueLabel}.`,
        });
        deps.setStatusMessage("Task note rescheduled through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "move_task_by_query") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.findPlannerTaskByQuery(availableTasks, intent.query);
        if (!task) {
          throw new Error(`I could not find a loaded task about ${intent.query}.`);
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          intent.dueLabel,
          J.getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = J.buildMoveTaskReply(task.title, intent.dueLabel);
        deps.setCommandResult({
          title: "Task moved",
          detail: `Moved ${task.title} to ${intent.dueLabel}.`,
        });
        deps.setStatusMessage("Task note rescheduled through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "complete_current_task") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.resolveActiveTask(deps.activeConversationContext, availableTasks);
        if (!task) {
          throw new Error("There is no active task in the conversation yet. Show or create a task first.");
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          J.getDueIsoFromLabel(task.dueLabel),
          "done",
        );
        const reply = J.buildCompleteTaskReply(task.title);
        deps.setCommandResult({
          title: "Task completed",
          detail: `Marked ${task.title} as done in Notion.`,
        });
        deps.setStatusMessage("Active task note marked done through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            status: "done",
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "reopen_current_task") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.resolveActiveTask(deps.activeConversationContext, availableTasks);
        if (!task) {
          throw new Error("There is no active task in the conversation yet. Show or create a task first.");
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          task.dueLabel,
          J.getDueIsoFromLabel(task.dueLabel),
          "open",
        );
        const reply = J.buildReopenTaskReply(task.title);
        deps.setCommandResult({
          title: "Task reopened",
          detail: `Reopened ${task.title} in Notion.`,
        });
        deps.setStatusMessage("Active task note reopened through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "move_current_task") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const task = J.resolveActiveTask(deps.activeConversationContext, availableTasks);
        if (!task) {
          throw new Error("There is no active task in the conversation yet. Show or create a task first.");
        }

        const updatedNote = await updateNotionTask(
          task.id,
          task.title,
          intent.dueLabel,
          J.getDueIsoFromLabel(intent.dueLabel),
          "open",
        );
        const reply = J.buildMoveTaskReply(task.title, intent.dueLabel);
        deps.setCommandResult({
          title: "Task moved",
          detail: `Moved ${task.title} to ${intent.dueLabel}.`,
        });
        deps.setStatusMessage("Active task note rescheduled through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...task,
            dueLabel: intent.dueLabel,
            sourceNote: updatedNote,
          }),
        );
        deps.setRecentNotes((current) =>
          [updatedNote, ...current.filter((note) => note.id !== updatedNote.id)].slice(0, 5),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "complete_all_overdue_tasks") {
        const parsedTasks = await deps.loadPlannerTaskRecords();
        const overdueTasks = parsedTasks.filter((task) => task.status === "overdue");
        const updatedNotes: NoteRecord[] = [];

        for (const task of overdueTasks) {
          const updatedNote = await updateNotionTask(
            task.id,
            task.title,
            task.dueLabel,
            J.getDueIsoFromLabel(task.dueLabel),
            "done",
          );
          updatedNotes.push(updatedNote);
        }

        const reply = J.buildBatchOverdueTaskReply(overdueTasks.length);
        deps.setCommandResult({
          title: "Overdue tasks completed",
          detail:
            overdueTasks.length > 0
              ? overdueTasks.map((task) => task.title).join(" | ")
              : "There were no overdue tasks to complete.",
        });
        deps.setStatusMessage("Processed all overdue tasks through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        if (updatedNotes.length > 0) {
          deps.setRecentNotes((current) =>
            [
              ...updatedNotes.reverse(),
              ...current.filter(
                (note) => !updatedNotes.some((updated) => updated.id === note.id),
              ),
            ].slice(0, 10),
          );
        }
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  } else if (intent.kind === "complete_task_range") {
        const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
        const tasksToComplete = intent.indices
          .map((index) => J.getPlannerTaskByIndex(availableTasks, index))
          .filter(Boolean) as PlannerTaskRecord[];
        if (tasksToComplete.length === 0) {
          throw new Error(
            "I could not resolve those tasks from the current list. Show your task notes first.",
          );
        }

        const updatedNotes: NoteRecord[] = [];
        for (const task of tasksToComplete) {
          const updatedNote = await updateNotionTask(
            task.id,
            task.title,
            task.dueLabel,
            J.getDueIsoFromLabel(task.dueLabel),
            "done",
          );
          updatedNotes.push(updatedNote);
        }

        const lastTask = tasksToComplete[tasksToComplete.length - 1];
        const lastUpdatedNote = updatedNotes[updatedNotes.length - 1];
        deps.setActiveConversationContext(
          J.createActiveTaskContext({
            ...lastTask,
            status: "done",
            sourceNote: lastUpdatedNote,
          }),
        );
        const reply = J.buildBatchOverdueTaskReply(tasksToComplete.length);
        deps.setCommandResult({
          title: "Batch task completion complete",
          detail: tasksToComplete.map((task) => task.title).join(" | "),
        });
        deps.setStatusMessage("Completed selected tasks through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.setRecentNotes((current) =>
          [
            ...updatedNotes.reverse(),
            ...current.filter((note) => !updatedNotes.some((updated) => updated.id === note.id)),
          ].slice(0, 10),
        );
        await deps.loadRecentNotes();
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return { status: "handled" };
  }
  return { status: "unhandled" };
}

import * as J from "../../legacy/appHelpers";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import { createNotionNote, openBrowserUrl } from "../../../services/jarvisApi";
import { createGoogleCalendarEvent } from "../../../services/googleCalendar";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";

/** Gateway-owned list/show memory intents stripped in Wave R2; person/school mutations remain. */
export async function handleMemoryIntent(
  deps: ResolvedCommandRouterDeps,
  intent: import("../jarvisCommandTypes").CommandIntent,
  _executeIntent: ExecuteIntentFn,
): Promise<ExecuteIntentResult> {
  if (intent.kind === "update_person_relationship") {
    const person = deps.updatePersonMemory(intent.query, (entry) => ({
      ...entry,
      relationship: intent.relationship,
    }));
    if (!person) {
      throw new Error(`I could not find ${intent.query} in people memory yet.`);
    }
    const reply = `Okay. I saved ${person.name} as your ${intent.relationship}.`;
    deps.setCommandResult({
      title: "Relationship updated",
      detail: J.buildBirthdayLookupReply(person),
    });
    deps.setStatusMessage("People memory updated through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "update_person_age") {
    const person = deps.updatePersonMemory(intent.query, (entry) => ({
      ...entry,
      age: intent.age,
    }));
    if (!person) {
      throw new Error(`I could not find ${intent.query} in people memory yet.`);
    }
    const reply = `Okay. I saved ${person.name} as turning ${intent.age}.`;
    deps.setCommandResult({
      title: "Birthday age updated",
      detail: J.buildBirthdayLookupReply(person),
    });
    deps.setStatusMessage("People memory updated through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "add_person_gift_note") {
    const person = deps.updatePersonMemory(intent.query, (entry) => ({
      ...entry,
      giftNotes: [...(entry.giftNotes ?? []), intent.note],
    }));
    if (!person) {
      throw new Error(`I could not find ${intent.query} in people memory yet.`);
    }
    const reply = `Okay. I added that gift note for ${person.name}.`;
    deps.setCommandResult({
      title: "Gift note saved",
      detail: J.buildBirthdayLookupReply(person),
    });
    deps.setStatusMessage("People memory updated through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "add_person_contact_note") {
    const person = deps.updatePersonMemory(intent.query, (entry) => ({
      ...entry,
      contactNotes: [...(entry.contactNotes ?? []), intent.note],
    }));
    if (!person) {
      throw new Error(`I could not find ${intent.query} in people memory yet.`);
    }
    const reply = `Okay. I added that contact note for ${person.name}.`;
    deps.setCommandResult({
      title: "Contact note saved",
      detail: J.buildBirthdayLookupReply(person),
    });
    deps.setStatusMessage("People memory updated through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "set_person_last_contact") {
    const person = deps.updatePersonMemory(intent.query, (entry) => ({
      ...entry,
      lastContactLabel: intent.whenLabel,
    }));
    if (!person) {
      throw new Error(`I could not find ${intent.query} in people memory yet.`);
    }
    const reply = `Okay. I saved that you last talked to ${person.name} ${intent.whenLabel}.`;
    deps.setCommandResult({
      title: "Last contact saved",
      detail: J.buildBirthdayLookupReply(person),
    });
    deps.setStatusMessage("People memory updated through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "set_person_follow_up") {
    const person = deps.updatePersonMemory(intent.query, (entry) => ({
      ...entry,
      followUpDueLabel: intent.dueLabel,
      followUpReason: intent.reason,
    }));
    if (!person) {
      throw new Error(`I could not find ${intent.query} in people memory yet.`);
    }
    const reply = `Okay. I will remind you to follow up with ${person.name} ${intent.dueLabel}.`;
    deps.setCommandResult({
      title: "People follow-up saved",
      detail: J.buildBirthdayLookupReply(person),
    });
    deps.setStatusMessage("People memory updated through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "list_people_follow_ups") {
    const followUps = deps.peopleMemory.filter((person) => person.followUpDueLabel);
    const reply = J.buildPeopleFollowUpReply(followUps.length);
    deps.setCommandResult({
      title: "People follow-ups",
      detail:
        followUps.length > 0
          ? followUps.map((person) => J.formatPersonFollowUp(person)).join(" | ")
          : "No people follow-ups are saved yet.",
    });
    deps.setStatusMessage("People follow-ups loaded through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "list_people_check_ins") {
    const followUps = J.getUpcomingPeopleFollowUps(deps.peopleMemory);
    const reply = J.buildPeopleCheckInReply(followUps.length);
    deps.setCommandResult({
      title: "People to check in with",
      detail:
        followUps.length > 0
          ? followUps.map((person) => J.formatPersonFollowUp(person)).join(" | ")
          : "No people are flagged for a check-in this week.",
    });
    deps.setStatusMessage("People check-ins loaded through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "set_person_birthday_reminder") {
    const person = deps.updatePersonMemory(intent.query, (entry) => ({
      ...entry,
      reminderLeadDays: intent.daysBefore,
    }));
    if (!person) {
      throw new Error(`I could not find ${intent.query} in people memory yet.`);
    }
    const reply = `Okay. I will treat ${intent.daysBefore} days before ${person.name}'s birthday as the reminder timing.`;
    deps.setCommandResult({
      title: "Birthday reminder updated",
      detail: J.buildBirthdayLookupReply(person),
    });
    deps.setStatusMessage("People memory updated through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "add_person_birthday_to_calendar") {
    const person = J.findPersonByQuery(deps.peopleMemory, intent.query);
    if (!person) {
      throw new Error(`I could not find a saved birthday for ${intent.query} yet.`);
    }
    const { start, end } = J.getNextBirthdayCalendarWindow(person);
    if (deps.googleCalendarAccessToken) {
      await createGoogleCalendarEvent(
        deps.googleCalendarAccessToken,
        `Birthday: ${person.name}`,
        start,
        end,
      );
    } else {
      await openBrowserUrl(J.buildGoogleCalendarEventUrl(`Birthday: ${person.name}`, start, end));
    }
    deps.updatePersonMemory(person.name, (entry) => ({
      ...entry,
      calendarLinkedAt: new Date().toISOString(),
    }));
    const reply = J.buildBirthdayCalendarReply(person.name);
    deps.setCommandResult({
      title: deps.googleCalendarAccessToken ? "Birthday calendar event created" : "Birthday calendar draft opened",
      detail: deps.googleCalendarAccessToken
        ? `Created a Google Calendar birthday event for ${person.name}.`
        : `Opened a Google Calendar birthday draft for ${person.name}.`,
    });
    deps.setStatusMessage("Birthday calendar action completed through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "list_school_memory") {
    const reply =
      deps.schoolPlanMemory.length > 0
        ? `I found ${deps.schoolPlanMemory.length} saved school plan${deps.schoolPlanMemory.length === 1 ? "" : "s"}.`
        : "You do not have any saved school plans yet.";
    deps.setCommandResult({
      title: "School memory",
      detail:
        deps.schoolPlanMemory.length > 0
          ? deps.schoolPlanMemory
              .map(
                (item) =>
                  `${item.title}${item.subjects.length > 0 ? ` - ${item.subjects.join(", ")}` : ""}${
                    item.examCountdowns.length > 0 ? ` - exams: ${item.examCountdowns.join(", ")}` : ""
                  }`,
              )
              .join(" | ")
          : "No school plans are saved yet.",
    });
    deps.setStatusMessage("School memory loaded through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "create_school_plan" || intent.kind === "save_school_plan_to_notion") {
    const availableTasks = deps.plannerTasks.length > 0 ? deps.plannerTasks : await deps.loadPlannerTaskRecords();
    const planContent = J.buildSchoolPlanContent(deps.recentEmails, availableTasks, deps.recentFiles);
    const loadedPdfs = J.getLoadedPdfFiles(deps.recentFiles);
    const urgentStudyEmails = deps.recentEmails
      .map(J.scoreEmailUrgency)
      .filter(({ email, signals, score }) => {
        const text = `${email.subject} ${email.snippet} ${email.body}`.toLowerCase();
        return (
          /\b(class|course|assignment|exam|quiz|study|homework|syllabus|lecture|project)\b/i.test(text) ||
          signals.deadlines.length > 0 ||
          score > 0
        );
      })
      .slice(0, 5);
    const studyTasks = availableTasks.filter(
      (task) =>
        /\b(class|course|assignment|exam|quiz|study|homework|syllabus|lecture|project|school)\b/i.test(
          `${task.title} ${task.sourceNote.summary}`,
        ) ||
        task.status === "today" ||
        task.status === "overdue",
    );
    const focusSummary = J.buildSchoolFocusSummary(urgentStudyEmails, studyTasks, loadedPdfs);
    const subjects = J.detectSchoolSubjects(deps.recentEmails, studyTasks, loadedPdfs);
    const sessions = J.buildSchoolSessions(subjects, loadedPdfs, studyTasks, urgentStudyEmails);
    const assignments = J.extractSchoolAssignments(urgentStudyEmails, studyTasks);
    const examCountdowns = J.buildExamCountdowns(urgentStudyEmails, studyTasks);
    const reply = J.buildSchoolPlanReply();

    if (intent.kind === "save_school_plan_to_notion") {
      const note = await createNotionNote(planContent);
      deps.rememberSchoolPlan(note.title, focusSummary, subjects, sessions, assignments, examCountdowns, planContent);
      deps.setCommandResult({
        title: "School plan saved",
        detail: `Saved your school mode plan to Notion as "${note.title}".`,
      });
      deps.setStatusMessage("School mode plan saved to Notion through JARVIS.");
      deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
      deps.appendConversationTurn("jarvis", J.buildSchoolPlanSavedReply(note.title));
      deps.speakIfEnabled(J.buildSchoolPlanSavedReply(note.title));
    } else {
      deps.rememberSchoolPlan(
        "School Mode Plan",
        focusSummary,
        subjects,
        sessions,
        assignments,
        examCountdowns,
        planContent,
      );
      deps.setCommandResult({
        title: "School mode plan ready",
        detail: planContent,
      });
      deps.setStatusMessage("School mode plan generated through JARVIS.");
      deps.appendConversationTurn("jarvis", reply);
      deps.speakIfEnabled(reply);
    }

    deps.setVoiceSessionPhase("ready");
    return { status: "handled" };
  }

  return { status: "unhandled" };
}

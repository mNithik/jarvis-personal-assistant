import type {
  CrossFeatureSuggestionRecord,
  ExpenseMemoryRecord,
  MeetingPrepMemoryRecord,
  PackageMemoryRecord,
  PersonMemoryRecord,
  SchoolPlanMemoryRecord,
} from "../command/jarvisCommandTypes";
import type { EmailRecord } from "../../types/jarvis";
import type { GoogleCalendarEventRecord } from "../../services/googleCalendar";
import { findMeetingPrepEvent } from "../semantic/intentRanking";
import {
  extractBirthdayCandidatesFromEmail,
  extractEmailSignals,
  extractExpenseDetails,
  extractPackageDetails,
  extractTravelDetails,
  getUpcomingPeopleFollowUps,
  hasExpenseSignal,
  hasPackageSignal,
  hasTravelSignal,
  isTomorrowDeliveryLabel,
} from "../legacy/appHelpers";

/** Build cross-feature suggestions from a single email. */
export function buildCrossFeatureSuggestionsForEmail(
  email: EmailRecord,
): CrossFeatureSuggestionRecord[] {
  const suggestions: CrossFeatureSuggestionRecord[] = [];
  const birthdayCandidates = extractBirthdayCandidatesFromEmail(email);
  const travelDetails = extractTravelDetails(email);
  const expenseDetails = extractExpenseDetails(email);
  const packageDetails = extractPackageDetails(email);
  const emailSignals = extractEmailSignals(email);

  if (birthdayCandidates.length > 0) {
    suggestions.push({
      id: `birthday-${email.id}`,
      title: "Save birthday details",
      detail: `I found ${birthdayCandidates.length} birthday cue${birthdayCandidates.length === 1 ? "" : "s"} in this email. I can move them into people memory.`,
      intent: { kind: "save_birthdays_from_current_email" },
    });
    suggestions.push({
      id: `birthday-brief-${email.id}`,
      title: "Save birthdays and refresh the brief",
      detail: "I can save the birthday details from this email and then refresh your daily brief so they show up there too.",
      intents: [{ kind: "save_birthdays_from_current_email" }, { kind: "create_daily_brief" }],
    });
  }

  if (hasTravelSignal(travelDetails)) {
    suggestions.push({
      id: `travel-note-${email.id}`,
      title: "Save travel summary",
      detail: "This email looks travel-related. I can save the trip summary into Notion.",
      intent: { kind: "save_current_email_travel_to_notion" },
    });

    if (
      travelDetails.dates.length > 0 ||
      travelDetails.departures.length > 0 ||
      travelDetails.checkIns.length > 0
    ) {
      suggestions.push({
        id: `travel-calendar-${email.id}`,
        title: "Add trip to calendar",
        detail: "I found enough trip timing cues to try creating a calendar item from this travel email.",
        intent: { kind: "save_current_email_travel_to_calendar" },
      });
      suggestions.push({
        id: `travel-bundle-${email.id}`,
        title: "Capture the whole trip",
        detail: "I can save the travel summary to Notion and add the trip to Calendar in one pass.",
        intents: [
          { kind: "save_current_email_travel_to_notion" },
          { kind: "save_current_email_travel_to_calendar" },
        ],
      });
    }
  }

  if (hasExpenseSignal(expenseDetails)) {
    suggestions.push({
      id: `expense-${email.id}`,
      title: "Capture expense",
      detail: "This looks like a receipt or invoice. I can save it into your expense memory and Notion.",
      intent: { kind: "save_current_email_expense_to_notion" },
    });
    if (expenseDetails.normalizedCategory) {
      suggestions.push({
        id: `expense-bundle-${email.id}`,
        title: "Capture and total this category",
        detail: `I can save this expense and then show your ${expenseDetails.normalizedCategory.toLowerCase()} spending for this month.`,
        intents: [
          { kind: "save_current_email_expense_to_notion" },
          {
            kind: "list_monthly_expenses_by_category",
            category: expenseDetails.normalizedCategory,
          },
        ],
      });
    }
  }

  if (hasPackageSignal(packageDetails)) {
    suggestions.push({
      id: `package-${email.id}`,
      title: "Track package",
      detail: "This looks like a shipping update. I can save it into package memory and Notion.",
      intent: { kind: "save_current_email_package_to_notion" },
    });
    suggestions.push({
      id: `package-bundle-${email.id}`,
      title: "Track and check package status",
      detail: "I can save this package update and then show the next most relevant shipping view.",
      intents: [
        { kind: "save_current_email_package_to_notion" },
        packageDetails.statuses.some((status) => /delayed/i.test(status))
          ? { kind: "list_delayed_packages" }
          : packageDetails.deliveryDates.some((label) => isTomorrowDeliveryLabel(label))
            ? { kind: "list_packages_arriving_tomorrow" }
            : { kind: "list_package_memory" },
      ],
    });
  }

  if (emailSignals.meetings.length > 0) {
    suggestions.push({
      id: `calendar-${email.id}`,
      title: "Turn email into calendar item",
      detail: "I spotted meeting-like details in this email. I can turn it into a calendar action.",
      intent: { kind: "create_calendar_event_from_current_email" },
    });
  }

  return suggestions.slice(0, 6);
}

function findImminentCalendarEvent(events: GoogleCalendarEventRecord[]) {
  const now = Date.now();
  const horizon = now + 60 * 60 * 1000;
  return (
    events.find((event) => {
      if (!event.start) {
        return false;
      }
      const start = new Date(event.start).getTime();
      return start > now && start <= horizon;
    }) ?? null
  );
}

/** Build cross-feature suggestions from current memory state. */
export function buildCrossFeatureSuggestionsForState(input: {
  peopleMemory: PersonMemoryRecord[];
  packageMemory: PackageMemoryRecord[];
  expenseMemory: ExpenseMemoryRecord[];
  meetingPrepMemory: MeetingPrepMemoryRecord[];
  schoolPlanMemory: SchoolPlanMemoryRecord[];
  todayCalendarEvents?: GoogleCalendarEventRecord[];
  googleCalendarAccessToken?: string | null;
}): CrossFeatureSuggestionRecord[] {
  const {
    peopleMemory,
    packageMemory,
    expenseMemory,
    meetingPrepMemory,
    schoolPlanMemory,
    todayCalendarEvents = [],
    googleCalendarAccessToken,
  } = input;
  const suggestions: CrossFeatureSuggestionRecord[] = [];
  const upcomingFollowUps = getUpcomingPeopleFollowUps(peopleMemory);
  const arrivingTomorrow = packageMemory.filter((item) => item.arrivingTomorrow);
  const delayedPackages = packageMemory.filter((item) => /\bdelayed\b/i.test(item.status ?? ""));
  const recurringExpenses = expenseMemory.filter((item) => item.recurringLikely);

  if (upcomingFollowUps.length > 0) {
    suggestions.push({
      id: "people-followups",
      title: "Review people follow-ups",
      detail: `You have ${upcomingFollowUps.length} person-related follow-up${upcomingFollowUps.length === 1 ? "" : "s"} due soon.`,
      intent: { kind: "list_people_check_ins" },
    });
  }

  if (arrivingTomorrow.length > 0) {
    suggestions.push({
      id: "packages-tomorrow",
      title: "Check tomorrow's deliveries",
      detail: `You have ${arrivingTomorrow.length} package${arrivingTomorrow.length === 1 ? "" : "s"} arriving tomorrow.`,
      intent: { kind: "list_packages_arriving_tomorrow" },
    });
  }

  if (delayedPackages.length > 0) {
    suggestions.push({
      id: "packages-delayed",
      title: "Review delayed packages",
      detail: `You have ${delayedPackages.length} delayed package${delayedPackages.length === 1 ? "" : "s"} that may need attention.`,
      intent: { kind: "list_delayed_packages" },
    });
  }

  if (recurringExpenses.length > 0) {
    suggestions.push({
      id: "expenses-recurring",
      title: "Review recurring charges",
      detail: `I found ${recurringExpenses.length} likely recurring charge${recurringExpenses.length === 1 ? "" : "s"} in your saved expenses.`,
      intent: { kind: "list_recurring_expenses" },
    });
  }

  const imminentEvent =
    googleCalendarAccessToken && todayCalendarEvents.length > 0
      ? findImminentCalendarEvent(todayCalendarEvents) ??
        findMeetingPrepEvent(todayCalendarEvents, null)
      : null;
  if (imminentEvent && meetingPrepMemory.length === 0) {
    suggestions.push({
      id: "meeting-copilot-prep",
      title: "Prep for your next meeting",
      detail: `"${imminentEvent.summary}" is coming up soon and you have no saved meeting prep yet. I can pull together what you need.`,
      intent: { kind: "list_meeting_prep_memory" },
    });
  }

  if (meetingPrepMemory.length > 0 && schoolPlanMemory.length > 0) {
    suggestions.push({
      id: "planner-bundle",
      title: "Refresh your planning stack",
      detail: "I can rebuild your daily brief and school plan together so your planning context stays fresh.",
      intents: [{ kind: "create_school_plan" }, { kind: "create_daily_brief" }],
    });
  }

  return suggestions.slice(0, 5);
}

export function pickProactiveCrossSuggestion(suggestions: CrossFeatureSuggestionRecord[]) {
  return suggestions.find((suggestion) => (suggestion.intents?.length ?? 0) > 1) ?? suggestions[0] ?? null;
}

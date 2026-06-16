import * as J from "../../legacy/appHelpers";
import type { CommandRouterDeps } from "../commandRouterDepTypes";
import type { CommandIntent } from "../jarvisCommandTypes";
import { createGoogleCalendarEvent } from "../../../services/googleCalendar";
import { createNotionNote, openBrowserUrl } from "../../../services/jarvisApi";

type ResolvedCommandRouterDeps = Required<CommandRouterDeps>;

/** Gateway-owned email→Notion save intents stripped in Wave R2; read/extract/calendar remain. */
export async function handleEmailNotionIntent(
  deps: ResolvedCommandRouterDeps,
  intent: CommandIntent,
): Promise<boolean> {
  if (intent.kind === "read_current_email") {
        const email = J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email to read yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const reply = J.buildReadEmailReply(email.subject);
        deps.setCommandResult({
          title: `Email: ${email.subject}`,
          detail: J.formatEmailForReading(email),
        });
        deps.setStatusMessage("Current email loaded through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "extract_email_signals") {
        const email =
          intent.index === null ? deps.recentEmails[0] ?? null : J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email to analyze yet. Ask JARVIS to show unread emails or search Gmail first."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const signals = J.extractEmailSignals(email);
        const reply = J.buildEmailSignalsReply(email.subject);
        deps.setCommandResult({
          title: "Email details extracted",
          detail: J.formatEmailSignals(email, signals),
        });
        {
          const suggestions = deps.buildCrossFeatureSuggestionsForEmail(email);
          deps.setCrossFeatureSuggestions(suggestions);
          deps.setProactiveCrossSuggestion(deps.pickProactiveCrossSuggestion(suggestions));
        }
        deps.setStatusMessage("Email details were extracted through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "extract_current_email_signals") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no active email in the conversation yet. Open, read, or analyze an email first.",
          );
        }

        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const signals = J.extractEmailSignals(email);
        const reply = J.buildEmailSignalsReply(email.subject);
        deps.setCommandResult({
          title: "Email details extracted",
          detail: J.formatEmailSignals(email, signals),
        });
        {
          const suggestions = deps.buildCrossFeatureSuggestionsForEmail(email);
          deps.setCrossFeatureSuggestions(suggestions);
          deps.setProactiveCrossSuggestion(deps.pickProactiveCrossSuggestion(suggestions));
        }
        deps.setStatusMessage("Active email details were extracted through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "save_birthdays_from_current_email") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const candidates = J.extractBirthdayCandidatesFromEmail(email);
        for (const candidate of candidates) {
          deps.rememberPersonBirthday({ ...candidate, source: "gmail" });
        }
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const reply = J.buildBirthdayImportReply(candidates.length);
        deps.setCommandResult({
          title: "Birthday import",
          detail:
            candidates.length > 0
              ? candidates.map((candidate) => `${candidate.name} - ${candidate.birthdayLabel}`).join(" | ")
              : `No clear birthdays were found in ${email.subject}.`,
        });
        deps.setStatusMessage("Birthday extraction ran on the current email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "save_birthdays_from_email_index") {
        const email = J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(`Email ${intent.index} is not loaded right now. Load emails first.`);
        }

        const candidates = J.extractBirthdayCandidatesFromEmail(email);
        for (const candidate of candidates) {
          deps.rememberPersonBirthday({ ...candidate, source: "gmail" });
        }
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const reply = J.buildBirthdayImportReply(candidates.length);
        deps.setCommandResult({
          title: "Birthday import",
          detail:
            candidates.length > 0
              ? candidates.map((candidate) => `${candidate.name} - ${candidate.birthdayLabel}`).join(" | ")
              : `No clear birthdays were found in email ${intent.index}.`,
        });
        deps.setStatusMessage(`Birthday extraction ran on email ${intent.index}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "save_birthdays_from_email_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const candidates = J.extractBirthdayCandidatesFromEmail(email);
        for (const candidate of candidates) {
          deps.rememberPersonBirthday({ ...candidate, source: "gmail" });
        }
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        const reply = J.buildBirthdayImportReply(candidates.length);
        deps.setCommandResult({
          title: "Birthday import",
          detail:
            candidates.length > 0
              ? candidates.map((candidate) => `${candidate.name} - ${candidate.birthdayLabel}`).join(" | ")
              : `No clear birthdays were found in the email about ${intent.query}.`,
        });
        deps.setStatusMessage(`Birthday extraction ran on the email about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "save_birthdays_from_loaded_emails") {
        if (deps.recentEmails.length === 0) {
          throw new Error(
            "There are no loaded emails yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const candidateMap = new Map<string, import("../../semantic/intentRanking").BirthdayCandidate>();
        for (const email of deps.recentEmails) {
          for (const candidate of J.extractBirthdayCandidatesFromEmail(email)) {
            candidateMap.set(candidate.name.toLowerCase(), candidate);
          }
        }
        const candidates = Array.from(candidateMap.values());
        for (const candidate of candidates) {
          deps.rememberPersonBirthday({ ...candidate, source: "gmail" });
        }

        const reply = J.buildBirthdayImportReply(candidates.length);
        deps.setCommandResult({
          title: "Birthday import",
          detail:
            candidates.length > 0
              ? candidates.map((candidate) => `${candidate.name} - ${candidate.birthdayLabel}`).join(" | ")
              : "No clear birthdays were found in the currently loaded emails.",
        });
        deps.setStatusMessage("Birthday extraction ran across loaded emails.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "extract_current_email_travel") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = J.extractTravelDetails(email);
        const formatted = J.formatTravelExtraction(email, details);
        deps.rememberTravelSummary(email.subject, email.subject, details, formatted);
        const reply = J.buildTravelExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Travel extracted",
          detail: formatted,
        });
        deps.setStatusMessage("Travel extraction ran on the current email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "extract_email_travel") {
        const email =
          intent.index === null ? deps.recentEmails[0] ?? null : J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        const details = J.extractTravelDetails(email);
        const formatted = J.formatTravelExtraction(email, details);
        deps.rememberTravelSummary(email.subject, email.subject, details, formatted);
        const reply = J.buildTravelExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Travel extracted",
          detail: formatted,
        });
        deps.setStatusMessage("Travel extraction ran on the selected email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "extract_email_travel_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = J.extractTravelDetails(email);
        const formatted = J.formatTravelExtraction(email, details);
        deps.rememberTravelSummary(email.subject, email.subject, details, formatted);
        const reply = J.buildTravelExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Travel extracted",
          detail: formatted,
        });
        deps.setStatusMessage(`Travel extraction ran on the email about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "save_current_email_travel_to_calendar") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = J.extractTravelDetails(email);
        const calendarIntent = J.buildTravelCalendarIntent(email, details);
        if (!calendarIntent) {
          throw new Error("I could not find a clear travel date to add to calendar from that email yet.");
        }
        if (deps.googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            deps.googleCalendarAccessToken,
            calendarIntent.title,
            calendarIntent.start,
            calendarIntent.end,
          );
        } else {
          await openBrowserUrl(
            J.buildGoogleCalendarEventUrl(calendarIntent.title, calendarIntent.start, calendarIntent.end),
          );
        }
        deps.rememberTravelSummary(
          calendarIntent.title,
          email.subject,
          details,
          J.formatTravelExtraction(email, details),
          new Date().toISOString(),
        );
        const reply = J.buildTravelCalendarReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: deps.googleCalendarAccessToken ? "Travel calendar event created" : "Travel calendar draft opened",
          detail: deps.googleCalendarAccessToken
            ? `Created a Google Calendar trip event from ${email.subject}.`
            : `Opened a Google Calendar trip draft from ${email.subject}.`,
        });
        deps.setStatusMessage("Travel calendar action completed through JARVIS.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "save_email_travel_to_calendar_by_index") {
        const email = J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(`Email ${intent.index} is not loaded right now. Load emails first.`);
        }

        const details = J.extractTravelDetails(email);
        const calendarIntent = J.buildTravelCalendarIntent(email, details);
        if (!calendarIntent) {
          throw new Error(`I could not find a clear travel date in email ${intent.index} yet.`);
        }
        if (deps.googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            deps.googleCalendarAccessToken,
            calendarIntent.title,
            calendarIntent.start,
            calendarIntent.end,
          );
        } else {
          await openBrowserUrl(
            J.buildGoogleCalendarEventUrl(calendarIntent.title, calendarIntent.start, calendarIntent.end),
          );
        }
        deps.rememberTravelSummary(
          calendarIntent.title,
          email.subject,
          details,
          J.formatTravelExtraction(email, details),
          new Date().toISOString(),
        );
        const reply = J.buildTravelCalendarReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: deps.googleCalendarAccessToken ? "Travel calendar event created" : "Travel calendar draft opened",
          detail: deps.googleCalendarAccessToken
            ? `Created a Google Calendar trip event from email ${intent.index}.`
            : `Opened a Google Calendar trip draft from email ${intent.index}.`,
        });
        deps.setStatusMessage(`Travel calendar action ran on email ${intent.index}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "save_email_travel_to_calendar_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = J.extractTravelDetails(email);
        const calendarIntent = J.buildTravelCalendarIntent(email, details);
        if (!calendarIntent) {
          throw new Error(`I could not find a clear travel date in the email about ${intent.query} yet.`);
        }
        if (deps.googleCalendarAccessToken) {
          await createGoogleCalendarEvent(
            deps.googleCalendarAccessToken,
            calendarIntent.title,
            calendarIntent.start,
            calendarIntent.end,
          );
        } else {
          await openBrowserUrl(
            J.buildGoogleCalendarEventUrl(calendarIntent.title, calendarIntent.start, calendarIntent.end),
          );
        }
        deps.rememberTravelSummary(
          calendarIntent.title,
          email.subject,
          details,
          J.formatTravelExtraction(email, details),
          new Date().toISOString(),
        );
        const reply = J.buildTravelCalendarReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: deps.googleCalendarAccessToken ? "Travel calendar event created" : "Travel calendar draft opened",
          detail: deps.googleCalendarAccessToken
            ? `Created a Google Calendar trip event from the email about ${intent.query}.`
            : `Opened a Google Calendar trip draft from the email about ${intent.query}.`,
        });
        deps.setStatusMessage(`Travel calendar action ran on the email about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "extract_current_email_expense") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = J.extractExpenseDetails(email);
        const formatted = J.formatExpenseExtraction(email, details);
        deps.rememberExpenseSummary(
          email.subject,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          details.primaryAmountValue,
          details.normalizedCategory,
          details.primaryDate,
          details.orderNumbers[0] ?? null,
          details.recurringLikely,
          formatted,
        );
        const reply = J.buildExpenseExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Expense extracted",
          detail: formatted,
        });
        deps.setStatusMessage("Expense extraction ran on the current email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "extract_email_expense") {
        const email =
          intent.index === null ? deps.recentEmails[0] ?? null : J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        const details = J.extractExpenseDetails(email);
        const formatted = J.formatExpenseExtraction(email, details);
        deps.rememberExpenseSummary(
          email.subject,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          details.primaryAmountValue,
          details.normalizedCategory,
          details.primaryDate,
          details.orderNumbers[0] ?? null,
          details.recurringLikely,
          formatted,
        );
        const reply = J.buildExpenseExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Expense extracted",
          detail: formatted,
        });
        deps.setStatusMessage("Expense extraction ran on the selected email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "extract_email_expense_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = J.extractExpenseDetails(email);
        const formatted = J.formatExpenseExtraction(email, details);
        deps.rememberExpenseSummary(
          email.subject,
          email.subject,
          details.merchants[0] ?? null,
          details.amounts[0] ?? null,
          details.primaryAmountValue,
          details.normalizedCategory,
          details.primaryDate,
          details.orderNumbers[0] ?? null,
          details.recurringLikely,
          formatted,
        );
        const reply = J.buildExpenseExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Expense extracted",
          detail: formatted,
        });
        deps.setStatusMessage(`Expense extraction ran on the email about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "extract_current_email_package") {
        const email = J.resolveActiveEmail(deps.activeConversationContext, deps.recentEmails) ?? J.getCurrentEmail(deps.recentEmails);
        if (!email) {
          throw new Error(
            "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first.",
          );
        }

        const details = J.extractPackageDetails(email);
        const formatted = J.formatPackageExtraction(email, details);
        deps.rememberPackageSummary(
          email.subject,
          email.subject,
          details.carriers[0] ?? null,
          details.merchants[0] ?? null,
          details.items[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          details.trackingNumbers[0] ?? null,
          formatted,
        );
        const reply = J.buildPackageExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Package extracted",
          detail: formatted,
        });
        deps.setStatusMessage("Package extraction ran on the current email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "extract_email_package") {
        const email =
          intent.index === null ? deps.recentEmails[0] ?? null : J.getEmailByIndex(deps.recentEmails, intent.index);
        if (!email) {
          throw new Error(
            intent.index === null
              ? "There is no loaded email yet. Ask JARVIS to show unread emails or search Gmail first."
              : `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
          );
        }

        const details = J.extractPackageDetails(email);
        const formatted = J.formatPackageExtraction(email, details);
        deps.rememberPackageSummary(
          email.subject,
          email.subject,
          details.carriers[0] ?? null,
          details.merchants[0] ?? null,
          details.items[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          details.trackingNumbers[0] ?? null,
          formatted,
        );
        const reply = J.buildPackageExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Package extracted",
          detail: formatted,
        });
        deps.setStatusMessage("Package extraction ran on the selected email.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "extract_email_package_by_query") {
        const email = J.findEmailByQuery(deps.recentEmails, intent.query);
        if (!email) {
          throw new Error(`I could not find a loaded email about ${intent.query}.`);
        }

        const details = J.extractPackageDetails(email);
        const formatted = J.formatPackageExtraction(email, details);
        deps.rememberPackageSummary(
          email.subject,
          email.subject,
          details.carriers[0] ?? null,
          details.merchants[0] ?? null,
          details.items[0] ?? null,
          details.statuses[0] ?? null,
          details.deliveryDates[0] ?? null,
          details.trackingNumbers[0] ?? null,
          formatted,
        );
        const reply = J.buildPackageExtractionReply(email.subject);
        deps.setActiveConversationContext(J.createActiveEmailContext(email));
        deps.setCommandResult({
          title: "Package extracted",
          detail: formatted,
        });
        deps.setStatusMessage(`Package extraction ran on the email about ${intent.query}.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", reply);
        deps.speakIfEnabled(reply);
    return true;
  }
  return false;
}

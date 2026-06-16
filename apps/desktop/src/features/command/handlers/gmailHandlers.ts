import * as J from "../../legacy/appHelpers";
import type { CommandRouterDeps } from "../commandRouterDepTypes";
import type { CommandIntent } from "../jarvisCommandTypes";
import { openBrowserUrl } from "../../../services/jarvisApi";

type ResolvedCommandRouterDeps = Required<CommandRouterDeps>;

const GATEWAY_GMAIL_INTENTS = new Set<CommandIntent["kind"]>([
  "list_unread_emails",
  "search_emails",
  "read_email_by_index",
  "read_email_by_query",
  "extract_email_signals_by_query",
]);

export async function handleGmailIntent(
  deps: ResolvedCommandRouterDeps,
  intent: CommandIntent,
): Promise<boolean> {
  if (GATEWAY_GMAIL_INTENTS.has(intent.kind)) {
    return false;
  }

  if (intent.kind === "open_current_email") {
    const email = J.getCurrentEmail(deps.recentEmails);
    if (!email) {
      throw new Error(
        "There is no loaded email to open yet. Ask JARVIS to show unread emails or search Gmail first.",
      );
    }

    deps.setActiveConversationContext(J.createActiveEmailContext(email));
    await openBrowserUrl(J.buildGmailThreadUrl(email.threadId));
    const reply = J.buildOpenEmailReply(email.subject);
    deps.setCommandResult({
      title: "Gmail thread opened",
      detail: `Opened ${email.subject} in Gmail.`,
    });
    deps.setStatusMessage("Current Gmail thread opened through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "open_email_by_index") {
    const email = J.getEmailByIndex(deps.recentEmails, intent.index);
    if (!email) {
      throw new Error(
        `Email ${intent.index} is not loaded right now. Load emails first and then choose a visible email number.`,
      );
    }

    deps.setActiveConversationContext(J.createActiveEmailContext(email));
    await openBrowserUrl(J.buildGmailThreadUrl(email.threadId));
    const reply = J.buildOpenEmailReply(email.subject);
    deps.setCommandResult({
      title: "Gmail thread opened",
      detail: `Opened email ${intent.index} (${email.subject}) in Gmail.`,
    });
    deps.setStatusMessage(`Opened Gmail thread for email ${intent.index}.`);
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return true;
  }
  if (intent.kind === "open_email_by_query") {
    const email = J.findEmailByQuery(deps.recentEmails, intent.query);
    if (!email) {
      throw new Error(
        `I could not find a loaded email about ${intent.query}. Load or search Gmail first.`,
      );
    }

    deps.setActiveConversationContext(J.createActiveEmailContext(email));
    await openBrowserUrl(J.buildGmailThreadUrl(email.threadId));
    const reply = J.buildOpenEmailReply(email.subject);
    deps.setCommandResult({
      title: "Gmail thread opened",
      detail: `Opened the email about ${intent.query} in Gmail.`,
    });
    deps.setStatusMessage(`Opened Gmail thread about ${intent.query}.`);
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return true;
  }
  return false;
}

import { handleCalendarIntent } from "../handlers/calendarHandlers";
import { handleEmailNotionIntent } from "../handlers/emailNotionHandlers";
import { handleFileIntent } from "../handlers/fileHandlers";
import { handleGmailIntent } from "../handlers/gmailHandlers";
import { handlePdfIntent } from "../handlers/pdfHandlers";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";

export async function handleIntegrationsIntent(
  deps: ResolvedCommandRouterDeps,
  intent: import("../jarvisCommandTypes").CommandIntent,
  _executeIntent: ExecuteIntentFn,
): Promise<ExecuteIntentResult> {
  if (await handleCalendarIntent(deps, intent)) {
    return { status: "handled" };
  }
  if (await handleFileIntent(deps, intent)) {
    return { status: "handled" };
  }
  if (await handlePdfIntent(deps, intent)) {
    return { status: "handled" };
  }
  if (await handleGmailIntent(deps, intent)) {
    return { status: "handled" };
  }
  if (await handleEmailNotionIntent(deps, intent)) {
    return { status: "handled" };
  }
  return { status: "unhandled" };
}

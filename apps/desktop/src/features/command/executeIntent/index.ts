import * as J from "../../legacy/appHelpers";
import type { CommandIntent, CrossFeatureSuggestionRecord } from "../jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import {
  blockLegacyIntent,
  isGatewayOwnedIntentKind,
  legacyFallbackMessage,
} from "../legacyIntentGuards";
import { handleBuilderIntent } from "./builder";
import { handleClipboardIntent } from "./clipboard";
import { handleDesktopIntent } from "./desktop";
import { handleIntegrationsIntent } from "./integrations";
import { handleMemoryIntent } from "./memory";
import { handleModelIntent } from "./model";
import { handleNotionIntent } from "./notion";
import { handleOcrIntent } from "./ocr";
import { handleShellIntent } from "./shell";
import type { ExecuteIntentHandler } from "./types";

const INTENT_HANDLERS: ExecuteIntentHandler[] = [
  handleClipboardIntent,
  handleDesktopIntent,
  handleShellIntent,
  handleModelIntent,
  handleOcrIntent,
  handleBuilderIntent,
  handleMemoryIntent,
  handleNotionIntent,
  handleIntegrationsIntent,
];

export function createExecuteIntent(deps: ResolvedCommandRouterDeps) {
  async function executeIntent(intent: CommandIntent): Promise<boolean> {
    deps.setIsRoutingCommand(true);
    deps.setVoiceSessionPhase("processing");
    deps.setStatusMessage("Routing command through JARVIS.");
    let completed = false;

    if (!deps.gatewayConfig?.enabled && isGatewayOwnedIntentKind(intent.kind)) {
      legacyFallbackMessage(deps, intent);
      deps.setIsRoutingCommand(false);
      return false;
    }

    if (blockLegacyIntent(deps, intent)) {
      deps.setIsRoutingCommand(false);
      return false;
    }

    try {
      let handled = false;
      for (const handler of INTENT_HANDLERS) {
        const result = await handler(deps, intent, executeIntent);
        if (result.status === "return") {
          return result.completed;
        }
        if (result.status === "handled") {
          handled = true;
          break;
        }
      }

      if (handled) {
        if (intent.kind.startsWith("spotify_")) {
          deps.setActiveConversationContext(J.createActiveBrowserContext("https://open.spotify.com/"));
        }

        completed = true;
        await deps.loadMemoryView();
      }
    } catch (error) {
      deps.setVoiceSessionPhase("error");
      deps.setCommandResult({
        title: "Command failed",
        detail: J.getErrorDetail(
          error,
          "JARVIS could not complete that browser or study action through the native bridge.",
        ),
      });
      deps.appendConversationTurn("jarvis", J.buildFailureReply());
      deps.speakIfEnabled("I could not complete that.");
    } finally {
      deps.setIsRoutingCommand(false);
    }

    return completed;
  }

  return executeIntent;
}

export function createCrossFeatureHandler(
  deps: ResolvedCommandRouterDeps,
  executeIntent: (intent: CommandIntent) => Promise<boolean>,
) {
  async function handleApplyCrossFeatureSuggestion(suggestion: CrossFeatureSuggestionRecord) {
    const intents = suggestion.intents ?? (suggestion.intent ? [suggestion.intent] : []);
    if (intents.length === 0) {
      return;
    }

    let completed = true;
    for (const intent of intents) {
      const stepCompleted = await executeIntent(intent);
      if (!stepCompleted) {
        completed = false;
        break;
      }
    }
    if (completed) {
      deps.setCrossFeatureSuggestions((current) =>
        current.filter((entry) => entry.id !== suggestion.id),
      );
      deps.setProactiveCrossSuggestion((current) => (current?.id === suggestion.id ? null : current));
    }
  }
  return handleApplyCrossFeatureSuggestion;
}

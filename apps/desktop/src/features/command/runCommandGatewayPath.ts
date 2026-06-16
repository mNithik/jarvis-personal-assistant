import type { GatewayTurnResponse } from "../../services/jarvisApi";
import { gatewayRunTurn } from "../../services/jarvisApi";
import type { CommandIntent, RunCommandOutcome } from "./jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "./commandRouterTypes";
import * as J from "../legacy/appHelpers";

/** Wave 10 S29: gateway delegate prelude extracted from runCommandRouter. */
export async function tryRunGatewayCommandTurn(
  deps: ResolvedCommandRouterDeps,
  trimmedInput: string,
  executeIntent: (intent: CommandIntent) => Promise<boolean>,
): Promise<RunCommandOutcome | null> {
  if (!deps.gatewayConfig || !J.shouldDelegateToGateway(trimmedInput, deps.gatewayConfig)) {
    return null;
  }

  try {
    const response: GatewayTurnResponse = await gatewayRunTurn({
      command: trimmedInput,
      sessionId: deps.gatewaySessionRef.current,
      source: "text",
    });
    if (!response.result.legacy) {
      const handoff = response.result.integrationHandoff;
      if (handoff) {
        if (deps.gatewayConfig && J.isGatewaySimulationMode(deps.gatewayConfig)) {
          const blocked = J.formatSimulationBlockedHandoff(deps.gatewayConfig, handoff);
          deps.setCommandResult({ title: "Gateway simulation mode", detail: blocked });
          deps.setStatusMessage(blocked);
          deps.appendConversationTurn("jarvis", blocked);
          deps.speakIfEnabled(blocked);
          return { status: "completed" };
        }
        const intent = J.mapIntegrationHandoffToIntent(handoff);
        if (intent) {
          await executeIntent(intent);
          return { status: "completed" };
        }
      }
      deps.setCommandResult({
        title: "Gateway executed command",
        detail: response.result.reply,
      });
      deps.setStatusMessage(response.result.reply);
      deps.setVoiceSessionPhase("ready");
      deps.appendConversationTurn("jarvis", response.result.reply);
      deps.speakIfEnabled(response.result.reply);
      return { status: "completed" };
    }
    if (deps.gatewayConfig && J.isGatewaySimulationMode(deps.gatewayConfig)) {
      const reply =
        response.result.reply ||
        "Gateway simulation mode blocked legacy fallback for this command.";
      deps.setCommandResult({ title: "Gateway simulation mode", detail: reply });
      deps.setStatusMessage(reply);
      deps.appendConversationTurn("jarvis", reply);
      deps.speakIfEnabled(reply);
      return { status: "completed" };
    }
  } catch {
    // Gateway execution failed; fall through to legacy routing.
  }

  if (J.shouldBlockLegacyCommandInSimulation(trimmedInput, deps.gatewayConfig)) {
    const reply = "Gateway simulation mode blocked legacy command execution.";
    deps.setCommandResult({ title: "Gateway simulation mode", detail: reply });
    deps.setStatusMessage(reply);
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "completed" };
  }

  return null;
}

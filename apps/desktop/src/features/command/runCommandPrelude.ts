import type { CommandIntent } from "./jarvisCommandTypes";
import type { RunCommandOutcome } from "./jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "./commandRouterTypes";
import * as J from "../legacy/appHelpers";
import { previewGatewayTurn } from "../../services/jarvisApi";
import { tryRunGatewayCommandTurn } from "./runCommandGatewayPath";

type RunCommandAgain = (
  command: string,
  options?: {
    appendUserTurn?: boolean;
    allowChaining?: boolean;
    bypassGatewayConfirmation?: boolean;
  },
) => Promise<RunCommandOutcome>;

/** Wave 10 S29: gateway confirm/teach/preview prelude extracted from runCommandRouter. */
export async function handleRunCommandPrelude(
  deps: ResolvedCommandRouterDeps,
  trimmedInput: string,
  options: {
    appendUserTurn: boolean;
    allowChaining: boolean;
    bypassGatewayConfirmation: boolean;
  },
  executeIntent: (intent: CommandIntent) => Promise<boolean>,
  runCommandAgain: RunCommandAgain,
): Promise<RunCommandOutcome | null> {
  const { appendUserTurn, allowChaining, bypassGatewayConfirmation } = options;

  if (deps.pendingGatewayConfirmation && !bypassGatewayConfirmation) {
    if (J.isGatewayConfirmationYes(trimmedInput)) {
      const confirmed = deps.pendingGatewayConfirmation;
      deps.setPendingGatewayConfirmation(null);
      deps.pushGatewayHistory(
        "confirm_accepted",
        confirmed.command,
        confirmed.preview,
        "User confirmed the pending gateway route.",
      );
      deps.setCommandResult({
        title: "Gateway confirmation accepted",
        detail: `Running the confirmed command: "${confirmed.command}".`,
      });
      return runCommandAgain(confirmed.command, {
        appendUserTurn: false,
        allowChaining,
        bypassGatewayConfirmation: true,
      });
    }

    if (J.isGatewayConfirmationNo(trimmedInput)) {
      deps.pushGatewayHistory(
        "confirm_cancelled",
        deps.pendingGatewayConfirmation.command,
        deps.pendingGatewayConfirmation.preview,
        "User cancelled the pending gateway route.",
      );
      deps.setPendingGatewayConfirmation(null);
      deps.setCommandResult({
        title: "Gateway confirmation cancelled",
        detail: "JARVIS will not run that pending command.",
      });
      deps.setStatusMessage("Gateway confirmation cancelled.");
      deps.appendConversationTurn("jarvis", "Okay, I cancelled that pending command.");
      deps.speakIfEnabled("Okay, I cancelled that.");
      return { status: "clarification" };
    }

    deps.setPendingGatewayConfirmation(null);
    deps.setCommandResult({
      title: "Gateway confirmation replaced",
      detail: "JARVIS cleared the pending confirmation and will route your new command instead.",
    });
  }

  if (deps.pendingGatewayTeaching && !bypassGatewayConfirmation) {
    const pending = deps.pendingGatewayTeaching;
    const teachingInstruction = J.parseTeachingInstruction(trimmedInput, pending.phrase);

    if (teachingInstruction?.kind === "teach_phrase") {
      const taught = await deps.teachJarvisMeaning(
        teachingInstruction.phrase,
        teachingInstruction.meaning,
      );
      deps.pushGatewayHistory(
        "teach_saved",
        teachingInstruction.phrase,
        pending.preview,
        `Saved phrase as ${J.describeCommandIntent(taught.resolvedIntent)}.`,
      );
      deps.setPendingGatewayTeaching(null);
      deps.setTeachingTargetPhrase(null);
      deps.setCommandResult({
        title: "Gateway phrase taught",
        detail: `JARVIS learned that "${teachingInstruction.phrase}" means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
      });
      deps.setStatusMessage(`Gateway learned what "${teachingInstruction.phrase}" means.`);
      deps.appendConversationTurn(
        "jarvis",
        `I'll remember that "${teachingInstruction.phrase}" means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
      );
      deps.speakIfEnabled(
        `I'll remember that ${teachingInstruction.phrase} means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
      );
      return { status: "completed" };
    }

    if (teachingInstruction?.kind === "teach_workflow") {
      const workflow = deps.teachJarvisWorkflow(
        teachingInstruction.phrase,
        teachingInstruction.steps,
      );
      deps.pushGatewayHistory(
        "teach_saved",
        teachingInstruction.phrase,
        pending.preview,
        `Saved ${workflow.steps.length}-step workflow.`,
      );
      deps.setPendingGatewayTeaching(null);
      deps.setTeachingTargetPhrase(null);
      deps.setCommandResult({
        title: "Gateway workflow taught",
        detail: `Saved "${workflow.triggerPhrase}" as a ${workflow.steps.length}-step workflow.`,
      });
      deps.setStatusMessage(`Gateway learned the workflow for "${workflow.triggerPhrase}".`);
      deps.appendConversationTurn(
        "jarvis",
        `I'll remember that "${workflow.triggerPhrase}" runs ${workflow.steps.length} steps.`,
      );
      deps.speakIfEnabled(
        `I'll remember that ${workflow.triggerPhrase} runs ${workflow.steps.length} steps.`,
      );
      return { status: "completed" };
    }

    if (J.isGatewayConfirmationNo(trimmedInput)) {
      deps.pushGatewayHistory(
        "teach_cancelled",
        pending.phrase,
        pending.preview,
        "User cancelled gateway teaching.",
      );
      deps.setPendingGatewayTeaching(null);
      deps.setTeachingTargetPhrase(null);
      deps.setCommandResult({
        title: "Gateway teaching cancelled",
        detail: "JARVIS will not learn a mapping for that phrase right now.",
      });
      deps.setStatusMessage("Gateway teaching cancelled.");
      deps.appendConversationTurn("jarvis", "Okay, I will not learn that phrase right now.");
      deps.speakIfEnabled("Okay, I will not learn that phrase right now.");
      return { status: "clarification" };
    }
  }

  if (appendUserTurn) {
    deps.appendConversationTurn("user", trimmedInput);
  }

  const gatewayOutcome = await tryRunGatewayCommandTurn(deps, trimmedInput, executeIntent);
  if (gatewayOutcome) {
    return gatewayOutcome;
  }

  if (!bypassGatewayConfirmation) {
    try {
      const preview = await previewGatewayTurn({ command: trimmedInput, source: "text" });
      deps.setGatewayPreview(preview);
      deps.setGatewayPreviewError(null);
      const route = preview.result.route;
      if (route?.decisionPolicy === "confirm") {
        deps.setPendingGatewayTeaching(null);
        deps.setPendingGatewayConfirmation({ command: trimmedInput, preview });
        deps.pushGatewayHistory(
          "confirm_requested",
          trimmedInput,
          preview,
          "Gateway asked for confirmation before execution.",
        );
        deps.setCommandResult({
          title: "Gateway confirmation needed",
          detail: `JARVIS thinks this belongs to ${route.capabilityLabel}. Say yes to run it, or no to cancel.`,
        });
        deps.setStatusMessage("Gateway is waiting for confirmation.");
        deps.appendConversationTurn(
          "jarvis",
          `I think this is ${route.capabilityLabel}. Say yes to run it, or no to cancel.`,
        );
        deps.speakIfEnabled(`I think this is ${route.capabilityLabel}. Should I run it?`);
        return { status: "clarification" };
      }
      if (route?.decisionPolicy === "teach") {
        deps.setPendingGatewayConfirmation(null);
        deps.setPendingGatewayTeaching({ phrase: trimmedInput, preview });
        deps.setTeachingTargetPhrase(trimmedInput);
        deps.pushGatewayHistory(
          "teach_requested",
          trimmedInput,
          preview,
          "Gateway asked to learn this low-confidence phrase.",
        );
        deps.setCommandResult({
          title: "Gateway needs teaching",
          detail: `I do not know what "${trimmedInput}" should do yet. Teach me with "that means ..." or "when I say ${trimmedInput}, I mean ...".`,
        });
        deps.setStatusMessage("Gateway is waiting for teaching.");
        deps.appendConversationTurn(
          "jarvis",
          `I do not know what "${trimmedInput}" should do yet. Tell me what it means.`,
        );
        deps.speakIfEnabled(`I do not know what ${trimmedInput} should do yet. Tell me what it means.`);
        return { status: "clarification" };
      }
    } catch {
      // Gateway preview is advisory. Existing command routing stays available if preview fails.
    }
  }

  if (J.isStartTrainingModeCommand(trimmedInput)) {
    deps.startTrainingMode(5);
    return { status: "clarification" };
  }

  if (deps.trainingModeSession) {
    return deps.handleTrainingModeInput(trimmedInput, deps.trainingModeSession);
  }

  return null;
}

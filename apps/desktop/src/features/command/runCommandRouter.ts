// Legacy router body; CommandRouterDeps are typed in commandRouterDepTypes.ts.
import * as J from "../legacy/appHelpers";
import type { CommandRouterDeps } from "./commandRouterDepTypes";
export type { CommandRouterDeps } from "./commandRouterDepTypes";
import type {
  CommandIntent,
  CrossFeatureSuggestionRecord,
  RunCommandOutcome,
} from "./jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "./commandRouterTypes";
import { handleRunCommandPrelude } from "./runCommandPrelude";
import { runCommandLegacyPath } from "./runCommandLegacyPath";

export function createRunCommand(
  deps: ResolvedCommandRouterDeps,
  executeIntent: (intent: CommandIntent) => Promise<boolean>,
  handleApplyCrossFeatureSuggestion: (suggestion: CrossFeatureSuggestionRecord) => Promise<void>,
) {
  async function runCommand(
    trimmedInput: string,
    options?: {
      appendUserTurn?: boolean;
      allowChaining?: boolean;
      bypassGatewayConfirmation?: boolean;
    },
  ): Promise<RunCommandOutcome> {
    const appendUserTurn = options?.appendUserTurn ?? true;
    const allowChaining = options?.allowChaining ?? true;
    const bypassGatewayConfirmation = options?.bypassGatewayConfirmation ?? false;
    deps.currentRouteLabelRef.current = undefined;
    deps.setCrossFeatureSuggestions([]);

    if (!trimmedInput) {
      deps.setVoiceSessionPhase("idle");
      deps.setStatusMessage("No command to route yet.");
      deps.setCommandResult({
        title: "No command to route",
        detail: "Type something like 'Open my study apps' to test the first skill.",
      });
      deps.speakIfEnabled("I did not hear a command to route.");
      return { status: "empty" };
    }

    const preludeOutcome = await handleRunCommandPrelude(
      deps,
      trimmedInput,
      { appendUserTurn, allowChaining, bypassGatewayConfirmation },
      executeIntent,
      (command, opts) => runCommand(command, opts),
    );
    if (preludeOutcome) {
      return preludeOutcome;
    }

    return runCommandLegacyPath(
      deps,
      trimmedInput,
      allowChaining,
      executeIntent,
      (command, opts) => runCommand(command, opts),
      handleApplyCrossFeatureSuggestion,
    );
  }
  return runCommand;
}

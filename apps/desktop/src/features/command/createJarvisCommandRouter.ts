// Glue-only command router (Wave 6 S20).
import { FormEvent } from "react";
import type { CommandRouterDeps } from "./commandRouterDepTypes";
export type { CommandRouterDeps } from "./commandRouterDepTypes";
import type { JarvisCommandRouter } from "../../ui/context/JarvisAppContext";
import type { ResolvedCommandRouterDeps } from "./commandRouterTypes";
import { createCrossFeatureHandler, createExecuteIntent } from "./executeIntentRouter";
import { createRunCommand } from "./runCommandRouter";

export function createJarvisCommandRouter(depsInput: CommandRouterDeps): JarvisCommandRouter {
  const deps = depsInput as ResolvedCommandRouterDeps;
  const executeIntent = createExecuteIntent(deps);
  const handleApplyCrossFeatureSuggestion = createCrossFeatureHandler(deps, executeIntent);
  const runCommand = createRunCommand(deps, executeIntent, handleApplyCrossFeatureSuggestion);

  async function routeCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const command = deps.input.trim();
    await deps.refreshGatewayPreview(command, "text");
    await runCommand(command);
  }

  async function routeCommandFromVoice(transcript: string) {
    const command = transcript.trim();
    await deps.refreshGatewayPreview(command, "voice");
    await runCommand(command);
  }

  return {
    routeCommand,
    routeCommandFromVoice,
    executeIntent,
    runCommand,
  };
}

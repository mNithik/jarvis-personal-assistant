import { useCallback, type MutableRefObject } from "react";

import type { CommandRouterDeps } from "../features/command/commandRouterDepTypes";
import type { CommandIntent, RunCommandOutcome } from "../features/command/jarvisCommandTypes";
import { useJarvisCommandRouter } from "./useJarvisCommandRouter";
import { useJarvisCommandRouterDeps } from "./useJarvisCommandRouterDeps";
import type { JarvisCommandRouter } from "../ui/context/JarvisAppContext";

export type JarvisShellRouterBridgeSlices = {
  state: CommandRouterDeps;
  setters: CommandRouterDeps;
  handlers: CommandRouterDeps;
  voice: CommandRouterDeps;
  gateway: CommandRouterDeps;
  model: CommandRouterDeps;
  workflow: CommandRouterDeps;
  integration: CommandRouterDeps;
  memory: CommandRouterDeps;
  ocr: CommandRouterDeps;
  ui: CommandRouterDeps;
  autonomous: CommandRouterDeps;
  proposals: CommandRouterDeps;
  loaders: CommandRouterDeps;
  embedding: CommandRouterDeps;
  refs?: CommandRouterDeps;
};

export type JarvisShellRouterBridgeRefs = {
  executeIntentRef: MutableRefObject<(intent: CommandIntent) => Promise<boolean | undefined>>;
  runCommandRef: MutableRefObject<
    (
      command: string,
      options?: { appendUserTurn?: boolean; allowChaining?: boolean },
    ) => Promise<RunCommandOutcome>
  >;
  routeCommandFromVoiceRef: MutableRefObject<(transcript: string) => Promise<void>>;
};

function mergeRouterBridgeSlices(slices: JarvisShellRouterBridgeSlices): CommandRouterDeps {
  return {
    ...slices.state,
    ...slices.setters,
    ...slices.handlers,
    ...slices.voice,
    ...slices.gateway,
    ...slices.model,
    ...slices.workflow,
    ...slices.integration,
    ...slices.memory,
    ...slices.ocr,
    ...slices.ui,
    ...slices.autonomous,
    ...slices.proposals,
    ...slices.loaders,
    ...slices.embedding,
    ...(slices.refs ?? {}),
  };
}

/** Wave C peel: command router deps assembly + router bridge from JarvisAppRoot.logic. */
export function useJarvisShellRouterBridge(
  slices: JarvisShellRouterBridgeSlices,
  routerRefs: JarvisShellRouterBridgeRefs,
): JarvisCommandRouter & {
  assignRouterRefs: () => void;
} {
  const commandRouterDepsRef = useJarvisCommandRouterDeps(mergeRouterBridgeSlices(slices));
  const commandRouter = useJarvisCommandRouter(commandRouterDepsRef.current);
  const { routeCommand, routeCommandFromVoice, executeIntent, runCommand } = commandRouter;

  const assignRouterRefs = useCallback(() => {
    routerRefs.executeIntentRef.current = executeIntent;
    routerRefs.routeCommandFromVoiceRef.current = routeCommandFromVoice;
    routerRefs.runCommandRef.current = runCommand;
  }, [executeIntent, routeCommandFromVoice, runCommand, routerRefs]);

  assignRouterRefs();

  return {
    routeCommand,
    routeCommandFromVoice,
    executeIntent,
    runCommand,
    assignRouterRefs,
  };
}

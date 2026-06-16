import { useRef } from "react";

import type { CommandRouterDeps } from "../features/command/commandRouterDepTypes";

/** Wave 2 peel: stable ref + Object.assign for command router deps. */
export function useJarvisCommandRouterDeps(deps: CommandRouterDeps) {
  const commandRouterDepsRef = useRef<CommandRouterDeps>({});
  Object.assign(commandRouterDepsRef.current, deps);
  return commandRouterDepsRef;
}

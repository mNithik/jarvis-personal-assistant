import { useMemo, useRef } from "react";
import {
  createJarvisCommandRouter,
  type CommandRouterDeps,
} from "../features/command/createJarvisCommandRouter";
import type { JarvisCommandRouter } from "../ui/context/JarvisAppContext";

export function useJarvisCommandRouter(deps: CommandRouterDeps): JarvisCommandRouter {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  return useMemo(() => createJarvisCommandRouter(depsRef.current), []);
}

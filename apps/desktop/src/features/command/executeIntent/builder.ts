import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";

/** Gateway owns builder handoff when enabled; legacy body removed (Wave R2). */
export async function handleBuilderIntent(
  _deps: ResolvedCommandRouterDeps,
  _intent: import("../jarvisCommandTypes").CommandIntent,
  _executeIntent: ExecuteIntentFn,
): Promise<ExecuteIntentResult> {
  return { status: "unhandled" };
}

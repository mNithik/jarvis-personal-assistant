import type { CommandIntent } from "../jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";

export type ExecuteIntentFn = (intent: CommandIntent) => Promise<boolean>;

export type ExecuteIntentResult =
  | { status: "handled" }
  | { status: "return"; completed: boolean }
  | { status: "unhandled" };

export type ExecuteIntentHandler = (
  deps: ResolvedCommandRouterDeps,
  intent: CommandIntent,
  executeIntent: ExecuteIntentFn,
) => Promise<ExecuteIntentResult>;

import type { CommandRouterDeps } from "../commandRouterDepTypes";
import type { CommandIntent } from "../jarvisCommandTypes";

type ResolvedCommandRouterDeps = Required<CommandRouterDeps>;

export async function handleCalendarIntent(
  _deps: ResolvedCommandRouterDeps,
  _intent: CommandIntent,
): Promise<boolean> {
  return false;
}

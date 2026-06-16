import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commandDir = path.join(__dirname, "../src/features/command");
const routerPath = path.join(commandDir, "runCommandRouter.ts");
const legacyPath = path.join(commandDir, "runCommandLegacyPath.ts");

const monolith = execSync(
  "git show HEAD:apps/desktop/src/features/command/createJarvisCommandRouter.ts",
  { cwd: path.join(__dirname, "../.."), encoding: "utf8" },
);
const lines = monolith.split(/\r?\n/);

const legacyStart = lines.findIndex((line) =>
  line.includes("handleTrainingReviewCleanupCommand"),
);
let legacyEnd = -1;
for (let index = lines.length - 1; index > legacyStart; index -= 1) {
  if (
    lines[index].trim() ===
    'return completed ? { status: "completed" } : { status: "failed" };'
  ) {
    legacyEnd = index;
    break;
  }
}

if (legacyStart < 0 || legacyEnd < 0) {
  throw new Error(`legacy bounds not found: start=${legacyStart} end=${legacyEnd}`);
}

const legacyBody = lines.slice(legacyStart, legacyEnd + 1).join("\n");

const legacyFile = `import * as J from "../legacy/appHelpers";
import type { CommandIntent, RunCommandOutcome } from "./jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "./commandRouterTypes";
import { interpretConversationWithOllama } from "../../services/jarvisApi";

/** Wave 12: legacy NL routing tail after gateway prelude. */
export async function runCommandLegacyPath(
  deps: ResolvedCommandRouterDeps,
  trimmedInput: string,
  executeIntent: (intent: CommandIntent) => Promise<boolean>,
): Promise<RunCommandOutcome> {
${legacyBody}
}
`;

const routerFile = `// Legacy router body; CommandRouterDeps are typed in commandRouterDepTypes.ts.
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
  void handleApplyCrossFeatureSuggestion;
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

    return runCommandLegacyPath(deps, trimmedInput, executeIntent);
  }
  return runCommand;
}
`;

fs.writeFileSync(legacyPath, legacyFile);
fs.writeFileSync(routerPath, routerFile);

console.log(
  `Recovered runCommandLegacyPath.ts (${legacyFile.split(/\r?\n/).length} lines)`,
);
console.log(`runCommandRouter.ts (${routerFile.split(/\r?\n/).length} lines)`);

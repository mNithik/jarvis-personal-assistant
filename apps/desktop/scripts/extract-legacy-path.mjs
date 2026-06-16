import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commandDir = path.join(__dirname, "../src/features/command");
const routerPath = path.join(commandDir, "runCommandRouter.ts");
const legacyPath = path.join(commandDir, "runCommandLegacyPath.ts");

const lines = fs.readFileSync(routerPath, "utf8").split(/\r?\n/);

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

const headerLines = lines.slice(0, lines.findIndex((l) => l.startsWith("export function createRunCommand")));
const importBlock = headerLines
  .filter((line) => line.startsWith("import ") || line.startsWith("import{"))
  .filter((line) => !line.includes("runCommandPrelude"))
  .join("\n");

const legacyBody = lines.slice(legacyStart, legacyEnd + 1).join("\n");

const legacyFile = `${importBlock}
import type { RunCommandOutcome } from "./jarvisCommandTypes";
import type { CommandIntent } from "./jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "./commandRouterTypes";

/** Wave 12: legacy NL routing tail after gateway prelude. */
export async function runCommandLegacyPath(
  deps: ResolvedCommandRouterDeps,
  trimmedInput: string,
  executeIntent: (intent: CommandIntent) => Promise<boolean>,
): Promise<RunCommandOutcome> {
${legacyBody}
}
`;

const preludeEnd = lines.findIndex((line) => line.includes("if (preludeOutcome)"));
const runCommandClose = lines.findIndex((line) => line.trim() === "return runCommand;");

const thinRouter = `${headerLines.filter((l) => !l.includes('export * from "../legacy/appHelpers"')).join("\n")}
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

    return runCommandLegacyPath(deps, trimmedInput, executeIntent);
  }
  return runCommand;
}
`;

fs.writeFileSync(legacyPath, legacyFile);
fs.writeFileSync(routerPath, thinRouter);

const routerLines = thinRouter.split(/\r?\n/).length;
const legacyLines = legacyFile.split(/\r?\n/).length;
console.log(`runCommandRouter.ts: ${routerLines} lines`);
console.log(`runCommandLegacyPath.ts: ${legacyLines} lines`);

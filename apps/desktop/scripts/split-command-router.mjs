import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commandDir = path.join(__dirname, "../src/features/command");

const glueRouter = `// Glue-only command router (Wave 6 S20 / Wave 12 router shrink).
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
`;

fs.writeFileSync(path.join(commandDir, "createJarvisCommandRouter.ts"), glueRouter);

const routerLines = fs.readFileSync(path.join(commandDir, "runCommandRouter.ts"), "utf8").split(/\r?\n/).length;
const legacyLines = fs.readFileSync(path.join(commandDir, "runCommandLegacyPath.ts"), "utf8").split(/\r?\n/).length;
console.log(`createJarvisCommandRouter.ts regenerated (${glueRouter.split(/\r?\n/).length} lines).`);
console.log(`runCommandRouter.ts: ${routerLines} lines; runCommandLegacyPath.ts: ${legacyLines} lines.`);

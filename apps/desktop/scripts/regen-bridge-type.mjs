import fs from "node:fs";

const hook = fs.readFileSync("src/hooks/useJarvisAppRoot.tsx", "utf8");
const callMatch = hook.match(/buildJarvisRouterBridgeState\(\{([\s\S]*?)\}\),/);
if (!callMatch) throw new Error("call not found");
const callKeys = [...callMatch[1].matchAll(/^\s+(\w+),/gm)].map((m) => m[1]);
const typeFields = callKeys
  .map((key) => `  ${key}: CommandRouterDeps["${key}"];`)
  .join("\n");

const body = `import type { CommandRouterDeps } from "../features/command/commandRouterDepTypes";
import * as legacy from "./jarvisAppRootLegacyImports";
import {
  buildCrossFeatureSuggestionsForEmail,
  buildCrossFeatureSuggestionsForState,
  pickProactiveCrossSuggestion,
} from "../features/shell/crossFeatureSuggestions";
import { skillAutopilotAvailable } from "../ui/shell/jarvisStaticCatalog";

export type JarvisRouterBridgeContext = {
${typeFields}
};

export function buildJarvisRouterBridgeState(
  ctx: JarvisRouterBridgeContext,
): CommandRouterDeps {
  return {
    ...(legacy as unknown as CommandRouterDeps),
    buildCrossFeatureSuggestionsForEmail,
    buildCrossFeatureSuggestionsForState,
    pickProactiveCrossSuggestion,
    skillAutopilotAvailable,
    ...ctx,
  };
}
`;

fs.writeFileSync("src/hooks/buildJarvisRouterBridgeState.ts", body);
console.log(`Regenerated bridge type with ${callKeys.length} keys.`);

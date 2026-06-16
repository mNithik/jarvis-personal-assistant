/**
 * Wave 11.4: extract legacy imports + router bridge state from useJarvisAppRoot.tsx
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hookPath = path.join(__dirname, "../src/hooks/useJarvisAppRoot.tsx");
const legacyImportsPath = path.join(__dirname, "../src/hooks/jarvisAppRootLegacyImports.ts");
const bridgeBuilderPath = path.join(__dirname, "../src/hooks/buildJarvisRouterBridgeState.ts");

let src = fs.readFileSync(hookPath, "utf8");

const legacyImportMatch = src.match(
  /import \{([\s\S]*?)\} from "\.\.\/features\/legacy\/appHelpers";/,
);
if (!legacyImportMatch) {
  throw new Error("Could not find appHelpers import block");
}
const legacyImportBody = legacyImportMatch[1].trim();

fs.writeFileSync(
  legacyImportsPath,
  `/** Wave 11 peel: legacy helpers consumed by the router bridge builder. */\nexport {\n${legacyImportBody}\n} from "../features/legacy/appHelpers";\n`,
);

const bridgeMatch = src.match(
  /const commandRouter = useJarvisShellRouterBridge\(\s*\{\s*state: \{([\s\S]*?)\},\s*setters: \{\},/,
);
if (!bridgeMatch) {
  throw new Error("Could not find router bridge state block");
}
const stateBody = bridgeMatch[1].trim();
const stateLines = stateBody.split("\n").map((line) => line.trim()).filter(Boolean);

const legacyNames = new Set(
  legacyImportBody
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("type ")) return null;
      const asMatch = part.match(/^\w+\s+as\s+(\w+)/);
      if (asMatch) return asMatch[1];
      return part.split(/\s+/)[0];
    })
    .filter(Boolean),
);

const ctxKeys = [];
const legacyKeys = [];
for (const line of stateLines) {
  const m = line.match(/^(\w+),?$/);
  if (!m) continue;
  const key = m[1];
  if (legacyNames.has(key)) {
    legacyKeys.push(key);
  } else {
    ctxKeys.push(key);
  }
}

const legacyImportList = legacyKeys.sort().join(",\n  ");
const ctxTypeFields = ctxKeys.map((key) => `  ${key}: CommandRouterDeps["${key}"];`).join("\n");

fs.writeFileSync(
  bridgeBuilderPath,
  `import type { CommandRouterDeps } from "../features/command/commandRouterDepTypes";
import {
  ${legacyImportList},
} from "./jarvisAppRootLegacyImports";

export type JarvisRouterBridgeContext = {
${ctxTypeFields}
};

/** Assemble command-router deps: legacy helpers plus live hook/runtime values. */
export function buildJarvisRouterBridgeState(
  ctx: JarvisRouterBridgeContext,
): CommandRouterDeps {
  return {
    ${legacyKeys.map((key) => `${key},`).join("\n    ")}
    ...ctx,
  };
}
`,
);

src = src.replace(legacyImportMatch[0], "");

if (!src.includes("buildJarvisRouterBridgeState")) {
  src = src.replace(
    /import \{ useJarvisShellRouterBridge \} from "\.\/useJarvisShellRouterBridge";/,
    `import { useJarvisShellRouterBridge } from "./useJarvisShellRouterBridge";
import { buildJarvisRouterBridgeState } from "./buildJarvisRouterBridgeState";`,
  );
}

src = src.replace(
  /const commandRouter = useJarvisShellRouterBridge\(\s*\{\s*state: \{[\s\S]*?\},\s*setters: \{\},/,
  "const commandRouter = useJarvisShellRouterBridge(\n    {\n      state: buildJarvisRouterBridgeState({",
);

src = src.replace(
  /(\s+workflowSuggestion,\s*\n)(\s*\}),\s*setters: \{\},/,
  "$1      }),\n      setters: {},",
);

// Restore types still needed in the root hook file
const typeImports = `import type {
  ActiveConversationContext,
  CommandIntent,
  ConversationBackendComparison,
  ConversationContextStackEntry,
  ConversationTopicRecord,
  ConversationTurn,
  CrossFeatureSuggestionRecord,
  DesktopPermissionSettings,
  DesktopProjectRecord,
  DesktopScheduleRecord,
  EmbeddingBackend,
  ExpenseMemoryRecord,
  JarvisPanelId,
  JarvisPanelRecord,
  MeetingPrepMemoryRecord,
  ModelRouterConfig,
  OcrWatchTarget,
  PackageMemoryRecord,
  PanelDragState,
  PersonMemoryRecord,
  PlannerTaskRecord,
  PresentedCollectionContext,
  RunCommandOutcome,
  SavedWorkflowRecord,
  SchoolPlanMemoryRecord,
  SemanticConversationMemoryRecord,
  SemanticIntentFeedbackRecord,
  ShellBarDragState,
  ShellBarPlacement,
  TravelMemoryRecord,
  UserPreferenceMemory,
  WorkflowSuggestionRecord,
} from "../features/command/jarvisCommandTypes";
import {
  DEFAULT_DESKTOP_PERMISSION_SETTINGS,
  defaultJarvisUiState,
  formatGatewayFollowUp,
  jarvisUiReducer,
  loadJarvisUiState,
} from "./jarvisAppRootLegacyImports";
`;

if (!src.includes("from \"./jarvisAppRootLegacyImports\"")) {
  src = src.replace(
    /import \{ useJarvisBuilderAutopilot \} from "\.\/useJarvisBuilderAutopilot";/,
    `import { useJarvisBuilderAutopilot } from "./useJarvisBuilderAutopilot";
${typeImports}`,
  );
}

fs.writeFileSync(hookPath, src);

console.log(
  `Extracted ${legacyKeys.length} legacy + ${ctxKeys.length} ctx router keys.`,
);

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "../src/App.tsx");
const content = fs.readFileSync(appPath, "utf8");
const lines = content.split(/\r?\n/);
const helperStart = 377;
const helperEnd = 11440;
let helperBody = lines.slice(helperStart, helperEnd).join("\n");

helperBody = helperBody
  .replace(/\nasync function /g, "\nexport async function ")
  .replace(/\nfunction /g, "\nexport function ")
  .replace(/\ntype /g, "\nexport type ")
  .replace(/\nconst /g, "\nexport const ");

const helpersOut = path.join(__dirname, "../src/features/legacy/appHelpers.ts");
fs.mkdirSync(path.dirname(helpersOut), { recursive: true });

const helpersHeader = `// Extracted from App.tsx (Wave H-0)\n\nimport {\n  BrowserAliasRecord,\n  LearnedIntentRecord,\n  VoiceCorrectionRecord,\n} from "../../types/jarvis";\nimport {\n  ConversationBackend,\n  SpeechOutputBackend,\n  VoiceBackend,\n} from "../../types/voice";\nimport type {\n  GatewayConfig,\n  GatewayPreview,\n  IntegrationHandoff,\n} from "../../services/jarvisApi";\n\n`;

fs.writeFileSync(helpersOut, helpersHeader + helperBody + "\n");

const importBlock = [
  'import * as AppHelpers from "./features/legacy/appHelpers";',
  "const {",
  "  formatGatewayPreview,",
  "  formatGatewayFollowUp,",
  "  isGatewayConfirmationYes,",
  "  isGatewayConfirmationNo,",
  "  shouldDelegateToGateway,",
  "  mapIntegrationHandoffToIntent,",
  "  parseExplicitCommandIntent,",
  "  cleanConversationalCommand,",
  "  parseCalendarCommandIntent,",
  "} = AppHelpers;",
  "export type CommandIntent = AppHelpers.CommandIntent;",
  "export type { AppHelpers };",
].join("\n");

// Simpler: re-export everything
const newImportBlock = [
  'export * from "./features/legacy/appHelpers";',
  'import * as AppHelpers from "./features/legacy/appHelpers";',
].join("\n");

const newAppLines = [
  ...lines.slice(0, helperStart),
  newImportBlock,
  ...lines.slice(helperEnd),
];

fs.writeFileSync(appPath, newAppLines.join("\n"));
console.log(`Extracted ${helperEnd - helperStart} lines to ${helpersOut}`);

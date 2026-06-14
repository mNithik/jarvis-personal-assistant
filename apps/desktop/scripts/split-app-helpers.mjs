import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "../src/features");
const helpersPath = path.join(src, "legacy/appHelpers.ts");
const lines = fs.readFileSync(helpersPath, "utf8").split(/\r?\n/);

const slice = (start, end) => lines.slice(start - 1, end).join("\n");

const typeImports = `import {
  BrowserAliasRecord,
  ConversationInterpretation,
  EmailRecord,
  FileRecord,
  LearnedIntentRecord,
  NoteRecord,
  SkillBuildRequest,
  VoiceCorrectionRecord,
} from "../../types/jarvis";
import { ConversationBackend, SpeechOutputBackend, VoiceBackend } from "../../types/voice";
import type { GatewayConfig, GatewayPreview, IntegrationHandoff } from "../../services/jarvisApi";
import type { GoogleCalendarEventRecord } from "../../services/googleCalendar";
import type { SpotifyPlaybackState } from "../../services/spotify";
`;

const typesBody = slice(71, 1139);

fs.writeFileSync(
  path.join(src, "command/jarvisCommandTypes.ts"),
  `${typeImports}\n${typesBody}\n`,
);

const gatewayBody = `${slice(26, 69)}\n\n${slice(1141, 1847)}`;
fs.writeFileSync(
  path.join(src, "gateway/gatewayBridge.ts"),
  `${typeImports}
import type { CommandIntent } from "../command/jarvisCommandTypes";
import { builtInBrowserAliases, canonicalHostRoots } from "../command/jarvisCommandTypes";
import { parseCalendarCommandIntent } from "../command/parsers/explicitIntent";
import { parseExplicitCommandIntent } from "../command/parsers/explicitIntent";
import { normalizeControlCommand } from "../semantic/intentRanking";

${gatewayBody}
`,
);

const desktopBody = `${slice(1849, 1893)}\n\n${slice(1895, 1955)}\n\n${slice(2327, 3133)}`;
fs.writeFileSync(
  path.join(src, "command/parsers/desktopIntent.ts"),
  `${typeImports}
import type { CommandIntent } from "../jarvisCommandTypes";
import { cleanConversationalCommand } from "./desktopIntentUtils";

${desktopBody}
`,
);

fs.writeFileSync(
  path.join(src, "command/parsers/desktopIntentUtils.ts"),
  `${slice(1849, 1893)}\n`,
);

const ocrBody = slice(1957, 2325);
fs.writeFileSync(
  path.join(src, "ocr/ocrText.ts"),
  `${typeImports}
import type {
  JarvisHomeAppId,
  JarvisPanelId,
  OcrCorrectionRecord,
  OcrHistoryFilter,
  OcrHistoryRecord,
  OcrRect,
  OcrRegion,
  OcrScope,
  OcrWatchAction,
  OcrWatchRule,
  ShellBarPlacement,
} from "../command/jarvisCommandTypes";

${ocrBody}
`,
);

const semanticBody = slice(3135, 8324);
fs.writeFileSync(
  path.join(src, "semantic/intentRanking.ts"),
  `${typeImports}
import type {
  ActiveConversationContext,
  ClarificationChoice,
  CommandIntent,
  ConversationContextStackEntry,
  CorrectionInstruction,
  EmbeddingBackend,
  IntentConfidence,
  NaturalConversationResolution,
  PendingClarification,
  PresentedCollectionContext,
  SemanticConversationMemoryRecord,
  SemanticIntentCandidate,
  SemanticIntentDebugMatch,
  SemanticIntentFeedbackRecord,
  SemanticIntentRank,
  TeachingInstruction,
  TrainingModeSession,
  TransformersEmbeddingExtractor,
  UserPreferenceMemory,
} from "../command/jarvisCommandTypes";
import { builtInBrowserAliases } from "../command/jarvisCommandTypes";
import { cleanConversationalCommand } from "../command/parsers/desktopIntentUtils";
import { parseDesktopControlIntent } from "../command/parsers/desktopIntent";
import { parseCalendarCommandIntent, parseExplicitCommandIntent } from "../command/parsers/explicitIntent";

${semanticBody}
`,
);

const explicitBody = slice(8325, lines.length);
fs.writeFileSync(
  path.join(src, "command/parsers/explicitIntent.ts"),
  `${typeImports}
import type { CommandIntent } from "../jarvisCommandTypes";
import { builtInBrowserAliases, canonicalHostRoots } from "../jarvisCommandTypes";
import { isStudyAppsCommand } from "../../gateway/gatewayBridge";
import { parseDesktopControlIntent } from "./desktopIntent";
import { cleanConversationalCommand } from "./desktopIntentUtils";
import {
  normalizeControlCommand,
  resolveLearnedIntent,
  resolveNaturalConversationFollowUp,
} from "../../semantic/intentRanking";

${explicitBody}
`,
);

// Fix desktopIntent - remove duplicate cleanConversational, import from utils
let desktop = fs.readFileSync(path.join(src, "command/parsers/desktopIntent.ts"), "utf8");
const desktopOnly = `${slice(1895, 1955)}\n\n${slice(2327, 3133)}`;
fs.writeFileSync(
  path.join(src, "command/parsers/desktopIntent.ts"),
  `${typeImports}
import type { CommandIntent } from "../jarvisCommandTypes";
import { cleanConversationalCommand } from "./desktopIntentUtils";

${desktopOnly}
`,
);

fs.writeFileSync(
  path.join(src, "legacy/appHelpers.ts"),
  `// Barrel re-exports (Wave H+-1)
export * from "../command/jarvisCommandTypes";
export * from "../gateway/gatewayBridge";
export * from "../command/parsers/desktopIntentUtils";
export * from "../command/parsers/desktopIntent";
export * from "../command/parsers/explicitIntent";
export * from "../ocr/ocrText";
export * from "../semantic/intentRanking";
`,
);

console.log("Split appHelpers into domain modules");

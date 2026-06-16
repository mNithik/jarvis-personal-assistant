import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, "..");

function sliceHandler(srcRel, startLine, endLine, header) {
  const lines = fs.readFileSync(path.join(desktopRoot, srcRel), "utf8").split(/\r?\n/);
  let body = lines.slice(startLine - 1, endLine).join("\n");
  body = body.replace(/^\s*\} else if \(intent\.kind === "read_current_note"\)/, '  if (intent.kind === "read_current_note")');
  fs.writeFileSync(path.join(desktopRoot, srcRel), `${header}\n${body}\n`);
}

sliceHandler(
  "src/features/command/executeIntent/notion.ts",
  113,
  779,
  `import * as J from "../../legacy/appHelpers";
import type { PlannerTaskRecord } from "../jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import { createNotionTask, openBrowserUrl, updateNotionTask } from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";

/** Gateway-owned note CRUD/list intents stripped in Wave R2; task workflows remain. */
export async function handleNotionIntent(
  deps: ResolvedCommandRouterDeps,
  intent: import("../jarvisCommandTypes").CommandIntent,
  executeIntent: ExecuteIntentFn,
): Promise<ExecuteIntentResult> {`,
);

sliceHandler(
  "src/features/command/handlers/emailNotionHandlers.ts",
  190,
  1048,
  `import * as J from "../../legacy/appHelpers";
import type { CommandRouterDeps } from "../commandRouterDepTypes";
import type { CommandIntent } from "../jarvisCommandTypes";
import { createGoogleCalendarEvent } from "../../../services/googleCalendar";
import { createNotionNote, openBrowserUrl } from "../../../services/jarvisApi";

type ResolvedCommandRouterDeps = Required<CommandRouterDeps>;

/** Gateway-owned email→Notion save intents stripped in Wave R2; read/extract/calendar remain. */
export async function handleEmailNotionIntent(
  deps: ResolvedCommandRouterDeps,
  intent: CommandIntent,
): Promise<boolean> {`,
);

console.log("Stripped notion.ts and emailNotionHandlers.ts");

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "../src/App.tsx");
const outPath = path.join(__dirname, "../src/features/command/createJarvisCommandRouter.ts");
const app = fs.readFileSync(appPath, "utf8");
const lines = app.split(/\r?\n/);

const routeBlock = lines.slice(5969, 5981).join("\n");
const executeBlock = lines.slice(6066, 11022).join("\n");
const runBlock = lines.slice(11023, 12389).join("\n");

const body = `${routeBlock}\n\n${executeBlock}\n\n${runBlock}`;

const importHeader = `/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormEvent } from "react";
import type { RunCommandOutcome } from "../legacy/appHelpers";
import type { JarvisCommandRouter } from "../../ui/context/JarvisAppContext";

/** Runtime bindings supplied by App — intentionally open for peel migration. */
export type CommandRouterDeps = Record<string, any>;

export function createJarvisCommandRouter(deps: CommandRouterDeps): JarvisCommandRouter {
`;

// Rewrite body: inject scope. prefix for deps keys - use eval in generated code instead
// Simpler: use with-like pattern via Function constructor assigning from deps object keys to local vars
// Simplest working approach: duplicate bodies inside impl that reference `deps.x` via regex on known symbols

const symbols = new Set();
const stateRe = /const \[(\w+), (set\w+)\]/g;
const fnRe = /(?:async )?function (\w+)\(/g;
const refRe = /const (\w+Ref) = useRef/g;

let m;
const appHead = lines.slice(0, 6066).join("\n");
while ((m = stateRe.exec(appHead))) {
  symbols.add(m[1]);
  symbols.add(m[2]);
}
while ((m = refRe.exec(appHead))) {
  symbols.add(m[1]);
}
while ((m = fnRe.exec(appHead))) {
  symbols.add(m[1]);
}

const reserved = new Set([
  "routeCommand",
  "routeCommandFromVoice",
  "executeIntent",
  "runCommand",
]);

// Sort longest first to avoid partial replacements
const sorted = [...symbols]
  .filter((sym) => !reserved.has(sym))
  .sort((a, b) => b.length - a.length);

let rewritten = body;
for (const sym of sorted) {
  const re = new RegExp(`(?<![.\\w])${sym}(?![\\w])`, "g");
  rewritten = rewritten.replace(re, `deps.${sym}`);
}

// Fix double deps.deps and deps.deps.setX
rewritten = rewritten.replace(/deps\.deps\./g, "deps.");

const footer = `
  return {
    routeCommand,
    routeCommandFromVoice,
    executeIntent,
    runCommand,
  };
}
`;

const output = `${importHeader}${rewritten}${footer}`;

fs.writeFileSync(outPath, output);
console.log(`Wrote ${outPath} (${sorted.length} scoped symbols)`);

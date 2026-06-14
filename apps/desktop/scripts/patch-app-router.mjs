import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "../src/App.tsx");
const snippetPath = path.join(__dirname, "../src/features/command/commandRouterDeps.snippet.ts");
let lines = fs.readFileSync(appPath, "utf8").split(/\r?\n/);

// Remove routeCommand, routeCommandFromVoice (5970-5981), executeIntent (6067-11022), runCommand (11024-12389)
// Line numbers are 1-based; after first removal, indices shift.

function removeRange(start, end) {
  lines.splice(start - 1, end - start + 1);
}

// Find fresh indices
const routeStart = lines.findIndex((l) => l.includes("async function routeCommand(event:"));
const routeEnd = lines.findIndex((l, i) => i > routeStart && l.includes("async function routeCommandFromVoice"));
const routeEnd2 = lines.findIndex((l, i) => i > routeEnd && l.trim() === "}");

// Simpler: use known patterns after first extraction
let idx = lines.findIndex((l) => /^  async function routeCommand\(event/.test(l));
if (idx === -1) throw new Error("routeCommand not found");
let endIdx = lines.findIndex((l, i) => i > idx && /^  function triggerVoiceAutoRoute/.test(l));
if (endIdx === -1) throw new Error("triggerVoiceAutoRoute not found");
lines.splice(idx, endIdx - idx);

idx = lines.findIndex((l) => /^  async function executeIntent\(intent/.test(l));
if (idx === -1) throw new Error("executeIntent not found");
endIdx = lines.findIndex((l, i) => i > idx && /^  async function runCommand\(/.test(l));
if (endIdx === -1) throw new Error("runCommand not found");
lines.splice(idx, endIdx - idx);

idx = lines.findIndex((l) => /^  async function runCommand\(/.test(l));
if (idx === -1) throw new Error("runCommand not found");
endIdx = lines.findIndex((l, i) => i > idx && /^  const selectionRect = ocrSelection/.test(l));
if (endIdx === -1) throw new Error("selectionRect not found");
lines.splice(idx, endIdx - idx);

const snippet = fs.readFileSync(snippetPath, "utf8");

// Add imports after JarvisAppProvider import
const importLine = 'import { useJarvisCommandRouter } from "./hooks/useJarvisCommandRouter";';
const depsTypeLine =
  'import type { CommandRouterDeps } from "./features/command/createJarvisCommandRouter";';
const providerIdx = lines.findIndex((l) => l.includes('from "./ui/context/JarvisAppContext"'));
if (!lines.some((l) => l.includes("useJarvisCommandRouter"))) {
  lines.splice(providerIdx + 1, 0, importLine, depsTypeLine);
}

// Insert router wiring before workspaceSectionCtx
const ctxIdx = lines.findIndex((l) => l.includes("const workspaceSectionCtx:"));
if (ctxIdx === -1) throw new Error("workspaceSectionCtx not found");
if (!lines.some((l) => l.includes("commandRouterDepsRef"))) {
  lines.splice(ctxIdx, 0, snippet, "");
}

// Replace inline commandRouter object
const ctxValueIdx = lines.findIndex((l) => l.includes("commandRouter: {"));
if (ctxValueIdx !== -1) {
  let closeIdx = ctxValueIdx;
  while (closeIdx < lines.length && !lines[closeIdx].includes("runCommand,")) {
    closeIdx++;
  }
  lines.splice(ctxValueIdx, closeIdx - ctxValueIdx + 2, "    commandRouter,");
}

fs.writeFileSync(appPath, lines.join("\n"));
console.log("Patched App.tsx for command router extraction");

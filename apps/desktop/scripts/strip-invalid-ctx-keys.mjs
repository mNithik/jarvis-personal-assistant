import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "../src/App.tsx");
const lines = fs.readFileSync(appPath, "utf8").split(/\r?\n/);

const appStart = lines.findIndex((line) => line.includes("function App()"));
const ctxStart = lines.findIndex((line) => line.includes("const workspaceSectionCtx"));
const validScope = new Set();
for (let i = appStart; i < ctxStart; i++) {
  const line = lines[i];
  for (const match of line.matchAll(/\bconst\s+\[?([A-Za-z_]\w*)/g)) {
    validScope.add(match[1]);
  }
  for (const match of line.matchAll(/\bfunction\s+([A-Za-z_]\w*)\s*\(/g)) {
    validScope.add(match[1]);
  }
  for (const match of line.matchAll(/\basync\s+function\s+([A-Za-z_]\w*)\s*\(/g)) {
    validScope.add(match[1]);
  }
}

const invalid = [
  "command",
  "email",
  "entry",
  "file",
  "index",
  "intent",
  "key",
  "label",
  "match",
  "note",
  "project",
  "providerId",
  "record",
  "result",
  "schedule",
  "suggestion",
  "task",
  "usage",
  "workflow",
];

let app = lines.join("\n");
for (const key of invalid) {
  app = app.replace(new RegExp(`    ${key},\\n`, "g"), "");
}

fs.writeFileSync(appPath, app);
console.log("Removed invalid keys from workspaceSectionCtx");

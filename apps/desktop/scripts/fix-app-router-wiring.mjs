import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "../src/App.tsx");
const snippetPath = path.join(__dirname, "../src/features/command/commandRouterDeps.snippet.ts");
let lines = fs.readFileSync(appPath, "utf8").split(/\r?\n/);
const snippet = fs.readFileSync(snippetPath, "utf8").split(/\r?\n/);

const start = lines.findIndex((l) => l.includes("const commandRouterDepsRef"));
const end = lines.findIndex((l, i) => i > start && l.includes("const commandRouter = useJarvisCommandRouter"));
if (start === -1 || end === -1) throw new Error("router block not found");

lines.splice(start, end - start + 1, ...snippet);

// Remove router fns from workspaceSectionCtx
lines = lines.filter(
  (l) =>
    !/^\s+executeIntent,$/.test(l) &&
    !/^\s+routeCommand,$/.test(l) &&
    !/^\s+runCommand,$/.test(l),
);

// Move desktopSchedules useEffect after router destructure
const effectStart = lines.findIndex((l) => l.includes("useEffect(() => {") && lines[l.indexOf ? 0 : 0]);
let schedStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("useEffect(() => {") && lines[i + 1]?.includes("const timers = desktopSchedules")) {
    schedStart = i;
    break;
  }
}
if (schedStart !== -1) {
  let schedEnd = schedStart;
  while (schedEnd < lines.length && !lines[schedEnd].includes("}, [desktopSchedules]);")) {
    schedEnd++;
  }
  schedEnd++;
  const effectBlock = lines.splice(schedStart, schedEnd - schedStart);
  const insertAt = lines.findIndex((l) =>
    l.includes("const { routeCommand, routeCommandFromVoice, executeIntent, runCommand }"),
  );
  if (insertAt !== -1) {
    lines.splice(insertAt + 1, 0, "", ...effectBlock);
  }
}

fs.writeFileSync(appPath, lines.join("\n"));
console.log("Fixed App router wiring");

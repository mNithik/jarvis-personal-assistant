import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "../src/App.tsx");
const lines = fs.readFileSync(appPath, "utf8").split(/\r?\n/);
const appHead = lines.slice(0, 6066).join("\n");

const symbols = new Set();
const stateRe = /const \[(\w+), (set\w+)\]/g;
const fnRe = /(?:async )?function (\w+)\(/g;
const refRe = /const (\w+Ref) = useRef/g;
let m;
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
  "App",
]);
const sorted = [...symbols].filter((s) => !reserved.has(s)).sort();

const assignBody = sorted.map((s) => `    ${s},`).join("\n");

const hook = `import { useMemo, useRef } from "react";
import {
  createJarvisCommandRouter,
  type CommandRouterDeps,
} from "../features/command/createJarvisCommandRouter";
import type { JarvisCommandRouter } from "../ui/context/JarvisAppContext";

export function useJarvisCommandRouter(deps: CommandRouterDeps): JarvisCommandRouter {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  return useMemo(() => createJarvisCommandRouter(depsRef.current), []);
}
`;

fs.writeFileSync(path.join(__dirname, "../src/hooks/useJarvisCommandRouter.ts"), hook);

const snippet = `  const commandRouterDepsRef = useRef<CommandRouterDeps>({});
  Object.assign(commandRouterDepsRef.current, {
${assignBody}
  });
  const commandRouter = useJarvisCommandRouter(commandRouterDepsRef.current);
  const { routeCommand, routeCommandFromVoice, executeIntent, runCommand } = commandRouter;`;

fs.writeFileSync(path.join(__dirname, "commandRouterDeps.snippet.ts"), snippet);
console.log(`Generated ${sorted.length} deps keys`);

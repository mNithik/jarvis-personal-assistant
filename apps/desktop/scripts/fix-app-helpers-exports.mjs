import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const helpersPath = path.join(__dirname, "../src/features/legacy/appHelpers.ts");
const appPath = path.join(__dirname, "../src/App.tsx");

let body = fs.readFileSync(helpersPath, "utf8");
body = body
  .replace(/^function /gm, "export function ")
  .replace(/^async function /gm, "export async function ")
  .replace(/^type /gm, "export type ")
  .replace(/^const /gm, "export const ");
fs.writeFileSync(helpersPath, body);

const fnNames = [...body.matchAll(/^export (?:async )?function (\w+)/gm)].map((m) => m[1]);
const typeNames = [...body.matchAll(/^export type (\w+)/gm)].map((m) => m[1]);
const constNames = [...body.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);

const valueImports = [...new Set([...fnNames, ...constNames])].sort();
const typeImports = [...new Set(typeNames)].sort();

const importLines = [
  `import {`,
  ...valueImports.map((n) => `  ${n},`),
  ...typeImports.map((n) => `  type ${n},`),
  `} from "./features/legacy/appHelpers";`,
  `export * from "./features/legacy/appHelpers";`,
  "",
].join("\n");

let app = fs.readFileSync(appPath, "utf8");
app = app.replace(
  /export \* from "\.\/features\/legacy\/appHelpers";\r?\nimport \* as AppHelpers from "\.\/features\/legacy\/appHelpers";\r?\n/,
  importLines,
);
fs.writeFileSync(appPath, app);
console.log(`Fixed exports. App imports ${valueImports.length} values and ${typeImports.length} types.`);

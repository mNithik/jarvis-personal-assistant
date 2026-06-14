import fs from "fs";

const files = [
  "src/features/command/jarvisCommandTypes.ts",
  "src/features/gateway/gatewayBridge.ts",
  "src/features/command/parsers/desktopIntentUtils.ts",
  "src/features/command/parsers/desktopIntent.ts",
  "src/features/command/parsers/explicitIntent.ts",
  "src/features/ocr/ocrText.ts",
  "src/features/semantic/intentRanking.ts",
];

const exports = new Set();
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  for (const match of src.matchAll(/^export (?:async )?function ([A-Za-z0-9_]+)/gm)) {
    exports.add(match[1]);
  }
  for (const match of src.matchAll(/^export const ([A-Za-z0-9_]+)/gm)) {
    exports.add(match[1]);
  }
  for (const match of src.matchAll(/^export type ([A-Za-z0-9_]+)/gm)) {
    exports.add(match[1]);
  }
}

const routerPath = "src/features/command/createJarvisCommandRouter.ts";
let source = fs.readFileSync(routerPath, "utf8");
const sorted = [...exports].sort((left, right) => right.length - left.length);
let count = 0;
for (const name of sorted) {
  const pattern = new RegExp(`J\\.${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
  const next = source.replace(pattern, name);
  if (next !== source) {
    count += 1;
    source = next;
  }
}

const destructuring = [...exports].sort().join(",\n  ");
const injection = `  const {\n  ${destructuring},\n  } = J;\n`;
if (!source.includes("} = J;")) {
  source = source.replace(
    "  const deps = depsInput as ResolvedCommandRouterDeps;\n",
    `  const deps = depsInput as ResolvedCommandRouterDeps;\n${injection}`,
  );
}

fs.writeFileSync(routerPath, source);
console.log(`Unprefixed ${count} symbols and injected destructuring in ${routerPath}`);

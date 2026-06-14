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
}

const routerPath = "src/features/command/createJarvisCommandRouter.ts";
let source = fs.readFileSync(routerPath, "utf8");

if (!source.includes('import * as J from "../legacy/appHelpers"')) {
  source = source.replace(
    'export * from "../legacy/appHelpers";',
    'import * as J from "../legacy/appHelpers";\nexport * from "../legacy/appHelpers";',
  );
}

const sorted = [...exports].sort((left, right) => right.length - left.length);
let prefixed = 0;
for (const name of sorted) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![.$/\\w])${escaped}(?![.$\\w])`, "g");
  const next = source.replace(pattern, `J.${name}`);
  if (next !== source) {
    prefixed += 1;
    source = next;
  }
}

fs.writeFileSync(routerPath, source);
console.log(`Prefixed ${prefixed} export symbols in ${routerPath}`);

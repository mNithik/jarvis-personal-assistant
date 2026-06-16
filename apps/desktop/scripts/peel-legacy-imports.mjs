import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logicPath = path.join(__dirname, "../src/ui/shell/JarvisAppRoot.logic.tsx");
let content = fs.readFileSync(logicPath, "utf8");

const importMatch = content.match(/import \{[\s\S]*?\} from "\.\.\/\.\.\/features\/legacy\/appHelpers";/);
if (!importMatch) {
  console.error("import block not found");
  process.exit(1);
}

const importBody = importMatch[0];
const names = [...importBody.matchAll(/(?:^|\s)(?:type\s+)?([A-Za-z_][A-Za-z0-9_]*)/gm)]
  .map((m) => m[1])
  .filter((n) => n !== "import" && n !== "type" && n !== "from");

const unique = [...new Set(names)].sort((a, b) => b.length - a.length);

content = content.replace(
  importMatch[0],
  'import * as J from "./jarvisAppRootLegacyImports";',
);

for (const name of unique) {
  const re = new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`, "g");
  content = content.replace(re, `J.${name}`);
}

content = content.replace(/J\.J\./g, "J.");

fs.writeFileSync(logicPath, content);
console.log(`Replaced ${unique.length} legacy symbols with J. namespace`);

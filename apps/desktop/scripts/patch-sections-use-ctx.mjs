import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../src/ui/workspaces/sections");

for (const file of fs.readdirSync(outDir)) {
  if (!file.endsWith("Sections.tsx")) {
    continue;
  }
  const fullPath = path.join(outDir, file);
  let content = fs.readFileSync(fullPath, "utf8");
  const fnMatch = content.match(/export function (build\w+)\(ctx: JarvisSectionContext\): ReactNode\[\] \{\s*const \{[\s\S]*?\} = ctx;\s*return \[/);
  if (!fnMatch) {
    continue;
  }
  const fnName = fnMatch[1];
  const returnStart = content.indexOf("return [");
  const returnEnd = content.lastIndexOf("];");
  const arrayBody = content.slice(returnStart + "return [".length, returnEnd);
  const newContent = `import { ReactNode } from "react";
import { JarvisSectionContext } from "./sectionContext";

export function ${fnName}(ctx: JarvisSectionContext): ReactNode[] {
  const $ = ctx as Record<string, unknown>;
  return [${arrayBody}];
}
`;
  fs.writeFileSync(fullPath, newContent);
  console.log("Patched", file);
}

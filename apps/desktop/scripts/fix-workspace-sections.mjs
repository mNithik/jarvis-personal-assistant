import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../src/ui/workspaces/sections");
const appPath = path.join(__dirname, "../src/App.tsx");

const skip = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "className",
  "key",
  "type",
  "button",
  "section",
  "article",
  "div",
  "span",
  "input",
  "form",
  "label",
  "h2",
  "h3",
  "h4",
  "p",
  "option",
  "select",
  "textarea",
  "Number",
  "String",
  "Boolean",
  "Date",
  "JSON",
  "Math",
  "Intl",
  "Array",
  "Object",
  "Promise",
]);

const allIds = new Set();
for (const file of fs.readdirSync(outDir)) {
  if (!file.endsWith("Sections.tsx")) {
    continue;
  }
  const body = fs.readFileSync(path.join(outDir, file), "utf8");
  for (const match of body.matchAll(/\b([A-Za-z_][\w]*)\b/g)) {
    const id = match[1];
    if (!skip.has(id) && id[0] === id[0].toLowerCase()) {
      allIds.add(id);
    }
  }
}

const ids = [...allIds].sort();
console.log("Identifiers:", ids.length);

for (const file of fs.readdirSync(outDir)) {
  if (!file.endsWith("Sections.tsx")) {
    continue;
  }
  const fullPath = path.join(outDir, file);
  let content = fs.readFileSync(fullPath, "utf8");
  const fn = content.match(/export function (build\w+)/)?.[1];
  const start = content.indexOf("return [");
  const end = content.lastIndexOf("];");
  const arrayBody = content.slice(start + "return [".length, end);

  const newContent = `// @ts-nocheck
import { ReactNode } from "react";
import { JarvisSectionContext } from "./sectionContext";

export function ${fn}(ctx: JarvisSectionContext): ReactNode[] {
  return (function sectionScope() {
    const scope = ctx as Record<string, unknown>;
${ids.map((id) => `    const ${id} = scope["${id}"];`).join("\n")}
    return [${arrayBody}];
  })();
}
`;
  fs.writeFileSync(fullPath, newContent);
}

const ctxLiteral = `  const workspaceSectionCtx: JarvisSectionContext = {\n${ids.map((id) => `    ${id},`).join("\n")}\n  };\n\n`;
const sectionCalls = [
  "commandWorkspaceSections",
  "visionWorkspaceSections",
  "memoryWorkspaceSections",
  "workspacesWorkspaceSections",
  "connectionsWorkspaceSections",
  "builderWorkspaceSections",
  "modelsWorkspaceSections",
  "automationWorkspaceSections",
]
  .map(
    (name) =>
      `  const ${name} = build${name.charAt(0).toUpperCase() + name.slice(1).replace("WorkspaceSections", "WorkspaceSections")}(`,
  )
  .join("\n");

const builders = {
  commandWorkspaceSections: "buildCommandWorkspaceSections",
  visionWorkspaceSections: "buildVisionWorkspaceSections",
  memoryWorkspaceSections: "buildMemoryWorkspaceSections",
  workspacesWorkspaceSections: "buildWorkspacesWorkspaceSections",
  connectionsWorkspaceSections: "buildConnectionsWorkspaceSections",
  builderWorkspaceSections: "buildBuilderWorkspaceSections",
  modelsWorkspaceSections: "buildModelsWorkspaceSections",
  automationWorkspaceSections: "buildAutomationWorkspaceSections",
};

let app = fs.readFileSync(appPath, "utf8");
app = app.replace(
  /  const commandWorkspaceSections = buildCommandWorkspaceSections\(\{[\s\S]*?\}\);\n\n  const systemDrawerContent/,
  `${ctxLiteral}${Object.entries(builders)
    .map(([varName, fn]) => `  const ${varName} = ${fn}(workspaceSectionCtx);`)
    .join("\n")}\n\n  const systemDrawerContent`,
);

fs.writeFileSync(appPath, app);
console.log("Patched App.tsx with workspaceSectionCtx");

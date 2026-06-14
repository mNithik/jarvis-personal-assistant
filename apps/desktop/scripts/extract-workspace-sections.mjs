import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "../src/App.tsx");
const lines = fs.readFileSync(appPath, "utf8").split(/\r?\n/);
const appText = lines.join("\n");

const appIds = new Set();
for (const match of appText.matchAll(/\bconst\s+\[?([A-Za-z_]\w*)/g)) {
  appIds.add(match[1]);
}
for (const match of appText.matchAll(/\bfunction\s+([A-Za-z_]\w*)\s*\(/g)) {
  appIds.add(match[1]);
}
for (const match of appText.matchAll(/\basync\s+function\s+([A-Za-z_]\w*)\s*\(/g)) {
  appIds.add(match[1]);
}

const sections = [
  { file: "CommandSections", var: "commandWorkspaceSections", startLine: 12851, endLine: 13272 },
  { file: "VisionSections", var: "visionWorkspaceSections", startLine: 13273, endLine: 13339 },
  { file: "MemorySections", var: "memoryWorkspaceSections", startLine: 13340, endLine: 13350 },
  { file: "WorkspacesSections", var: "workspacesWorkspaceSections", startLine: 13351, endLine: 13408 },
  { file: "ConnectionsSections", var: "connectionsWorkspaceSections", startLine: 13409, endLine: 13640 },
  { file: "BuilderSections", var: "builderWorkspaceSections", startLine: 13641, endLine: 13661 },
  { file: "ModelsSections", var: "modelsWorkspaceSections", startLine: 13662, endLine: 13777 },
  { file: "AutomationSections", var: "automationWorkspaceSections", startLine: 13778, endLine: 13812 },
];

function detectDeps(jsxLines) {
  const text = jsxLines.join("\n");
  const deps = new Set();
  for (const match of text.matchAll(/\{([A-Za-z_][\w]*)\b/g)) {
    if (appIds.has(match[1])) {
      deps.add(match[1]);
    }
  }
  for (const match of text.matchAll(/\bonClick=\{?\s*\(?\s*\)?\s*=>?\s*(?:void\s+)?([A-Za-z_]\w*)\(/g)) {
    if (appIds.has(match[1])) {
      deps.add(match[1]);
    }
  }
  for (const match of text.matchAll(/\bonChange=\{?\s*\(([^)]*)\)\s*=>\s*([A-Za-z_]\w*)\(/g)) {
    if (appIds.has(match[2])) {
      deps.add(match[2]);
    }
  }
  for (const match of text.matchAll(/\b([A-Za-z_]\w*)\(/g)) {
    if (appIds.has(match[1])) {
      deps.add(match[1]);
    }
  }
  return [...deps].sort();
}

const outDir = path.join(__dirname, "../src/ui/workspaces/sections");
fs.mkdirSync(outDir, { recursive: true });

const allDeps = new Set();
const replacements = [];

for (const section of sections) {
  const block = lines.slice(section.startLine - 1, section.endLine).join("\n");
  const arrayMatch = block.match(/const \w+: ReactNode\[\] = \[([\s\S]*)\];/);
  if (!arrayMatch) {
    throw new Error(`Could not parse ${section.var} at ${section.startLine}`);
  }
  const arrayBody = arrayMatch[1];
  const deps = detectDeps(arrayBody.split("\n"));
  deps.forEach((dep) => allDeps.add(dep));
  const fnName = `build${section.file.replace("Sections", "WorkspaceSections")}`;

  const fileContent = `/** @ts-nocheck */\nimport { ReactNode } from "react";\nimport { JarvisSectionContext } from "./sectionContext";\n\nexport function ${fnName}(ctx: JarvisSectionContext): ReactNode[] {\n  const {\n    ${deps.join(",\n    ")}\n  } = ctx;\n  return [${arrayBody}];\n}\n`;
  fs.writeFileSync(path.join(outDir, `${section.file}.tsx`), fileContent);
  replacements.push({ var: section.var, fn: fnName });
}

fs.writeFileSync(
  path.join(outDir, "sectionContext.ts"),
  `export type JarvisSectionContext = Record<string, unknown>;\n`,
);

let app = appText;
for (const { var: varName, fn } of replacements) {
  const pattern = new RegExp(`  const ${varName}: ReactNode\\[\\] = \\[[\\s\\S]*?\\n  \\];`);
  app = app.replace(pattern, `  const ${varName} = ${fn}(workspaceSectionCtx);`);
}

const importAnchor = 'import { JarvisWorkspaceId } from "./ui/model/jarvisTypes";';
const sectionImports = replacements
  .map(({ fn, var: varName }) => {
    const file = sections.find((s) => s.var === varName).file;
    return `import { ${fn} } from "./ui/workspaces/sections/${file}";`;
  })
  .join("\n");

if (!app.includes("JarvisSectionContext")) {
  app = app.replace(
    importAnchor,
    `${importAnchor}\nimport { JarvisSectionContext } from "./ui/workspaces/sections/sectionContext";\n${sectionImports}`,
  );
}

const ctxBlock = `  const workspaceSectionCtx: JarvisSectionContext = {\n    ${[...allDeps].sort().join(",\n    ")},\n  };\n\n`;
app = app.replace(
  /(  const gatewayFollowUp = formatGatewayFollowUp\(visibleGatewayPreview\);\n\n)/,
  `$1${ctxBlock}`,
);

fs.writeFileSync(appPath, app);
console.log(`Extracted ${sections.length} sections with ${allDeps.size} shared context keys`);

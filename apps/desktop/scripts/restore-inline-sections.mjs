import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "../src/App.tsx");
const sectionsDir = path.join(__dirname, "../src/ui/workspaces/sections");

const mapping = [
  ["CommandSections.tsx", "commandWorkspaceSections"],
  ["VisionSections.tsx", "visionWorkspaceSections"],
  ["MemorySections.tsx", "memoryWorkspaceSections"],
  ["WorkspacesSections.tsx", "workspacesWorkspaceSections"],
  ["ConnectionsSections.tsx", "connectionsWorkspaceSections"],
  ["BuilderSections.tsx", "builderWorkspaceSections"],
  ["ModelsSections.tsx", "modelsWorkspaceSections"],
  ["AutomationSections.tsx", "automationWorkspaceSections"],
];

function extractArrayBody(fileName) {
  const content = fs.readFileSync(path.join(sectionsDir, fileName), "utf8");
  const marker = "return [";
  const start = content.lastIndexOf(marker);
  if (start < 0) {
    throw new Error(`No return array in ${fileName}`);
  }
  const end = content.lastIndexOf("];");
  return content.slice(start + marker.length, end);
}

let app = fs.readFileSync(appPath, "utf8");

app = app.replace(
  /import \{ build\w+WorkspaceSections \} from "\.\/ui\/workspaces\/sections\/\w+";\n/g,
  "",
);
app = app.replace(
  /  const workspaceSectionCtx: JarvisSectionContext = \{[\s\S]*?\};\n\n/g,
  "",
);

for (const [file, varName] of mapping) {
  const body = extractArrayBody(file);
  const replacement = `  const ${varName}: ReactNode[] = [${body}];`;
  app = app.replace(
    new RegExp(`  const ${varName} = build\\w+\\(workspaceSectionCtx\\);`),
    replacement,
  );
}

fs.writeFileSync(appPath, app);
console.log("Restored inline workspace sections in App.tsx");

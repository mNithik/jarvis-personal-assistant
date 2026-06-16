import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hookPath = path.join(__dirname, "../src/hooks/useJarvisAppRoot.tsx");
let src = fs.readFileSync(hookPath, "utf8");

const replacements = [
  ['from "../../services/', 'from "../services/'],
  ['from "../../types/', 'from "../types/'],
  ['from "../../features/', 'from "../features/'],
  ['from "../../hooks/', 'from "./'],
  ['from "../shell/', 'from "../ui/shell/'],
  ['from "./jarvisModules', 'from "../ui/shell/jarvisModules'],
  ['from "../context/', 'from "../ui/context/'],
  ['from "../cockpit/', 'from "../ui/cockpit/'],
  ['from "../floating/', 'from "../ui/floating/'],
  ['from "../settings/', 'from "../ui/settings/'],
  ['from "../workspaces/', 'from "../ui/workspaces/'],
  ['from "../model/', 'from "../ui/model/'],
];

for (const [from, to] of replacements) {
  src = src.split(from).join(to);
}

fs.writeFileSync(hookPath, src);
console.log("Fixed useJarvisAppRoot import paths");

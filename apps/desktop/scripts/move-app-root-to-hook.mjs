import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, "..");
const logicPath = path.join(desktopRoot, "src/ui/shell/JarvisAppRoot.logic.tsx");
const hookPath = path.join(desktopRoot, "src/hooks/useJarvisAppRoot.ts");

let content = fs.readFileSync(logicPath, "utf8");
if (!content.includes("export default function JarvisAppRootLogic()")) {
  throw new Error("JarvisAppRoot.logic.tsx is not in expected monolith form");
}

content = content.replace(
  "export default function JarvisAppRootLogic()",
  "export function useJarvisAppRoot(): ReactNode",
);

fs.writeFileSync(hookPath, content);

const thinLogic = `import { useJarvisAppRoot } from "../../hooks/useJarvisAppRoot";

/** Wave D: shell orchestration lives in useJarvisAppRoot; this file stays a thin entry. */
export default function JarvisAppRootLogic() {
  return useJarvisAppRoot();
}
`;

fs.writeFileSync(logicPath, thinLogic);
console.log(`Moved JarvisAppRoot.logic.tsx -> useJarvisAppRoot.ts (${content.split(/\r?\n/).length} lines)`);

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "../src/App.tsx");
const rootPath = path.join(__dirname, "../src/ui/shell/JarvisAppRoot.tsx");
const app = fs.readFileSync(appPath, "utf8");

let root = app.replace(/^function App\(\)/m, "export default function JarvisAppRoot()");
root = root.replace(/\nexport default App;\n?$/, "\n");

fs.writeFileSync(rootPath, root);

const thinApp = `import JarvisAppRoot from "./ui/shell/JarvisAppRoot";

export * from "./features/legacy/appHelpers";

export default function App() {
  return <JarvisAppRoot />;
}
`;

fs.writeFileSync(appPath, thinApp);
console.log("Created JarvisAppRoot.tsx and thinned App.tsx");

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "../src/features/command/handlers/emailNotionHandlers.ts");
const guarded = new Set([
  "save_current_email_travel_to_notion",
  "save_email_travel_to_notion_by_index",
  "save_email_travel_to_notion_by_query",
  "save_current_email_expense_to_notion",
  "save_email_expense_to_notion_by_index",
  "save_email_expense_to_notion_by_query",
  "save_current_email_package_to_notion",
  "save_email_package_to_notion_by_index",
  "save_email_package_to_notion_by_query",
]);

const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
const out = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(/if \(intent\.kind === "([^"]+)"\)/);
  if (match) {
    if (guarded.has(match[1])) {
      skip = true;
      continue;
    }
    skip = false;
  }
  if (skip) {
    continue;
  }
  out.push(line);
}

fs.writeFileSync(filePath, out.join("\n"));
console.log("Removed guarded save-to-notion blocks from emailNotionHandlers.ts");

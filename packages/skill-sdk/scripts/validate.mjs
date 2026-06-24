import fs from "node:fs";
import path from "node:path";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/validate.mjs path/to/skill.json");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.resolve(target), "utf8"));
const errors = [];
if (!manifest.id) errors.push("id is required");
if (!manifest.version) errors.push("version is required");
if (!Array.isArray(manifest.keywords) || manifest.keywords.length === 0) {
  errors.push("keywords are required");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Valid skill manifest: ${manifest.id}@${manifest.version}`);

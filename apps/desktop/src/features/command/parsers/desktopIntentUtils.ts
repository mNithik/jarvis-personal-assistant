export function isStudyAppsCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return (
    normalized.includes("study apps") ||
    normalized.includes("study stuff") ||
    normalized.includes("study setup") ||
    normalized.includes("study mode") ||
    normalized.includes("study session") ||
    normalized.includes("focus setup") ||
    normalized.includes("focus mode") ||
    normalized.includes("get my study") ||
    normalized.includes("ready for study")
  );
}

export function cleanConversationalCommand(command: string) {
  return command
    .trim()
    .replace(/^jarvis[\s,:-]*/i, "")
    .replace(/^(hey|hi|hello)\s+jarvis[\s,:-]*/i, "")
    .replace(/\bplease\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const desktopAppAliases = new Set([
  "chrome",
  "cmd",
  "command prompt",
  "edge",
  "explorer",
  "file explorer",
  "google chrome",
  "calc",
  "calculator",
  "microsoft edge",
  "notepad",
  "power shell",
  "powershell",
  "settings",
  "spotify",
  "task manager",
  "taskmgr",
  "visual studio code",
  "vs code",
  "vscode",
  "windows settings",
]);

export const namedFolderAliases = new Set([
  "desktop",
  "desktop folder",
  "documents",
  "documents folder",
  "downloads",
  "downloads folder",
  "jarvis project",
  "project",
  "project folder",
]);

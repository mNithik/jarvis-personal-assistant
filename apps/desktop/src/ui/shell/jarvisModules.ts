import type { JarvisModuleDescriptor } from "../../features/command/jarvisCommandTypes";

export const jarvisModules: JarvisModuleDescriptor[] = [
  {
    id: "ocr",
    name: "OCR Vision",
    description: "Read screens, watch changes, create tasks, and summarize visible text.",
    accent: "cyan",
  },
  {
    id: "voice",
    name: "Voice Core",
    description: "Wake mode, speech backend, learned phrases, and follow-up listening.",
    accent: "blue",
  },
  {
    id: "workspaces",
    name: "Workspaces",
    description: "Launch app/folder/site bundles and scheduled desktop modes.",
    accent: "amber",
  },
  {
    id: "memory",
    name: "Memory",
    description: "People, travel, expenses, packages, school, OCR history, and notes.",
    accent: "green",
  },
  {
    id: "integrations",
    name: "Integrations",
    description: "Google, Gmail, Notion, Spotify, Ollama, and executor bridge status.",
    accent: "pink",
  },
  {
    id: "automation",
    name: "Automation",
    description: "OCR watches, workspace schedules, workflows, and cross-feature rules.",
    accent: "violet",
  },
  {
    id: "builder",
    name: "Builder",
    description: "Coding handoffs, project checks, executor bridge, and future agent work.",
    accent: "red",
  },
];

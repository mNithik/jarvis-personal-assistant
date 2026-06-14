export type SkillStatus = "ready" | "planned";

export type Skill = {
  name: string;
  description: string;
  status: SkillStatus;
};

export const jarvisSkills: Skill[] = [
  {
    name: "Study Setup",
    description: "Launch your preferred learning stack in one command.",
    status: "ready",
  },
  {
    name: "Web Actions",
    description: "Open websites, route searches, and summarize pages later.",
    status: "ready",
  },
  {
    name: "Notion Notes",
    description: "Create, list, and search external notes through Notion.",
    status: "ready",
  },
  {
    name: "Calendar",
    description: "Create Google Calendar event drafts from natural language.",
    status: "ready",
  },
  {
    name: "Reminders",
    description: "Capture reminder drafts in Google Calendar from natural language.",
    status: "ready",
  },
  {
    name: "File Search",
    description: "Find and open local files from your Documents area.",
    status: "ready",
  },
  {
    name: "Spotify Control",
    description: "Connect Spotify and control playback from natural voice or text commands.",
    status: "ready",
  },
  {
    name: "Gmail",
    description: "Read unread mail and search your inbox through Gmail.",
    status: "ready",
  },
  {
    name: "Desktop Control",
    description: "Launch apps, open common folders, and capture screenshots.",
    status: "ready",
  },
];

export const jarvisQuickPrompts = [
  "Open my study apps",
  "Search machine learning on Google",
  "Open YouTube",
  "Make a note to review calculus tonight",
  "Add gym tomorrow at 6 PM to my calendar",
  "Remind me to call mom tomorrow at 5 PM",
  "Find my resume",
  "Find PDFs",
  "Open PDF 1",
  "Read PDF 1",
  "Summarize PDF 1",
  "Make tasks from PDF 1",
  "What's playing on Spotify",
  "Show unread emails",
  "Analyze email 1",
  "Save this email to Notion",
  "Read email 1",
  "Open email 1",
  "Show today's tasks",
  "Show upcoming tasks",
  "Complete task 1",
  "Complete task about report",
  "Move task 1 to tomorrow",
  "Reopen task 1",
  "Show done tasks",
  "Create daily brief",
  "Open VS Code",
  "Open downloads folder",
  "Take a screenshot",
  "Show clipboard",
  "Copy meeting notes to clipboard",
  "Search clipboard on Google",
  "Save clipboard to Notion",
  "Switch to Spotify",
  "Create desktop project coding",
  "Create coding workspace template",
  "Create school workspace template",
  "Open coding workspace",
  "Select OCR area",
  "Summarize screen",
  "Explain this error",
  "Turn this screen into flashcards",
  "Show OCR watches",
  "Show OCR history",
];

export const skillAutopilotAvailable = false;

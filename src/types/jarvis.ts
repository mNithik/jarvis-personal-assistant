export type RoutineRecord = {
  id: number;
  name: string;
  description: string;
  triggerPhrase: string;
};

export type HistoryRecord = {
  id: number;
  rawCommand: string;
  resolvedIntent: string;
  actionStatus: string;
  executedActions: string;
  createdAt: string;
};

export type ProposalRecord = {
  id: number;
  name: string;
  description: string;
  triggerPhrase: string;
  status: string;
  reasonSummary: string;
  confidence: number;
  basedOnCount: number;
  createdAt: string;
};

export type ProposalStepRecord = {
  id: number;
  proposalId: number;
  stepOrder: number;
  actionType: string;
  actionValue: string;
  requiresPermission: boolean;
};

export type ProposalUpdateInput = {
  id: number;
  name: string;
  description: string;
  triggerPhrase: string;
  steps: ProposalStepRecord[];
};

export type VoiceCorrectionRecord = {
  id: number;
  heardPhrase: string;
  correctedPhrase: string;
  createdAt: string;
};

export type BrowserAliasRecord = {
  id: number;
  phrase: string;
  url: string;
  createdAt: string;
};

export type LearnedIntentRecord = {
  id: number;
  phrase: string;
  normalizedPhrase: string;
  intentKind: string;
  intentPayload: string;
  useCount: number;
  createdAt: string;
  updatedAt: string;
};

export type NoteRecord = {
  id: string;
  title: string;
  summary: string;
  url: string;
  lastEditedTime: string;
};

export type NotionStatus = {
  configured: boolean;
  available: boolean;
  hasToken: boolean;
  databaseId: string | null;
  message: string;
};

export type GoogleCalendarStatus = {
  configured: boolean;
  hasClientId: boolean;
  hasApiKey: boolean;
  clientId: string | null;
  apiKey: string | null;
  message: string;
};

export type SpotifyStatus = {
  configured: boolean;
  hasClientId: boolean;
  clientId: string | null;
  message: string;
};

export type FileRecord = {
  path: string;
  name: string;
  modifiedAt: string;
};

export type EmailRecord = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  body: string;
};

export type ConversationInterpretation = {
  kind: string;
  query: string | null;
  url: string | null;
  clarificationPrompt: string | null;
};

export type MissingSkillPlan = {
  skillName: string;
  summary: string;
  userValue: string;
  buildSteps: string[];
  permissionsNeeded: string[];
  approvalMessage: string;
};

export type SkillImplementationRequest = {
  skillName: string;
  originalRequest: string;
  summary: string;
  userValue: string;
  buildSteps: string[];
  permissionsNeeded: string[];
  approvedAt: string;
};

export type SkillBuildRequest = {
  skillName: string;
  title: string;
  prompt: string;
  safetyChecks: string[];
  createdAt: string;
};

export type AutonomousBuildStatus =
  | "idle"
  | "planning"
  | "implementation_brief_ready"
  | "build_request_ready"
  | "handoff_ready"
  | "manual_required";

export type BuildHandoffArtifact = {
  markdownPath: string;
  jsonPath: string;
  createdAt: string;
  message: string;
};

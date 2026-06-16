import type { Dispatch, FormEvent, SetStateAction } from "react";

import type {
  CrossFeatureSuggestionRecord,
  DesktopProjectRecord,
  DesktopScheduleRecord,
  JarvisHomeAppId,
  JarvisPanelId,
  JarvisPanelRecord,
  ModelRouterConfig,
  OcrHistoryRecord,
  OcrSelectionState,
  OcrWatchTarget,
  OcrWatchTemplate,
  PanelDragState,
  SavedWorkflowRecord,
  ShellBarDragState,
  ShellBarPlacement,
  VoiceReplyMode,
} from "../../features/command/jarvisCommandTypes";
import type { ActiveConversationContext, CommandIntent } from "../../features/legacy/appHelpers";
import type { useJarvisWorkspaceSections } from "../../hooks/useJarvisWorkspaceSections";
import type { GatewayPreview } from "../../services/jarvisApi";
import type {
  AutonomousBuildStatus,
  BuildHandoffArtifact,
  LearnedIntentRecord,
  NotionStatus,
} from "../../types/jarvis";
import type {
  ConversationBackend,
  ExecutorStatus,
} from "../../types/voice";
import type { JarvisCommandRouter } from "../context/JarvisAppContext";
import type { JarvisUiState } from "../model/jarvisTypes";
import type { JarvisUiAction } from "../model/uiReducer";
import type { JarvisSystemDrawerContextValue } from "../settings/drawer/JarvisSystemDrawerContext";

type CommandResult = {
  title: string;
  detail: string;
  routeLabel?: string;
};

export type JarvisHomeAppAction = {
  label: string;
  command?: string;
  panel?: JarvisPanelId;
  cockpit?: boolean;
};

export type JarvisHomeAppRecord = {
  id: JarvisHomeAppId;
  title: string;
  kicker: string;
  description: string;
  stat: string;
  accent: string;
  actions: JarvisHomeAppAction[];
};

export type CockpitSignal = {
  label: string;
  value: string;
};

export type DataSphereNode = {
  label: string;
  value: string;
  app: JarvisHomeAppId;
  panel: JarvisPanelId;
  angle: number;
};

export type LearnedIntentFamilySummary = ReturnType<
  typeof import("../../features/semantic/intentRanking").buildLearnedIntentFamilySummaries
>[number];

export type JarvisShellViewModel = {
  learnedIntentFamilies: LearnedIntentFamilySummary[];
  displayPeopleMemory: import("../../features/command/jarvisCommandTypes").PersonMemoryRecord[];
  displayTravelMemory: import("../../features/command/jarvisCommandTypes").TravelMemoryRecord[];
  displayExpenseMemory: import("../../features/command/jarvisCommandTypes").ExpenseMemoryRecord[];
  displayPackageMemory: import("../../features/command/jarvisCommandTypes").PackageMemoryRecord[];
  displayMeetingPrepMemory: import("../../features/command/jarvisCommandTypes").MeetingPrepMemoryRecord[];
  displaySchoolPlanMemory: import("../../features/command/jarvisCommandTypes").SchoolPlanMemoryRecord[];
  memoryTotal: number;
  connectedIntegrations: string[];
  cockpitSignals: CockpitSignal[];
  cockpitMissionPrompts: string[];
  dataSphereNodes: DataSphereNode[];
  jarvisHomeApps: JarvisHomeAppRecord[];
  activeHomeApp: JarvisHomeAppId;
  activeHomeAppRecord: JarvisHomeAppRecord;
  nextMeetingEvent: import("../../services/googleCalendar").GoogleCalendarEventRecord | null;
  meetingPrepStatus: string;
};

export type JarvisPanelContentProps = {
  panel: JarvisPanelId;
  assistantName: string;
  activeOcrWatches: OcrWatchTarget[];
  ocrHistory: OcrHistoryRecord[];
  ocrWatchTemplates: OcrWatchTemplate[];
  lastOcrText: string;
  voiceSessionPhase: string;
  voiceBackend: string;
  learnedIntentMappings: LearnedIntentRecord[];
  wakeModeEnabled: boolean;
  voiceResponseEnabled: boolean;
  voiceReplyMode: VoiceReplyMode;
  desktopProjects: DesktopProjectRecord[];
  desktopSchedules: DesktopScheduleRecord[];
  activeConversationContext: ActiveConversationContext | null;
  displayPeopleMemory: JarvisShellViewModel["displayPeopleMemory"];
  displayTravelMemory: JarvisShellViewModel["displayTravelMemory"];
  displayExpenseMemory: JarvisShellViewModel["displayExpenseMemory"];
  displayPackageMemory: JarvisShellViewModel["displayPackageMemory"];
  displayMeetingPrepMemory: JarvisShellViewModel["displayMeetingPrepMemory"];
  displaySchoolPlanMemory: JarvisShellViewModel["displaySchoolPlanMemory"];
  memoryTotal: number;
  googleCalendarAccessToken: string | null;
  gmailAccessToken: string | null;
  notionStatus: NotionStatus | null;
  spotifyAccessToken: string | null;
  connectedIntegrations: string[];
  ocrWatchTargets: OcrWatchTarget[];
  savedWorkflows: SavedWorkflowRecord[];
  crossFeatureSuggestions: CrossFeatureSuggestionRecord[];
  executorStatus: ExecutorStatus | null;
  autonomousBuildStatus: AutonomousBuildStatus;
  handoffArtifact: BuildHandoffArtifact | null;
  executeIntent: (intent: CommandIntent) => Promise<boolean | undefined>;
  handleVoiceStart: () => void;
  handleWakeActivation: () => void;
};

export type JarvisAppRootRenderProps = {
  uiState: JarvisUiState;
  dispatchUi: (action: JarvisUiAction) => void;
  shellViewModel: JarvisShellViewModel;
  workspaceSections: ReturnType<typeof useJarvisWorkspaceSections>;
  drawerContext: JarvisSystemDrawerContextValue;
  input: string;
  setInput: (value: string) => void;
  isRoutingCommand: boolean;
  commandRouter: JarvisCommandRouter;
  statusMessage: string;
  assistantName: string;
  wakeCueActive: boolean;
  showGatewayTrace: boolean;
  setShowGatewayTrace: Dispatch<SetStateAction<boolean>>;
  gatewayPreview: GatewayPreview | null;
  gatewayPreviewError: string | null;
  isPreviewingGateway: boolean;
  conversationBackend: ConversationBackend;
  shellBarInput: string;
  setShellBarInput: (value: string) => void;
  submitShellBarCommand: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  shellBarPlacement: ShellBarPlacement;
  pinShellBar: (placement: Exclude<ShellBarPlacement, "free">) => void;
  setShellBarDragState: Dispatch<SetStateAction<ShellBarDragState>>;
  handleVoiceStart: () => void;
  runCommand: JarvisCommandRouter["runCommand"];
  executeIntent: (intent: CommandIntent) => Promise<boolean | undefined>;
  jarvisPanels: JarvisPanelRecord[];
  setPanelDragState: Dispatch<SetStateAction<PanelDragState>>;
  toggleJarvisPanel: (panel: JarvisPanelId) => void;
  closeJarvisPanel: (panel?: JarvisPanelId) => void;
  openJarvisPanel: (panel: JarvisPanelId) => void;
  panelContentProps: Omit<JarvisPanelContentProps, "panel">;
  pingCore: () => Promise<void>;
  resetJarvisUiPreferences: () => void;
  commandResult: CommandResult | null;
  ocrHistory: OcrHistoryRecord[];
  savedWorkflows: SavedWorkflowRecord[];
  ocrWatchTargets: OcrWatchTarget[];
  desktopProjects: DesktopProjectRecord[];
  modelRouterConfig: ModelRouterConfig;
  executorStatus: ExecutorStatus | null;
  isOcrSelecting: boolean;
  ocrSelection: OcrSelectionState;
  setOcrSelection: Dispatch<SetStateAction<OcrSelectionState>>;
  setIsOcrSelecting: (value: boolean) => void;
  setStatusMessage: (message: string) => void;
  completeOcrSelection: (rect: { x: number; y: number; width: number; height: number }) => Promise<void>;
  selectionRect: { left: number; top: number; width: number; height: number } | null;
  moveJarvisPanel: (clientX: number, clientY: number) => void;
  moveShellBar: (clientX: number, clientY: number) => void;
};

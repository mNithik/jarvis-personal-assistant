import { useMemo } from "react";

import type {
  ExpenseMemoryRecord,
  JarvisHomeAppId,
  JarvisPanelId,
  MeetingPrepMemoryRecord,
  ModelRouterConfig,
  PackageMemoryRecord,
  PersonMemoryRecord,
  SavedWorkflowRecord,
  SchoolPlanMemoryRecord,
  TravelMemoryRecord,
} from "../features/command/jarvisCommandTypes";
import type { LearnedIntentRecord, NotionStatus } from "../types/jarvis";
import type { GoogleCalendarEventRecord } from "../services/googleCalendar";
import type { ExecutorStatus } from "../types/voice";
import { MODEL_PROVIDER_LABELS } from "../features/legacy/appHelpers";
import { findMeetingPrepEvent } from "../features/semantic/intentRanking";
import { buildLearnedIntentFamilySummaries } from "../features/semantic/intentRanking";
import type { JarvisUiState } from "../ui/model/jarvisTypes";
import type {
  DataSphereNode,
  JarvisHomeAppRecord,
  JarvisShellViewModel,
} from "../ui/shell/jarvisAppRootTypes";

const COCKPIT_MISSION_PROMPTS = [
  "Create daily brief",
  "Read my screen",
  "Show unread emails",
  "Open coding workspace",
  "Show OCR watches",
  "Run project checks",
];

export type UseJarvisShellViewModelArgs = {
  learnedIntentMappings: LearnedIntentRecord[];
  rustPeopleMemory: PersonMemoryRecord[] | null;
  peopleMemory: PersonMemoryRecord[];
  rustTravelMemory: TravelMemoryRecord[] | null;
  travelMemory: TravelMemoryRecord[];
  rustExpenseMemory: ExpenseMemoryRecord[] | null;
  expenseMemory: ExpenseMemoryRecord[];
  rustPackageMemory: PackageMemoryRecord[] | null;
  packageMemory: PackageMemoryRecord[];
  rustMeetingPrepMemory: MeetingPrepMemoryRecord[] | null;
  meetingPrepMemory: MeetingPrepMemoryRecord[];
  rustSchoolPlanMemory: SchoolPlanMemoryRecord[] | null;
  schoolPlanMemory: SchoolPlanMemoryRecord[];
  voiceSessionPhase: string;
  activeOcrWatches: { id: string }[];
  googleCalendarAccessToken: string | null;
  gmailAccessToken: string | null;
  notionStatus: NotionStatus | null;
  spotifyAccessToken: string | null;
  desktopProjects: { id: string; name: string }[];
  savedWorkflows: SavedWorkflowRecord[];
  ocrWatchTargets: { id: string }[];
  ocrHistory: unknown[];
  modelRouterConfig: ModelRouterConfig;
  executorStatus: ExecutorStatus | null;
  uiState: JarvisUiState;
  todayCalendarEvents?: GoogleCalendarEventRecord[];
};

export function useJarvisShellViewModel(args: UseJarvisShellViewModelArgs): JarvisShellViewModel {
  const {
    learnedIntentMappings,
    rustPeopleMemory,
    peopleMemory,
    rustTravelMemory,
    travelMemory,
    rustExpenseMemory,
    expenseMemory,
    rustPackageMemory,
    packageMemory,
    rustMeetingPrepMemory,
    meetingPrepMemory,
    rustSchoolPlanMemory,
    schoolPlanMemory,
    voiceSessionPhase,
    activeOcrWatches,
    googleCalendarAccessToken,
    gmailAccessToken,
    notionStatus,
    spotifyAccessToken,
    desktopProjects,
    savedWorkflows,
    ocrWatchTargets,
    ocrHistory,
    modelRouterConfig,
    executorStatus,
    uiState,
    todayCalendarEvents = [],
  } = args;

  const learnedIntentFamilies = useMemo(
    () => buildLearnedIntentFamilySummaries(learnedIntentMappings),
    [learnedIntentMappings],
  );

  const displayPeopleMemory = useMemo(
    () => rustPeopleMemory ?? peopleMemory,
    [rustPeopleMemory, peopleMemory],
  );
  const displayTravelMemory = useMemo(
    () => rustTravelMemory ?? travelMemory,
    [rustTravelMemory, travelMemory],
  );
  const displayExpenseMemory = useMemo(
    () => rustExpenseMemory ?? expenseMemory,
    [rustExpenseMemory, expenseMemory],
  );
  const displayPackageMemory = useMemo(
    () => rustPackageMemory ?? packageMemory,
    [rustPackageMemory, packageMemory],
  );
  const displayMeetingPrepMemory = useMemo(
    () => rustMeetingPrepMemory ?? meetingPrepMemory,
    [rustMeetingPrepMemory, meetingPrepMemory],
  );
  const displaySchoolPlanMemory = useMemo(
    () => rustSchoolPlanMemory ?? schoolPlanMemory,
    [rustSchoolPlanMemory, schoolPlanMemory],
  );

  const memoryTotal = useMemo(
    () =>
      displayPeopleMemory.length +
      displayTravelMemory.length +
      displayExpenseMemory.length +
      displayPackageMemory.length +
      displayMeetingPrepMemory.length +
      displaySchoolPlanMemory.length,
    [
      displayPeopleMemory,
      displayTravelMemory,
      displayExpenseMemory,
      displayPackageMemory,
      displayMeetingPrepMemory,
      displaySchoolPlanMemory,
    ],
  );

  const connectedIntegrations = useMemo(
    () =>
      [
        googleCalendarAccessToken ? "Calendar" : null,
        gmailAccessToken ? "Gmail" : null,
        notionStatus?.hasToken ? "Notion" : null,
        spotifyAccessToken ? "Spotify" : null,
      ].filter((item): item is string => Boolean(item)),
    [googleCalendarAccessToken, gmailAccessToken, notionStatus, spotifyAccessToken],
  );

  const nextMeetingEvent = useMemo(() => {
    if (!googleCalendarAccessToken || todayCalendarEvents.length === 0) {
      return null;
    }
    const now = Date.now();
    const horizon = now + 60 * 60 * 1000;
    const upcoming = todayCalendarEvents
      .filter((event) => {
        if (!event.start) {
          return false;
        }
        const start = new Date(event.start).getTime();
        return start > now && start <= horizon;
      })
      .sort((left, right) => {
        const leftStart = left.start ? new Date(left.start).getTime() : Number.MAX_SAFE_INTEGER;
        const rightStart = right.start ? new Date(right.start).getTime() : Number.MAX_SAFE_INTEGER;
        return leftStart - rightStart;
      });
    return upcoming[0] ?? findMeetingPrepEvent(todayCalendarEvents, null);
  }, [googleCalendarAccessToken, todayCalendarEvents]);

  const meetingPrepStatus = useMemo(() => {
    if (!googleCalendarAccessToken) {
      return "Calendar off";
    }
    if (!nextMeetingEvent) {
      return "No meeting soon";
    }
    if (displayMeetingPrepMemory.length === 0) {
      return `Prep: ${nextMeetingEvent.summary}`;
    }
    return `${displayMeetingPrepMemory.length} saved`;
  }, [
    googleCalendarAccessToken,
    nextMeetingEvent,
    displayMeetingPrepMemory.length,
  ]);

  const cockpitSignals = useMemo(
    () => [
      { label: "Voice", value: voiceSessionPhase },
      { label: "OCR", value: `${activeOcrWatches.length} active` },
      { label: "Memory", value: `${memoryTotal} cards` },
      { label: "Meeting", value: meetingPrepStatus },
      { label: "Links", value: `${connectedIntegrations.length} on` },
      { label: "Workspaces", value: `${desktopProjects.length} saved` },
      { label: "Automation", value: `${savedWorkflows.length + ocrWatchTargets.length} rules` },
    ],
    [
      voiceSessionPhase,
      activeOcrWatches.length,
      memoryTotal,
      meetingPrepStatus,
      connectedIntegrations.length,
      desktopProjects.length,
      savedWorkflows.length,
      ocrWatchTargets.length,
    ],
  );

  const cockpitMissionPrompts = useMemo(() => COCKPIT_MISSION_PROMPTS, []);

  const dataSphereNodes = useMemo(
    (): DataSphereNode[] => [
      {
        label: "Voice",
        value: voiceSessionPhase,
        app: "command" as JarvisHomeAppId,
        panel: "voice" as JarvisPanelId,
        angle: 0,
      },
      {
        label: "Vision",
        value: `${ocrHistory.length} reads`,
        app: "vision" as JarvisHomeAppId,
        panel: "ocr" as JarvisPanelId,
        angle: 52,
      },
      {
        label: "Memory",
        value: `${memoryTotal} cards`,
        app: "memory" as JarvisHomeAppId,
        panel: "memory" as JarvisPanelId,
        angle: 104,
      },
      {
        label: "Auto",
        value: `${ocrWatchTargets.length} watches`,
        app: "automation" as JarvisHomeAppId,
        panel: "automation" as JarvisPanelId,
        angle: 156,
      },
      {
        label: "Desk",
        value: `${desktopProjects.length} spaces`,
        app: "workspaces" as JarvisHomeAppId,
        panel: "workspaces" as JarvisPanelId,
        angle: 208,
      },
      {
        label: "Links",
        value: `${connectedIntegrations.length} on`,
        app: "connections" as JarvisHomeAppId,
        panel: "integrations" as JarvisPanelId,
        angle: 260,
      },
      {
        label: "Models",
        value: modelRouterConfig.allowCloudForPrivateMemory ? "cloud ok" : "local",
        app: "models" as JarvisHomeAppId,
        panel: "integrations" as JarvisPanelId,
        angle: 300,
      },
      {
        label: "Build",
        value: executorStatus?.configured ? "ready" : "setup",
        app: "builder" as JarvisHomeAppId,
        panel: "builder" as JarvisPanelId,
        angle: 340,
      },
    ],
    [
      voiceSessionPhase,
      ocrHistory.length,
      memoryTotal,
      ocrWatchTargets.length,
      desktopProjects.length,
      connectedIntegrations.length,
      modelRouterConfig.allowCloudForPrivateMemory,
      executorStatus?.configured,
    ],
  );

  const activeHomeApp = uiState.activeWorkspaceId;

  const jarvisHomeApps = useMemo(
    (): JarvisHomeAppRecord[] => [
      {
        id: "command",
        title: "Command",
        kicker: "Natural language",
        description: "Run text or voice commands, route actions, and see the latest result.",
        stat: voiceSessionPhase,
        accent: "cyan",
        actions: [
          { label: "Listen", command: "__listen__" },
          { label: "Daily brief", command: "Create daily brief" },
          { label: "Cockpit", cockpit: true },
        ],
      },
      {
        id: "vision",
        title: "Vision",
        kicker: "OCR and screen",
        description: "Read your screen, summarize visible text, watch apps, and create tasks from OCR.",
        stat: `${ocrHistory.length} reads`,
        accent: "blue",
        actions: [
          { label: "Read screen", command: "Read my screen" },
          { label: "Select area", command: "Select OCR area" },
          { label: "Open panel", panel: "ocr" },
        ],
      },
      {
        id: "memory",
        title: "Memory",
        kicker: "People and life",
        description: "Birthdays, travel, expenses, packages, meetings, school plans, and learned language.",
        stat: `${memoryTotal} cards`,
        accent: "green",
        actions: [
          { label: "Daily brief", command: "Create daily brief" },
          { label: "People", command: "List birthdays" },
          { label: "Open panel", panel: "memory" },
        ],
      },
      {
        id: "automation",
        title: "Automation",
        kicker: "Watches and workflows",
        description: "OCR watches, repeated workflows, schedules, and cross-feature suggestions.",
        stat: `${ocrWatchTargets.length + savedWorkflows.length} rules`,
        accent: "violet",
        actions: [
          { label: "Show watches", command: "Show OCR watches" },
          { label: "Schedules", command: "List desktop schedules" },
          { label: "Open panel", panel: "automation" },
        ],
      },
      {
        id: "workspaces",
        title: "Workspaces",
        kicker: "Desktop modes",
        description: "Saved app, folder, and website bundles for school, coding, focus, and daily routines.",
        stat: `${desktopProjects.length} saved`,
        accent: "amber",
        actions: [
          { label: "Open coding", command: "Open coding workspace" },
          { label: "Show workspaces", command: "List desktop projects" },
          { label: "Open panel", panel: "workspaces" },
        ],
      },
      {
        id: "connections",
        title: "Connections",
        kicker: "External apps",
        description: "Google Calendar, Gmail, Notion, Spotify, Ollama, and the local executor bridge.",
        stat: `${connectedIntegrations.length} online`,
        accent: "pink",
        actions: [
          { label: "Unread emails", command: "Show unread emails" },
          { label: "Spotify", command: "What's playing on Spotify" },
          { label: "Open panel", panel: "integrations" },
        ],
      },
      {
        id: "models",
        title: "Models",
        kicker: "AI routing",
        description: "Choose local/cloud models, benchmark providers, compare responses, and manage safe drafts.",
        stat: `${MODEL_PROVIDER_LABELS[modelRouterConfig.defaultProvider]}`,
        accent: "indigo",
        actions: [
          { label: "Benchmark", command: "Run model benchmark" },
          { label: "Recommend", command: "Recommend model routes" },
          { label: "Open models", command: "__models__" },
        ],
      },
      {
        id: "builder",
        title: "Builder",
        kicker: "Code and agent bridge",
        description: "Project checks, coding handoffs, executor bridge, and future voice-to-code control.",
        stat: executorStatus?.configured ? "ready" : "setup",
        accent: "red",
        actions: [
          { label: "Run checks", command: "Run project checks" },
          { label: "Open project", command: "Open project in VS Code" },
          { label: "Open panel", panel: "builder" },
        ],
      },
    ],
    [
      voiceSessionPhase,
      ocrHistory.length,
      memoryTotal,
      ocrWatchTargets.length,
      savedWorkflows.length,
      desktopProjects.length,
      connectedIntegrations.length,
      modelRouterConfig.defaultProvider,
      executorStatus?.configured,
    ],
  );

  const activeHomeAppRecord = useMemo(
    () => jarvisHomeApps.find((app) => app.id === activeHomeApp) ?? jarvisHomeApps[0],
    [jarvisHomeApps, activeHomeApp],
  );

  return {
    learnedIntentFamilies,
    displayPeopleMemory,
    displayTravelMemory,
    displayExpenseMemory,
    displayPackageMemory,
    displayMeetingPrepMemory,
    displaySchoolPlanMemory,
    memoryTotal,
    connectedIntegrations,
    cockpitSignals,
    cockpitMissionPrompts,
    dataSphereNodes,
    jarvisHomeApps,
    activeHomeApp,
    activeHomeAppRecord,
    nextMeetingEvent,
    meetingPrepStatus,
  };
}

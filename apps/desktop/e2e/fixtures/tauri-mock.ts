import type { GatewayConfig, InstalledSkillRecord } from "@desktop/services/jarvisApi";

export const defaultGatewayConfig = (): GatewayConfig => ({
  enabled: true,
  mode: "execute",
  features: {
    studyRoutine: true,
    screenOcr: true,
    gmail: true,
    notion: true,
    spotify: false,
    calendar: true,
    ocrNotion: false,
    emailNotion: false,
    memory: true,
    builder: true,
  },
  correlationPrefix: "jarvis",
  routing: { l2Enabled: false, preferLocalForPersonal: true, jarvisRouterEnabled: false },
  voice: { sttProvider: "browser", talkerEnabled: false },
  quotas: {
    groqDailyRequests: 100,
    openrouterDailyRequests: 100,
    nvidiaNimDailyRequests: 100,
    cerebrasDailyRequests: 100,
  },
  budgets: {
    maxStepsPerTurn: 12,
    maxWallTimeSeconds: 120,
    maxRetriesPerStep: 2,
    maxMcpPayloadBytes: 262144,
  },
  proactive: {
    heartbeatEnabled: true,
    heartbeatIntervalMinutes: 30,
    morningBriefEnabled: true,
    morningBriefTime: "07:30",
    ocrWatchTickEnabled: false,
    plannerCopilotEnabled: true,
    dayReplanOnCalendarChange: false,
  },
  knowledge: { localVaultPath: "", obsidianHostId: "obsidian-graph" },
  channels: {
    localWsEnabled: true,
    localWsPort: 18789,
    localWsToken: "e2e-token",
    telegramEnabled: false,
    discordEnabled: false,
    mobileApproveEnabled: true,
  },
  training: { exportEnabled: false, evalMinAccuracyPct: 95 },
  paid: { enabled: false, maxDailyRequests: 0, requireUserOptIn: true },
  labs: {
    projectBundlePilot: false,
    councilVerifier: false,
    councilRuntime: false,
    proactiveAnomaly: false,
    worldModelQueries: false,
    ambientCopilot: false,
  },
  mcpHosts: [],
});

type InvokeHandler = (args?: Record<string, unknown>) => unknown;
type TriggerRecipeMock = {
  id: string;
  name: string;
  enabled: boolean;
  kind: string;
  scheduleValue: string | null;
  payloadJson: string;
  createdAt: string;
  updatedAt: string;
};

export function buildInvokeHandlers(): Record<string, InvokeHandler> {
  let config = defaultGatewayConfig();
  const recipes: TriggerRecipeMock[] = [];
  const profiles = [
    { id: "work", name: "Work", kind: "work", createdAt: "2026-01-01" },
    { id: "personal", name: "Personal", kind: "personal", createdAt: "2026-01-01" },
    { id: "lab", name: "Lab", kind: "lab", createdAt: "2026-01-01" },
  ];
  let activeProfile = profiles[0];
  const nudges = [
    {
      id: "nudge-1",
      kind: "calendar_overload",
      message: "Calendar overload detected.",
      status: "pending",
      createdAt: "2026-01-01T00:00:00Z",
    },
  ];
  let ambientSessionActive = false;
  let ambientSuggestions = [
    {
      id: "ambient-1",
      sessionId: "session-1",
      message: "Ambient copilot noticed an action item in voice notes.",
      status: "shown",
      createdAt: "2026-01-01T00:00:00Z",
    },
  ];
  let topicGraph = {
    nodes: [
      { entityId: 1, domain: "meeting_prep", label: "Product review" },
      { entityId: 2, domain: "meeting_prep", label: "Stakeholders" },
    ],
    edges: [{ id: 1, subjectEntityId: 1, objectEntityId: 2, predicate: "relates_to" }],
  };
  const defaultTopicGraph = () => ({
    nodes: [
      { entityId: 1, domain: "meeting_prep", label: "Product review" },
      { entityId: 2, domain: "meeting_prep", label: "Stakeholders" },
    ],
    edges: [{ id: 1, subjectEntityId: 1, objectEntityId: 2, predicate: "relates_to" }],
  });
  const globalSkills: InstalledSkillRecord[] = [
    {
      id: "hello",
      version: "1.0.0",
      label: "Hello skill",
      enabled: true,
      keywords: ["hello skill"],
      sourceScope: "global",
      profileId: null,
    },
  ];
  const profileSkills: Record<string, InstalledSkillRecord[]> = {
    personal: [
      {
        id: "hello",
        version: "1.0.0",
        label: "Personal Hello skill",
        enabled: true,
        keywords: ["hello skill", "dinner plan"],
        sourceScope: "profile",
        profileId: "personal",
      },
    ],
  };
  const goalsByProfile: Record<string, Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>> = {
    work: [
      {
        id: "goal-work-1",
        title: "Work launch checklist",
        description: "",
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    personal: [
      {
        id: "goal-personal-1",
        title: "Personal dinner plan",
        description: "",
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    lab: [],
  };

  return {
    get_gateway_config: () => config,
    save_gateway_config: (args) => {
      config = args?.config as GatewayConfig;
      return null;
    },
    list_gateway_capabilities: () => [],
    list_mcp_host_registry: () => [],
    list_trigger_recipes_cmd: () => recipes,
    save_trigger_recipe_cmd: (args) => {
      const recipe = args?.recipe as TriggerRecipeMock | undefined;
      const index = recipes.findIndex((entry) => entry && recipe && entry.id === recipe.id);
      if (index >= 0) {
        recipes[index] = recipe as TriggerRecipeMock;
      } else {
        recipes.push(recipe as TriggerRecipeMock);
      }
      return null;
    },
    delete_trigger_recipe_cmd: (args) => {
      const id = String(args?.id ?? "");
      const index = recipes.findIndex((entry) => entry.id === id);
      if (index >= 0) {
        recipes.splice(index, 1);
      }
      return null;
    },
    preview_gateway_turn: (args) => {
      const request =
        args?.request && typeof args.request === "object"
          ? (args.request as { command?: unknown })
          : undefined;
      const command = String(request?.command ?? "");
      return {
        events: [],
        result: {
          sessionId: "session-1",
          turnId: 1,
          legacy: false,
          reply: `Previewed ${command}`,
          route: {
            capabilityId: "automation.workflow",
            capabilityLabel: "Automation",
            agent: "command",
            tier: "local",
            sensitivity: "public",
            score: 3,
            confidence: "high",
            decisionPolicy: "execute",
            decisionReason: "Matched workflow",
            reason: "test",
            routeLevel: "l0",
            resolvedProvider: null,
          },
        },
      };
    },
    list_proactive_nudges_cmd: () => nudges,
    dismiss_proactive_nudge_cmd: (args) => {
      const id = String(args?.id ?? "");
      const match = nudges.find((nudge) => nudge.id === id);
      if (match) {
        match.status = "dismissed";
      }
      return null;
    },
    accept_proactive_nudge_cmd: (args) => {
      const id = String(args?.id ?? "");
      const match = nudges.find((nudge) => nudge.id === id);
      if (match) {
        match.status = "accepted";
      }
      return null;
    },
    get_topic_graph_cmd: () => topicGraph,
    reset_topic_graph_cmd: () => {
      topicGraph = defaultTopicGraph();
      return null;
    },
    query_topic_neighbors_cmd: () => "Connections for Product review",
    infer_topic_graph_cmd: () => {
      topicGraph = {
        ...topicGraph,
        edges: [
          ...topicGraph.edges,
          { id: 2, subjectEntityId: 2, objectEntityId: 1, predicate: "mentions" },
        ],
      };
      return 2;
    },
    list_user_goals_cmd: () => goalsByProfile[activeProfile.id] ?? [],
    save_user_goal_cmd: (args) => {
      const goal = args?.goal as {
        id: string;
        title: string;
        description: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      };
      goalsByProfile[activeProfile.id] = [...(goalsByProfile[activeProfile.id] ?? []), goal];
      return null;
    },
    export_sync_bundle_cmd: () => "/tmp/export.jarvis-sync",
    import_sync_bundle_cmd: () => "Imported sync bundle",
    list_installed_skills_cmd: () => {
      const scoped = profileSkills[activeProfile.id] ?? [];
      const scopedIds = new Set(scoped.map((skill) => skill.id));
      return [...globalSkills.filter((skill) => !scopedIds.has(skill.id)), ...scoped];
    },
    list_user_profiles_cmd: () => profiles,
    get_active_profile_cmd: () => activeProfile,
    switch_user_profile_cmd: (args) => {
      const profileId = String(args?.profileId ?? "");
      const next = profiles.find((profile) => profile.id === profileId);
      if (next) {
        activeProfile = next;
      }
      return "Switched profile";
    },
    start_ambient_session_cmd: () => {
      ambientSessionActive = true;
      return { id: "session-1", consentGiven: true };
    },
    end_ambient_session_cmd: () => {
      ambientSessionActive = false;
      return null;
    },
    list_ambient_suggestions_cmd: () => (ambientSessionActive ? ambientSuggestions : []),
    record_ambient_signal_cmd: (args) => {
      if (!ambientSessionActive) {
        return null;
      }
      const signal = String(args?.signal ?? "").trim();
      if (!signal) {
        return null;
      }
      const suggestion = {
        id: `ambient-${ambientSuggestions.length + 1}`,
        sessionId: "session-1",
        message: `Ambient copilot noticed: ${signal.slice(0, 120)}`,
        status: "shown",
        createdAt: new Date().toISOString(),
      };
      ambientSuggestions = [...ambientSuggestions, suggestion];
      return suggestion;
    },
    dismiss_ambient_suggestion_cmd: (args) => {
      const id = String(args?.id ?? "");
      ambientSuggestions = ambientSuggestions.filter((suggestion) => suggestion.id !== id);
      return null;
    },
  };
}

export function installTauriMock() {
  const handlers = buildInvokeHandlers();
  const invoke = async (cmd: string, args?: Record<string, unknown>) => {
    const handler = handlers[cmd];
    if (!handler) {
      return null;
    }
    return handler(args);
  };
  (window as unknown as { __TAURI_INTERNALS__: { invoke: typeof invoke } }).__TAURI_INTERNALS__ = {
    invoke,
  };
}

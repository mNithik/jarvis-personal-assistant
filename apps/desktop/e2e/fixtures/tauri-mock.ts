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
  let pendingApprovals: Array<{
    id: string;
    sessionId: string;
    title: string;
    detail: string;
    risk: "read" | "write" | "destructive";
    createdAt: string;
  }> = [];
  let gatewayTrace: Array<{
    id: string;
    sessionId: string;
    turnId: number | null;
    kind: string;
    message: string;
    createdAt: string;
    approval: null;
  }> = [];
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
  const marketplaceCatalog = () => [
    {
      id: "hello",
      label: "Hello skill",
      version: "1.0.0",
      description: "Wave 16 fixture skill that routes to command.general.",
      keywords: ["hello skill", "wave16 hello"],
      sourcePath: "../tests/fixtures/skills/hello",
      operatorLane: "command",
    },
  ];
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
    gateway_run_turn: (args) => {
      const request =
        args?.request && typeof args.request === "object"
          ? (args.request as { command?: unknown })
          : undefined;
      const command = String(request?.command ?? "");
      const sendSlack = command.toLowerCase().startsWith("send this to slack ");
      if (sendSlack) {
        const approval = {
          id: "approval-slack-1",
          sessionId: "session-1",
          title: "Confirm send action: Slack send",
          detail: `JARVIS classified "${command}" as send policy for Slack send (integrations.slack_send).`,
          risk: "write" as const,
          createdAt: "2026-07-08T00:00:00Z",
        };
        pendingApprovals = [approval];
        gatewayTrace = [
          {
            id: "trace-approval-1",
            sessionId: "session-1",
            turnId: 1,
            kind: "approval_required",
            message: "Slack send requires approval.",
            createdAt: "2026-07-08T00:00:00Z",
            approval: null,
          },
          ...gatewayTrace,
        ];
        return {
          correlationId: "corr-1",
          events: [],
          result: {
            sessionId: "session-1",
            turnId: 1,
            legacy: false,
            reply: "Pending approval for Slack send.",
            route: {
              capabilityId: "integrations.slack_send",
              capabilityLabel: "Slack send",
              agent: "integrations",
              tier: "worker",
              sensitivity: "public",
              score: 3,
              confidence: "high",
              decisionPolicy: "execute",
              decisionReason: "Matched Slack send command",
              reason: "test",
              routeLevel: "l0",
              resolvedProvider: null,
            },
            integrationHandoff: null,
          },
          approval,
          awaitingApproval: true,
          talkerReply: null,
        };
      }
      gatewayTrace = [
        {
          id: `trace-${gatewayTrace.length + 1}`,
          sessionId: "session-1",
          turnId: 1,
          kind: "tool_end",
          message: `Executed ${command}`,
          createdAt: "2026-07-08T00:00:00Z",
          approval: null,
        },
        ...gatewayTrace,
      ];
      return {
        correlationId: "corr-1",
        events: [],
        result: {
          sessionId: "session-1",
          turnId: 1,
          legacy: false,
          reply: `Executed ${command}`,
          route: {
            capabilityId: "integrations.slack_read",
            capabilityLabel: "Slack",
            agent: "integrations",
            tier: "worker",
            sensitivity: "public",
            score: 3,
            confidence: "high",
            decisionPolicy: "execute",
            decisionReason: "Matched Slack read command",
            reason: "test",
            routeLevel: "l0",
            resolvedProvider: null,
          },
          integrationHandoff: null,
        },
        approval: null,
        awaitingApproval: false,
        talkerReply: null,
      };
    },
    list_pending_gateway_approvals: () => pendingApprovals,
    get_gateway_trace: () => gatewayTrace,
    gateway_approve: (args) => {
      const approvalId = String(args?.approvalId ?? "");
      pendingApprovals = pendingApprovals.filter((item) => item.id !== approvalId);
      gatewayTrace = [
        {
          id: `trace-approve-${gatewayTrace.length + 1}`,
          sessionId: "session-1",
          turnId: 1,
          kind: "reply",
          message: "Sent Slack draft to #general. Message timestamp: 1711111111.777.",
          createdAt: "2026-07-08T00:00:00Z",
          approval: null,
        },
        ...gatewayTrace,
      ];
      return {
        approved: true,
        approvalId,
        correlationId: "corr-1",
        message: "Sent Slack draft to #general. Message timestamp: 1711111111.777.",
        event: gatewayTrace[0],
      };
    },
    gateway_deny: (args) => {
      const approvalId = String(args?.approvalId ?? "");
      pendingApprovals = pendingApprovals.filter((item) => item.id !== approvalId);
      return {
        approved: false,
        approvalId,
        correlationId: "corr-1",
        message: "Denied Slack send.",
        event: {
          id: "trace-deny-1",
          sessionId: "session-1",
          turnId: 1,
          kind: "reply",
          message: "Denied Slack send.",
          createdAt: "2026-07-08T00:00:00Z",
          approval: null,
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
    remote_sync_status_cmd: () => ({
      connected: false,
      endpoint: "",
      deviceId: "",
      lastSyncAt: null,
      pendingConflicts: 0,
    }),
    connect_remote_sync_cmd: (args) => ({
      endpoint: String(args?.endpoint ?? ""),
      deviceToken: String(args?.deviceToken ?? ""),
      deviceId: "e2e-device",
      lastSyncAt: null,
      lastRemoteVersion: null,
    }),
    register_remote_sync_cmd: (args) => ({
      endpoint: String(args?.endpoint ?? ""),
      deviceToken: "tok_e2e_registered",
      deviceId: "jarvis-e2e-device",
      lastSyncAt: null,
      lastRemoteVersion: null,
    }),
    push_remote_sync_cmd: () => ({
      summary: "Pushed encrypted sync bundle to hosted store.",
      conflicts: [],
      applied: true,
    }),
    pull_remote_sync_cmd: () => ({
      summary: "Imported sync bundle from hosted store.",
      conflicts: [],
      applied: true,
    }),
    list_pending_sync_conflicts_cmd: () => [],
    list_marketplace_catalog_cmd: () => marketplaceCatalog(),
    install_marketplace_skill_cmd: (args) => ({
      skillId: String(args?.skillId ?? "hello"),
      installedPath: "/tmp/skills/hello",
      message: 'Installed marketplace skill "Hello skill" v1.0.0 into app_data/skills.',
    }),
    marketplace_operator_lane_cmd: () =>
      "Operator lane for Hello skill: command. Use project bundle pilot surfaces after manual lab sign-off.",
    refresh_marketplace_catalog_cmd: () => marketplaceCatalog(),
    link_topic_entities_cmd: (args) =>
      `Linked "${String(args?.subjectLabel ?? "")}" —${String(args?.predicate ?? "")}→ "${String(args?.objectLabel ?? "")}".`,
    unlink_topic_relation_cmd: (args) => `Removed relation ${String(args?.relationId ?? 0)}.`,
    get_proactive_metrics_cmd: () => ({
      shown: 2,
      dismissed: 1,
      accepted: 1,
      dismissRate: 0.5,
      acceptRate: 0.5,
    }),
    export_proactive_metrics_cmd: () => "Wrote proactive metrics to /tmp/metrics/proactive-summary.json",
    prepare_skill_publish_cmd: (args) => ({
      skillId: String(args?.skillId ?? "hello"),
      version: "1.0.0",
      packagePath: "/tmp/publish/hello",
      catalogEntryJson: '{"id":"hello","label":"Hello skill"}',
      instructions: "Open a PR to update marketplace/catalog.json.",
    }),
    create_build_handoff_artifact: (args) => ({
      markdownPath: "/tmp/jarvis-handoffs/hello-publish.md",
      jsonPath: "/tmp/jarvis-handoffs/hello-publish.json",
      createdAt: String(args?.request?.createdAt ?? "2026-07-08T00:00:00Z"),
      message: "JARVIS created a coding handoff package. Manual execution is the next boundary.",
    }),
    search_audit_log_cmd: () => [
      {
        lineIndex: 1,
        timestamp: "2026-07-08T00:00:00Z",
        policyClass: "write",
        agent: "memory",
        capabilityId: "memory.planner",
        sessionId: "session-1",
        turnId: 1,
        outcome: "success",
        detail: "Saved day plan to Notion.",
        rollbackRef: null,
        rawLine: "audit-line",
      },
    ],
    list_gateway_task_runs: () => [
      {
        id: "task-1",
        sessionId: "session-1",
        command: "resume last task",
        status: "running",
        currentStepIndex: 0,
        stepCount: 2,
        failureCount: 0,
        updatedAt: "2026-07-07T00:00:00Z",
      },
    ],
    list_project_bundles: () => [
      {
        runId: "bundle-1",
        command: "run meeting follow-up bundle",
        createdAt: "2026-07-07T00:00:00Z",
        steps: [
          { label: "Fetch emails", status: "done" },
          { label: "Draft follow-up", status: "pending" },
        ],
      },
    ],
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

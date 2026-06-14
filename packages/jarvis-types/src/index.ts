export type GatewayAgentKind =
  | "command"
  | "vision"
  | "memory"
  | "integrations"
  | "builder"
  | "supervisor"
  | "automation"
  | "research";

export type GatewayModelTier =
  | "local"
  | "talker"
  | "planner"
  | "worker"
  | "embed";

export type GatewaySensitivity = "public" | "personal" | "secret";

export type GatewayConfidenceBand = "high" | "medium" | "low";

export type GatewayDecisionPolicy = "execute" | "confirm" | "teach";

export type RouteLevel = "l0" | "l0_5" | "l1" | "l2" | "fallback";

export type GatewayEventKind =
  | "thinking"
  | "route_decided"
  | "tool_start"
  | "tool_end"
  | "approval_required"
  | "screen_analyzed"
  | "reply"
  | "error";

export type TurnRequest = {
  sessionId?: string;
  command: string;
  source?: "text" | "voice" | "automation" | "mcp";
};

export type GatewayRoute = {
  capabilityId: string;
  capabilityLabel: string;
  agent: GatewayAgentKind;
  tier: GatewayModelTier;
  sensitivity: GatewaySensitivity;
  score: number;
  confidence: GatewayConfidenceBand;
  decisionPolicy: GatewayDecisionPolicy;
  decisionReason: string;
  reason: string;
  routeLevel: RouteLevel;
  resolvedProvider?: string;
};

export type IntegrationHandoff = {
  capabilityId: string;
  action: string;
  payload?: string;
};

export type TurnResult = {
  sessionId: string;
  turnId: number;
  legacy: boolean;
  reply: string;
  route?: GatewayRoute;
  integrationHandoff?: IntegrationHandoff;
};

export type ApprovalRequest = {
  id: string;
  sessionId: string;
  title: string;
  detail: string;
  risk: "read" | "write" | "destructive";
  createdAt: string;
};

export type GatewayEvent = {
  id: string;
  sessionId: string;
  turnId?: number;
  kind: GatewayEventKind;
  message: string;
  createdAt: string;
  approval?: ApprovalRequest;
};

export type GatewayFeatures = {
  studyRoutine: boolean;
  screenOcr: boolean;
  gmail: boolean;
  notion: boolean;
  spotify: boolean;
  calendar: boolean;
  ocrNotion: boolean;
  emailNotion: boolean;
  memory: boolean;
  builder: boolean;
};

export type GatewayRoutingConfig = {
  l2Enabled: boolean;
  preferLocalForPersonal: boolean;
};

export type GatewaySttProvider = "browser" | "local" | "groq";

export type GatewayVoiceConfig = {
  sttProvider: GatewaySttProvider;
  talkerEnabled: boolean;
};

export type GatewayQuotaConfig = {
  groqDailyRequests: number;
  openrouterDailyRequests: number;
  nvidiaNimDailyRequests: number;
};

export type GatewayConfig = {
  enabled: boolean;
  features: GatewayFeatures;
  correlationPrefix: string;
  routing: GatewayRoutingConfig;
  voice: GatewayVoiceConfig;
  quotas: GatewayQuotaConfig;
};

export type GatewayToolDefinition = {
  id: string;
  label: string;
  risk: "read" | "write" | "destructive";
  category: string;
};

export type ModelPreset = {
  id: string;
  providerId: string;
  label: string;
  chatModel: string;
  codingModel: string;
  reasoningModel: string;
  talkerTier: GatewayModelTier;
  plannerTier: GatewayModelTier;
  workerTier: GatewayModelTier;
};

export type ProviderDefaults = {
  providerId: string;
  baseUrl: string;
  chatModel: string;
  codingModel: string;
  reasoningModel: string;
  enabled: boolean;
};

export type GatewayTurnResponse = {
  correlationId: string;
  events: GatewayEvent[];
  result: TurnResult;
  approval?: ApprovalRequest;
  awaitingApproval: boolean;
  talkerReply?: string | null;
};

export type GatewayApprovalResolution = {
  approved: boolean;
  approvalId: string;
  correlationId: string;
  message: string;
  event: GatewayEvent;
};

export type McpToolDescriptor = {
  name: string;
  description: string;
  risk: "read" | "write" | "destructive";
  category: string;
};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayAgentKind {
    Command,
    Vision,
    Memory,
    Integrations,
    Builder,
    Supervisor,
    Automation,
    Research,
    Finance,
    Writer,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayModelTier {
    Local,
    Talker,
    Planner,
    Worker,
    Embed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewaySensitivity {
    Public,
    Personal,
    Secret,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayConfidenceBand {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayDecisionPolicy {
    Execute,
    Confirm,
    Teach,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayPolicyClass {
    Read,
    Write,
    Send,
    Schedule,
    Delete,
    Execute,
    Pay,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayEventKind {
    Thinking,
    RouteDecided,
    ToolStart,
    ToolEnd,
    ApprovalRequired,
    ScreenAnalyzed,
    Reply,
    KnowledgeRecalled,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TurnRequest {
    pub session_id: Option<String>,
    pub command: String,
    pub source: Option<TurnSource>,
    pub idempotency_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TurnSource {
    Text,
    Voice,
    Automation,
    Mcp,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationHandoff {
    pub capability_id: String,
    pub action: String,
    pub payload: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TurnResult {
    pub session_id: String,
    pub turn_id: u64,
    pub legacy: bool,
    pub reply: String,
    pub route: Option<GatewayRoute>,
    pub integration_handoff: Option<IntegrationHandoff>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RouteLevel {
    L0,
    #[serde(rename = "l0_5")]
    L0_5,
    L1,
    #[serde(rename = "l1_5")]
    L1_5,
    L2,
    #[serde(rename = "l3")]
    L3,
    #[serde(rename = "l4")]
    L4,
    Fallback,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayRoute {
    pub capability_id: String,
    pub capability_label: String,
    pub agent: GatewayAgentKind,
    pub tier: GatewayModelTier,
    pub sensitivity: GatewaySensitivity,
    pub score: u32,
    pub confidence: GatewayConfidenceBand,
    pub decision_policy: GatewayDecisionPolicy,
    pub decision_reason: String,
    pub reason: String,
    pub route_level: RouteLevel,
    pub resolved_provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalRequest {
    pub id: String,
    pub session_id: String,
    pub title: String,
    pub detail: String,
    pub risk: ApprovalRisk,
    pub created_at: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalRisk {
    Read,
    Write,
    Destructive,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayEvent {
    pub id: String,
    pub session_id: String,
    pub turn_id: Option<u64>,
    pub kind: GatewayEventKind,
    pub message: String,
    pub created_at: String,
    pub approval: Option<ApprovalRequest>,
}

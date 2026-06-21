use crate::gateway::types::{
    GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier, GatewayRoute,
    GatewaySensitivity, RouteLevel,
};

#[derive(Debug, Clone)]
pub struct CapabilityRoute {
    pub id: &'static str,
    pub label: &'static str,
    pub agent: GatewayAgentKind,
    pub tier: GatewayModelTier,
    pub keywords: &'static [&'static str],
    pub reason: &'static str,
}

pub fn route_l0(command: &str) -> Option<GatewayRoute> {
    let normalized = normalize_command(command);
    let sensitivity = classify_sensitivity(&normalized);
    let best = capability_registry()
        .iter()
        .filter_map(|capability| {
            let score = score_capability(&normalized, capability);
            (score > 0).then(|| build_route(capability, sensitivity.clone(), score, RouteLevel::L0))
        })
        .max_by(|left, right| {
            left.score
                .cmp(&right.score)
                .then_with(|| route_priority(&left.agent).cmp(&route_priority(&right.agent)))
        })?;

    Some(best)
}

pub fn default_route(sensitivity: GatewaySensitivity) -> GatewayRoute {
    GatewayRoute {
        capability_id: "command.general".to_string(),
        capability_label: "General Command".to_string(),
        agent: GatewayAgentKind::Command,
        tier: GatewayModelTier::Local,
        sensitivity,
        score: 0,
        confidence: GatewayConfidenceBand::Low,
        decision_policy: GatewayDecisionPolicy::Teach,
        decision_reason: "Low confidence fallback. Ask the user to teach or clarify this phrase."
            .to_string(),
        reason: "No capability matched, using the default command route.".to_string(),
        route_level: RouteLevel::Fallback,
        resolved_provider: None,
    }
}

pub fn normalize_command(command: &str) -> String {
    command.trim().to_lowercase()
}

pub fn classify_sensitivity(command: &str) -> GatewaySensitivity {
    if contains_any(command, &["api key", "token", "password", "secret"]) {
        return GatewaySensitivity::Secret;
    }

    if contains_any(
        command,
        &[
            "email", "gmail", "calendar", "notion", "expense", "birthday", "address",
        ],
    ) {
        return GatewaySensitivity::Personal;
    }

    GatewaySensitivity::Public
}

pub fn build_route(
    capability: &CapabilityRoute,
    sensitivity: GatewaySensitivity,
    score: u32,
    route_level: RouteLevel,
) -> GatewayRoute {
    let confidence = confidence_for_score(score);
    let (decision_policy, decision_reason) =
        decision_for_route(&confidence, &sensitivity, capability.id);

    GatewayRoute {
        capability_id: capability.id.to_string(),
        capability_label: capability.label.to_string(),
        agent: capability.agent.clone(),
        tier: capability.tier.clone(),
        sensitivity,
        score,
        confidence,
        decision_policy,
        decision_reason,
        reason: capability.reason.to_string(),
        route_level,
        resolved_provider: None,
    }
}

fn capability_registry() -> &'static [CapabilityRoute] {
    &[
        CapabilityRoute {
            id: "core.mission",
            label: "Mission Control",
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            keywords: &[
                "resume last task",
                "resume task",
                "continue last task",
                "show task runs",
                "list task runs",
                "mission control",
                "task status",
            ],
            reason: "Matched the mission control capability registry.",
        },
        CapabilityRoute {
            id: "command.study",
            label: "Study Setup",
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            keywords: &["study setup", "launch study", "study routine", "focus workspace"],
            reason: "Matched the study setup capability registry.",
        },
        CapabilityRoute {
            id: "vision.ocr",
            label: "Screen and OCR",
            agent: GatewayAgentKind::Vision,
            tier: GatewayModelTier::Worker,
            keywords: &[
                "screen",
                "screenshot",
                "ocr",
                "read my screen",
                "read chrome",
                "read notepad",
                "screen text",
            ],
            reason: "Matched the Vision capability registry.",
        },
        CapabilityRoute {
            id: "integrations.spotify",
            label: "Spotify",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[
                "spotify", "song", "music", "playlist", "play", "pause", "queue", "skip",
            ],
            reason: "Matched the Spotify capability registry.",
        },
        CapabilityRoute {
            id: "integrations.ocr_notion",
            label: "OCR to Notion",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[
                "read screen and save to notion",
                "ocr screen to notion",
                "save screen text to notion",
                "save ocr history to notion",
                "save screen history to notion",
                "watch ",
                "stop ocr watch",
                "show ocr watches",
            ],
            reason: "Matched the OCR to Notion capability registry.",
        },
        CapabilityRoute {
            id: "integrations.email_notion",
            label: "Email to Notion",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[
                "save this email to notion",
                "save email digest to notion",
                "email to notion",
                "emails to notion",
                "save first",
                "save travel from email",
                "save travel from the email",
                "save expense from email",
                "save expense from the email",
                "save package from email",
                "save package from the email",
                "save email about",
                "travel from this email to notion",
                "expense from this email to notion",
                "package from this email to notion",
            ],
            reason: "Matched the email to Notion capability registry.",
        },
        CapabilityRoute {
            id: "integrations.notion",
            label: "Notion",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &["notion", "note", "task", "todo", "save this", "database"],
            reason: "Matched the Notion capability registry.",
        },
        CapabilityRoute {
            id: "integrations.calendar",
            label: "Google Calendar",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[
                "my calendar",
                "to my calendar",
                "on my calendar",
                "calendar today",
                "today's events",
                "schedule this email",
                "add this email to calendar",
                "calendar",
                "schedule",
                "meeting",
                "event",
            ],
            reason: "Matched the Google Calendar capability registry.",
        },
        CapabilityRoute {
            id: "integrations.google",
            label: "Gmail",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[
                "gmail",
                "email",
                "inbox",
                "unread",
                "triage my inbox",
                "triage inbox",
                "draft a reply",
                "draft reply",
                "read this email",
                "read email",
                "show email",
            ],
            reason: "Matched the Gmail capability registry.",
        },
        CapabilityRoute {
            id: "memory.planner",
            label: "Day Planner Copilot",
            agent: GatewayAgentKind::Memory,
            tier: GatewayModelTier::Embed,
            keywords: &[
                "plan my day",
                "morning plan",
                "replan my day",
                "adjust my plan",
                "something came up",
                "save plan to notion",
                "save day plan to notion",
            ],
            reason: "Matched the day planner copilot capability registry.",
        },
        CapabilityRoute {
            id: "memory.life",
            label: "People and Life Memory",
            agent: GatewayAgentKind::Memory,
            tier: GatewayModelTier::Embed,
            keywords: &[
                "remember",
                "preference",
                "birthday",
                "people memory",
                "travel plans",
                "travel memory",
                "recurring expenses",
                "arriving tomorrow",
                "delayed packages",
                "travel",
                "expense",
                "package",
                "school",
                "meeting prep",
                "next meeting",
                "prep for",
                "standup",
                "daily brief",
                "morning brief",
                "make my daily brief",
                "weekly expenses",
                "monthly expenses",
                "travel checklist",
                "trip timeline",
                "travel timeline",
                "prep me for my trip",
                "travel copilot",
                "refresh travel prep",
                "topic graph for",
                "who is involved in",
                "what commitments",
                "world model",
                "connected to",
            ],
            reason: "Matched the Memory capability registry.",
        },
        CapabilityRoute {
            id: "integrations.mcp.github",
            label: "GitHub MCP",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[
                "github issues",
                "github issue",
                "list github issues",
                "github pr",
                "github prs",
                "github pull",
                "open prs",
                "my github repos",
                "search github repos",
                "github repos",
            ],
            reason: "Matched the GitHub MCP capability registry.",
        },
        CapabilityRoute {
            id: "integrations.mcp.jira",
            label: "Jira MCP",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[
                "jira issues",
                "jira issue",
                "list jira issues",
                "my jira tickets",
                "search jira",
            ],
            reason: "Matched the Jira MCP capability registry.",
        },
        CapabilityRoute {
            id: "integrations.mcp.huggingface",
            label: "HuggingFace MCP",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[
                "huggingface models",
                "search huggingface",
                "hf models",
                "find a model on huggingface",
            ],
            reason: "Matched the HuggingFace MCP capability registry.",
        },
        CapabilityRoute {
            id: "integrations.mcp.zapier",
            label: "Zapier MCP",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &[
                "zapier actions",
                "list zapier",
                "my zaps",
                "run zapier",
            ],
            reason: "Matched the Zapier MCP capability registry.",
        },
        CapabilityRoute {
            id: "builder.code",
            label: "Builder and Code",
            agent: GatewayAgentKind::Builder,
            tier: GatewayModelTier::Planner,
            keywords: &[
                "code",
                "repo",
                "codex",
                "build",
                "debug",
                "test",
                "api",
                "database",
                "typescript",
                "rust",
                "run project checks",
                "debug this repo",
                " in jarvis",
                "open repo in vs code",
            ],
            reason: "Matched the Builder capability registry.",
        },
        CapabilityRoute {
            id: "command.desktop",
            label: "Desktop Command",
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            keywords: &[
                "open",
                "launch",
                "focus",
                "close",
                "minimize",
                "workspace",
                "folder",
                "chrome",
            ],
            reason: "Matched the desktop command capability registry.",
        },
        CapabilityRoute {
            id: "command.search",
            label: "Search Command",
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            keywords: &["search google", "google for", "search for"],
            reason: "Matched the search command capability registry.",
        },
        CapabilityRoute {
            id: "command.files",
            label: "Files",
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            keywords: &[
                "recent files",
                "show recent files",
                "show my recent files",
                "list pdfs",
                "show pdfs",
                "find pdfs",
                "search pdfs for",
                "find pdf about",
                "open pdf",
                "open this pdf",
                "open the pdf about",
                "read pdf",
                "read this pdf",
                "read the pdf about",
                "show pdf",
                "show this pdf",
                "show the pdf about",
                "summarize pdf",
                "summarize this pdf",
                "summarize the pdf about",
            ],
            reason: "Matched the files capability registry.",
        },
        CapabilityRoute {
            id: "supervisor.delegate",
            label: "Supervisor",
            agent: GatewayAgentKind::Supervisor,
            tier: GatewayModelTier::Planner,
            keywords: &[" then "],
            reason: "Matched the supervisor multi-step capability registry.",
        },
        CapabilityRoute {
            id: "automation.workflow",
            label: "Automation",
            agent: GatewayAgentKind::Automation,
            tier: GatewayModelTier::Local,
            keywords: &[
                "run workflow",
                "start workflow",
                "list trigger recipes",
                "show proactive triggers",
                "run project bundle",
                "project bundle",
                "meeting follow-up bundle",
            ],
            reason: "Matched the automation workflow capability registry.",
        },
        CapabilityRoute {
            id: "memory.vault",
            label: "Knowledge Vault",
            agent: GatewayAgentKind::Memory,
            tier: GatewayModelTier::Embed,
            keywords: &[
                "search vault",
                "search my vault",
                "search obsidian",
                "find in vault",
                "vault for",
                "backlinks for",
                "show backlinks",
                "what links to",
            ],
            reason: "Matched the local knowledge vault capability registry.",
        },
        CapabilityRoute {
            id: "integrations.mcp.host",
            label: "MCP Host",
            agent: GatewayAgentKind::Integrations,
            tier: GatewayModelTier::Worker,
            keywords: &["mcp "],
            reason: "Matched the external MCP host capability registry.",
        },
        CapabilityRoute {
            id: "research.web",
            label: "Research",
            agent: GatewayAgentKind::Research,
            tier: GatewayModelTier::Talker,
            keywords: &["research ", "look up ", "investigate "],
            reason: "Matched the research capability registry.",
        },
        CapabilityRoute {
            id: "finance.readonly",
            label: "Finance Read-only",
            agent: GatewayAgentKind::Finance,
            tier: GatewayModelTier::Embed,
            keywords: &[
                "how much did i spend",
                "weekly expenses",
                "monthly expenses",
                "expense summary",
                "spending report",
                "finance summary",
            ],
            reason: "Matched the read-only finance capability registry.",
        },
        CapabilityRoute {
            id: "writer.draft",
            label: "Writer",
            agent: GatewayAgentKind::Writer,
            tier: GatewayModelTier::Worker,
            keywords: &[
                "draft ",
                "write a note",
                "summarize for notion",
                "compose ",
            ],
            reason: "Matched the writer capability registry.",
        },
        CapabilityRoute {
            id: "command.clipboard",
            label: "Clipboard",
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            keywords: &[
                "clipboard",
                "copy to clipboard",
                "paste from clipboard",
                "read clipboard",
            ],
            reason: "Matched the clipboard capability registry.",
        },
    ]
}

fn score_capability(command: &str, capability: &CapabilityRoute) -> u32 {
    if capability.id == "supervisor.delegate" && command.contains(" then ") {
        return 10;
    }
    capability
        .keywords
        .iter()
        .filter(|keyword| command.contains(**keyword))
        .map(|keyword| if keyword.contains(' ') { 3 } else { 1 })
        .sum()
}

fn contains_any(command: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| command.contains(needle))
}

fn confidence_for_score(score: u32) -> GatewayConfidenceBand {
    if score >= 3 {
        return GatewayConfidenceBand::High;
    }
    if score >= 1 {
        return GatewayConfidenceBand::Medium;
    }
    GatewayConfidenceBand::Low
}

fn decision_for_route(
    confidence: &GatewayConfidenceBand,
    sensitivity: &GatewaySensitivity,
    capability_id: &str,
) -> (GatewayDecisionPolicy, String) {
    match (confidence, sensitivity) {
        (GatewayConfidenceBand::Low, _) => (
            GatewayDecisionPolicy::Teach,
            "Low confidence route. Ask the user what this should mean.".to_string(),
        ),
        (GatewayConfidenceBand::Medium, _) => (
            GatewayDecisionPolicy::Confirm,
            "Medium confidence route. Confirm before acting.".to_string(),
        ),
        (GatewayConfidenceBand::High, GatewaySensitivity::Secret) => (
            GatewayDecisionPolicy::Confirm,
            "High confidence but secret-sensitive. Confirm before handling credentials."
                .to_string(),
        ),
        (GatewayConfidenceBand::High, GatewaySensitivity::Personal) => (
            GatewayDecisionPolicy::Confirm,
            "High confidence but personal-data-sensitive. Confirm before acting.".to_string(),
        ),
        (GatewayConfidenceBand::High, GatewaySensitivity::Public)
            if capability_id == "command.desktop" =>
        {
            (
                GatewayDecisionPolicy::Confirm,
                "Desktop control can affect open apps. Confirm before acting.".to_string(),
            )
        }
        (GatewayConfidenceBand::High, GatewaySensitivity::Public) => (
            GatewayDecisionPolicy::Execute,
            "High confidence public route. Safe to execute when gateway takeover is enabled."
                .to_string(),
        ),
    }
}

fn route_priority(agent: &GatewayAgentKind) -> u8 {
    match agent {
        GatewayAgentKind::Supervisor => 6,
        GatewayAgentKind::Builder => 5,
        GatewayAgentKind::Vision => 4,
        GatewayAgentKind::Automation => 4,
        GatewayAgentKind::Research => 4,
        GatewayAgentKind::Writer => 3,
        GatewayAgentKind::Integrations => 3,
        GatewayAgentKind::Finance => 2,
        GatewayAgentKind::Memory => 2,
        GatewayAgentKind::Command => 1,
    }
}

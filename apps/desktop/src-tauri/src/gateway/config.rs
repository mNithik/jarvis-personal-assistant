use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

use super::mcp::McpHostEntry;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum GatewayMode {
    #[default]
    Execute,
    DryRun,
    PlanOnly,
}

impl GatewayMode {
    pub fn allows_mutations(&self) -> bool {
        matches!(self, GatewayMode::Execute)
    }

    pub fn is_simulation(&self) -> bool {
        !self.allows_mutations()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct GatewayFeatures {
    pub study_routine: bool,
    pub screen_ocr: bool,
    pub gmail: bool,
    pub notion: bool,
    pub spotify: bool,
    pub calendar: bool,
    pub ocr_notion: bool,
    pub email_notion: bool,
    pub memory: bool,
    pub builder: bool,
}

impl Default for GatewayFeatures {
    fn default() -> Self {
        Self {
            study_routine: false,
            screen_ocr: false,
            gmail: false,
            notion: false,
            spotify: false,
            calendar: false,
            ocr_notion: false,
            email_notion: false,
            memory: false,
            builder: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct GatewayRoutingConfig {
    pub l2_enabled: bool,
    pub prefer_local_for_personal: bool,
    pub jarvis_router_enabled: bool,
}

impl Default for GatewayRoutingConfig {
    fn default() -> Self {
        Self {
            l2_enabled: false,
            prefer_local_for_personal: true,
            jarvis_router_enabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum GatewaySttProvider {
    #[default]
    Browser,
    Local,
    Groq,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct GatewayVoiceConfig {
    pub stt_provider: GatewaySttProvider,
    pub talker_enabled: bool,
}

impl Default for GatewayVoiceConfig {
    fn default() -> Self {
        Self {
            stt_provider: GatewaySttProvider::Browser,
            talker_enabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct GatewayQuotaConfig {
    pub groq_daily_requests: u32,
    pub openrouter_daily_requests: u32,
    pub nvidia_nim_daily_requests: u32,
    pub cerebras_daily_requests: u32,
}

impl Default for GatewayQuotaConfig {
    fn default() -> Self {
        Self {
            groq_daily_requests: 100,
            openrouter_daily_requests: 100,
            nvidia_nim_daily_requests: 100,
            cerebras_daily_requests: 100,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct GatewayBudgetConfig {
    pub max_steps_per_turn: u32,
    pub max_wall_time_seconds: u32,
    pub max_retries_per_step: u32,
    pub max_mcp_payload_bytes: u32,
}

impl Default for GatewayBudgetConfig {
    fn default() -> Self {
        Self {
            max_steps_per_turn: 12,
            max_wall_time_seconds: 120,
            max_retries_per_step: 2,
            max_mcp_payload_bytes: 256 * 1024,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct GatewayProactiveConfig {
    pub heartbeat_enabled: bool,
    pub heartbeat_interval_minutes: u32,
    pub morning_brief_enabled: bool,
    pub morning_brief_time: String,
    pub ocr_watch_tick_enabled: bool,
}

impl Default for GatewayProactiveConfig {
    fn default() -> Self {
        Self {
            heartbeat_enabled: false,
            heartbeat_interval_minutes: 30,
            morning_brief_enabled: false,
            morning_brief_time: "07:30".to_string(),
            ocr_watch_tick_enabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct GatewayKnowledgeConfig {
    pub local_vault_path: Option<String>,
    pub obsidian_host_id: Option<String>,
    pub readwise_csv_path: Option<String>,
    pub zotero_bib_path: Option<String>,
}

impl Default for GatewayKnowledgeConfig {
    fn default() -> Self {
        Self {
            local_vault_path: None,
            obsidian_host_id: None,
            readwise_csv_path: None,
            zotero_bib_path: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct GatewayChannelsConfig {
    pub local_ws_enabled: bool,
    pub local_ws_port: u16,
    pub local_ws_token: Option<String>,
    pub telegram_enabled: bool,
    pub telegram_bot_token: Option<String>,
    pub discord_enabled: bool,
    pub discord_bot_token: Option<String>,
}

impl Default for GatewayChannelsConfig {
    fn default() -> Self {
        Self {
            local_ws_enabled: false,
            local_ws_port: 18789,
            local_ws_token: None,
            telegram_enabled: false,
            telegram_bot_token: None,
            discord_enabled: false,
            discord_bot_token: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct GatewayPaidModeConfig {
    pub enabled: bool,
    /// Hard cap on paid-provider requests per day (0 = paid mode off).
    pub max_daily_requests: u32,
    pub require_user_opt_in: bool,
}

impl Default for GatewayPaidModeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            max_daily_requests: 0,
            require_user_opt_in: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct GatewayTrainingConfig {
    pub export_enabled: bool,
    pub eval_min_accuracy_pct: u32,
}

impl Default for GatewayTrainingConfig {
    fn default() -> Self {
        Self {
            export_enabled: false,
            eval_min_accuracy_pct: 95,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct GatewayConfig {
    pub enabled: bool,
    pub mode: GatewayMode,
    pub features: GatewayFeatures,
    pub correlation_prefix: String,
    pub routing: GatewayRoutingConfig,
    pub voice: GatewayVoiceConfig,
    pub quotas: GatewayQuotaConfig,
    pub budgets: GatewayBudgetConfig,
    pub proactive: GatewayProactiveConfig,
    pub knowledge: GatewayKnowledgeConfig,
    pub channels: GatewayChannelsConfig,
    pub training: GatewayTrainingConfig,
    pub paid: GatewayPaidModeConfig,
    pub mcp_hosts: Vec<McpHostEntry>,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            mode: GatewayMode::Execute,
            features: GatewayFeatures::default(),
            correlation_prefix: "jarvis".to_string(),
            routing: GatewayRoutingConfig::default(),
            voice: GatewayVoiceConfig::default(),
            quotas: GatewayQuotaConfig::default(),
            budgets: GatewayBudgetConfig::default(),
            proactive: GatewayProactiveConfig::default(),
            knowledge: GatewayKnowledgeConfig::default(),
            channels: GatewayChannelsConfig::default(),
            training: GatewayTrainingConfig::default(),
            paid: GatewayPaidModeConfig::default(),
            mcp_hosts: Vec::new(),
        }
    }
}

/// Default for fresh installs: gateway on with core features, local-first quotas.
pub fn gateway_default_install_preset() -> GatewayConfig {
    GatewayConfig {
        enabled: true,
        mode: GatewayMode::Execute,
        features: GatewayFeatures {
            study_routine: true,
            screen_ocr: true,
            memory: true,
            builder: true,
            ..GatewayFeatures::default()
        },
        routing: GatewayRoutingConfig {
            l2_enabled: false,
            prefer_local_for_personal: true,
            jarvis_router_enabled: false,
        },
        proactive: GatewayProactiveConfig {
            heartbeat_enabled: true,
            heartbeat_interval_minutes: 30,
            morning_brief_enabled: true,
            morning_brief_time: "07:30".to_string(),
            ocr_watch_tick_enabled: true,
        },
        paid: GatewayPaidModeConfig::default(),
        ..GatewayConfig::default()
    }
}

/// Safe onboarding preset: gateway on in dry-run with proactive jobs and local turn API.
pub fn gateway_easy_mode_preset() -> GatewayConfig {
    GatewayConfig {
        enabled: true,
        mode: GatewayMode::DryRun,
        features: GatewayFeatures {
            study_routine: true,
            screen_ocr: true,
            memory: true,
            ..GatewayFeatures::default()
        },
        proactive: GatewayProactiveConfig {
            heartbeat_enabled: true,
            heartbeat_interval_minutes: 30,
            morning_brief_enabled: true,
            morning_brief_time: "07:30".to_string(),
            ocr_watch_tick_enabled: true,
        },
        channels: GatewayChannelsConfig {
            local_ws_enabled: true,
            local_ws_port: 18789,
            ..GatewayChannelsConfig::default()
        },
        ..GatewayConfig::default()
    }
}

pub fn gateway_config_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("gateway.json")
}

pub fn load_gateway_config(app_data_dir: &Path) -> GatewayConfig {
    let path = gateway_config_path(app_data_dir);
    if !path.exists() {
        if std::env::var("JARVIS_GATEWAY_EASY")
            .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
        {
            return gateway_easy_mode_preset();
        }
        return gateway_default_install_preset();
    }

    let raw = match fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(_) => return GatewayConfig::default(),
    };

    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn ensure_default_gateway_config(app_data_dir: &Path) -> GatewayConfig {
    let path = gateway_config_path(app_data_dir);
    if path.exists() {
        return load_gateway_config(app_data_dir);
    }
    let config = if std::env::var("JARVIS_GATEWAY_EASY")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
    {
        gateway_easy_mode_preset()
    } else {
        gateway_default_install_preset()
    };
    let _ = save_gateway_config(app_data_dir, &config);
    config
}

pub fn save_gateway_config(app_data_dir: &Path, config: &GatewayConfig) -> Result<(), String> {
    fs::create_dir_all(app_data_dir).map_err(|error| error.to_string())?;
    let path = gateway_config_path(app_data_dir);
    let raw = serde_json::to_string_pretty(config).map_err(|error| error.to_string())?;
    fs::write(path, raw).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::mcp::McpHostEntry;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("jarvis-gateway-config-{nanos}"))
    }

    #[test]
    fn round_trips_gateway_config() {
        let dir = temp_dir();
        let config = GatewayConfig {
            mode: GatewayMode::PlanOnly,
            routing: GatewayRoutingConfig {
                l2_enabled: true,
                prefer_local_for_personal: true,
                jarvis_router_enabled: false,
            },
            voice: GatewayVoiceConfig {
                stt_provider: GatewaySttProvider::Groq,
                talker_enabled: true,
            },
            ..GatewayConfig::default()
        };

        save_gateway_config(&dir, &config).expect("save config");
        let loaded = load_gateway_config(&dir);
        assert_eq!(loaded, config);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn default_gateway_mode_is_execute() {
        assert_eq!(GatewayConfig::default().mode, GatewayMode::Execute);
    }

    #[test]
    fn default_install_preset_enables_gateway() {
        let preset = gateway_default_install_preset();
        assert!(preset.enabled);
        assert_eq!(preset.mode, GatewayMode::Execute);
        assert!(preset.features.memory);
        assert!(preset.features.screen_ocr);
    }

    #[test]
    fn ensure_default_gateway_config_seeds_file() {
        let dir = temp_dir();
        let config = ensure_default_gateway_config(&dir);
        assert!(config.enabled);
        assert!(gateway_config_path(&dir).exists());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn default_gateway_budgets_match_robustness_plan() {
        let budgets = GatewayConfig::default().budgets;
        assert_eq!(budgets.max_steps_per_turn, 12);
        assert_eq!(budgets.max_wall_time_seconds, 120);
        assert_eq!(budgets.max_retries_per_step, 2);
        assert_eq!(budgets.max_mcp_payload_bytes, 256 * 1024);
    }

    #[test]
    fn round_trips_external_mcp_host_descriptors() {
        let dir = temp_dir();
        let config = GatewayConfig {
            mcp_hosts: vec![McpHostEntry {
                id: "obsidian-local".to_string(),
                label: "Obsidian local MCP".to_string(),
                transport: "stdio".to_string(),
                command: Some("obsidian-mcp".to_string()),
                read_only: true,
                external: true,
                env: std::collections::HashMap::new(),
            }],
            ..GatewayConfig::default()
        };

        save_gateway_config(&dir, &config).expect("save config");
        let loaded = load_gateway_config(&dir);
        assert_eq!(loaded.mcp_hosts, config.mcp_hosts);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn defaults_when_file_missing() {
        let dir = temp_dir();
        assert_eq!(load_gateway_config(&dir), gateway_default_install_preset());
        let _ = fs::remove_dir_all(dir);
    }
}

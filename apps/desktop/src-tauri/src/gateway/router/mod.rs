mod l0;
mod l0_5;
mod l1;
mod l1_5;
mod l2;
mod l3;

pub use l3::{replan_supervisor_step, verify_with_builder};

use l0::{classify_sensitivity, default_route, normalize_command, route_l0};
use l0_5::route_l0_5;

use crate::gateway::{
    config::GatewayConfig,
    types::{GatewayModelTier, GatewayRoute, TurnRequest},
};

#[derive(Debug, Clone)]
pub struct RouterContext {
    pub db_path: Option<std::path::PathBuf>,
    pub app_data_dir: Option<std::path::PathBuf>,
    pub config: GatewayConfig,
}

pub fn route_turn(request: &TurnRequest, context: &RouterContext) -> GatewayRoute {
    let command = request.command.as_str();
    let route = route_turn_internal(command, context);
    finalize_route(route, &context.config)
}

fn route_turn_internal(command: &str, context: &RouterContext) -> GatewayRoute {
    if let Some(route) = route_l0(command) {
        return route;
    }
    if let (Some(db_path), Some(app_data_dir)) =
        (context.db_path.as_deref(), context.app_data_dir.as_deref())
    {
        if let Some(skill) =
            crate::gateway::skills::match_dynamic_skill(command, db_path, app_data_dir)
        {
            return GatewayRoute {
                capability_id: "platform.skill".to_string(),
                capability_label: format!("Installed Skill: {}", skill.label),
                agent: crate::gateway::types::GatewayAgentKind::Command,
                tier: crate::gateway::types::GatewayModelTier::Local,
                sensitivity: classify_sensitivity(&normalize_command(command)),
                score: 3,
                confidence: crate::gateway::types::GatewayConfidenceBand::High,
                decision_policy: crate::gateway::types::GatewayDecisionPolicy::Execute,
                decision_reason:
                    "Matched an installed skill keyword at runtime. Safe to execute when gateway takeover is enabled."
                        .to_string(),
                reason: format!(
                    "Matched installed skill \"{}\" from app_data/skills at runtime.",
                    skill.id
                ),
                route_level: crate::gateway::types::RouteLevel::L0,
                resolved_provider: None,
            };
        }
    }
    if let Some(route) = route_l0_5(command) {
        return route;
    }
    if let Some(db_path) = context.db_path.as_deref() {
        if let Some(route) = l1::route_l1(command, db_path) {
            return route;
        }
    }
    if let Some(route) = l1_5::route_l1_5(command) {
        return route;
    }
    if context.config.routing.l2_enabled {
        if let Some(db_path) = context.db_path.as_deref() {
            if let Some(route) = l2::route_l2(command, db_path, &context.config) {
                return route;
            }
        }
        return degraded_l2_fallback(command);
    }

    default_route(classify_sensitivity(&normalize_command(command)))
}

fn degraded_l2_fallback(command: &str) -> GatewayRoute {
    let normalized = normalize_command(command);
    let mut route = default_route(classify_sensitivity(&normalized));
    route.reason = format!(
        "{} Ollama L2 router degraded mode: L2 routing was enabled, but Ollama was unavailable, unconfigured, or returned no usable route.",
        route.reason
    );
    route
}

fn finalize_route(mut route: GatewayRoute, config: &GatewayConfig) -> GatewayRoute {
    let resolved = crate::providers::resolve_provider(&route, config);
    route.resolved_provider = Some(resolved.provider_id.clone());
    if resolved.forced_local {
        route.tier = GatewayModelTier::Local;
    }
    route
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    use crate::gateway::profiles::{seed_default_profiles, switch_profile};
    use crate::gateway::types::{
        GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewaySensitivity,
        RouteLevel, TurnSource,
    };

    fn context() -> RouterContext {
        RouterContext {
            db_path: None,
            app_data_dir: None,
            config: GatewayConfig::default(),
        }
    }

    fn request(command: &str) -> TurnRequest {
        TurnRequest {
            session_id: None,
            command: command.to_string(),
            source: Some(TurnSource::Text),
            idempotency_key: None,
        }
    }

    fn write_skill(
        dir: &std::path::Path,
        id: &str,
        label: &str,
        keywords: &[&str],
    ) -> Result<(), String> {
        let skill_dir = dir.join(id);
        fs::create_dir_all(&skill_dir).map_err(|error| error.to_string())?;
        let manifest = crate::gateway::skills::SkillManifest {
            id: id.to_string(),
            version: "1.0.0".to_string(),
            label: label.to_string(),
            keywords: keywords.iter().map(|keyword| keyword.to_string()).collect(),
            agent: "command".to_string(),
            permissions: vec!["read".to_string()],
            enabled: true,
            handler: crate::gateway::skills::SkillHandler::Route {
                capability_id: "command.general".to_string(),
            },
        };
        let raw = serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
        fs::write(skill_dir.join("skill.json"), raw).map_err(|error| error.to_string())
    }

    #[test]
    fn routes_screen_commands_to_vision_l0() {
        let route = route_turn(&request("Read my screen"), &context());
        assert_eq!(route.agent, GatewayAgentKind::Vision);
        assert_eq!(route.capability_id, "vision.ocr");
        assert_eq!(route.route_level, RouteLevel::L0);
        assert_eq!(route.confidence, GatewayConfidenceBand::High);
        assert_eq!(route.decision_policy, GatewayDecisionPolicy::Execute);
    }

    #[test]
    fn routes_spotify_commands_l0() {
        let route = route_turn(&request("Play this song on Spotify"), &context());
        assert_eq!(route.agent, GatewayAgentKind::Integrations);
        assert_eq!(route.capability_id, "integrations.spotify");
        assert_eq!(route.route_level, RouteLevel::L0);
    }

    #[test]
    fn routes_notion_commands_l0() {
        let route = route_turn(&request("Save this task to Notion"), &context());
        assert_eq!(route.capability_id, "integrations.notion");
        assert_eq!(route.decision_policy, GatewayDecisionPolicy::Confirm);
    }

    #[test]
    fn routes_coding_commands_to_builder_l0() {
        let route = route_turn(&request("Debug this repo"), &context());
        assert_eq!(route.agent, GatewayAgentKind::Builder);
        assert_eq!(route.capability_id, "builder.code");
    }

    #[test]
    fn routes_open_chrome_l0() {
        let route = route_turn(&request("Open Chrome"), &context());
        assert_eq!(route.capability_id, "command.desktop");
    }

    #[test]
    fn falls_back_to_general_command() {
        let route = route_turn(&request("What should I do next?"), &context());
        assert_eq!(route.capability_id, "command.general");
        assert_eq!(route.route_level, RouteLevel::Fallback);
        assert_eq!(route.confidence, GatewayConfidenceBand::Low);
    }

    #[test]
    fn routes_study_setup_l0() {
        let route = route_turn(&request("launch study setup"), &context());
        assert_eq!(route.capability_id, "command.study");
    }

    #[test]
    fn routes_google_search_l0() {
        let route = route_turn(&request("search google for rust"), &context());
        assert_eq!(route.capability_id, "command.search");
    }

    #[test]
    fn routes_slack_summary_l0() {
        let route = route_turn(&request("summarize slack channel #general"), &context());
        assert_eq!(route.capability_id, "integrations.slack_read");
    }

    #[test]
    fn routes_slack_send_l0() {
        let route = route_turn(&request("send this to slack #general"), &context());
        assert_eq!(route.capability_id, "integrations.slack_send");
    }

    #[test]
    fn routes_recent_files_to_file_capability_l0() {
        let route = route_turn(&request("show recent files"), &context());

        assert_eq!(route.capability_id, "command.files");
        assert_eq!(route.route_level, RouteLevel::L0);
        assert_eq!(route.agent, GatewayAgentKind::Command);
    }

    #[test]
    fn routes_pdf_list_and_search_to_file_capability_l0() {
        let list_route = route_turn(&request("list pdfs"), &context());
        let search_route = route_turn(&request("search pdfs for taxes"), &context());

        assert_eq!(list_route.capability_id, "command.files");
        assert_eq!(search_route.capability_id, "command.files");
        assert_eq!(list_route.route_level, RouteLevel::L0);
        assert_eq!(search_route.route_level, RouteLevel::L0);
    }

    #[test]
    fn routes_pdf_open_and_read_to_file_capability_l0() {
        let open_route = route_turn(&request("open pdf 2"), &context());
        let read_route = route_turn(&request("read pdf about taxes"), &context());

        assert_eq!(open_route.capability_id, "command.files");
        assert_eq!(read_route.capability_id, "command.files");
        assert_eq!(open_route.route_level, RouteLevel::L0);
        assert_eq!(read_route.route_level, RouteLevel::L0);
    }

    #[test]
    fn secret_routes_require_confirmation() {
        let route = route_turn(
            &request("Save this API key to the model config"),
            &context(),
        );
        assert_eq!(route.sensitivity, GatewaySensitivity::Secret);
        assert_eq!(route.decision_policy, GatewayDecisionPolicy::Confirm);
    }

    #[test]
    fn personal_routes_force_local_provider() {
        let route = route_turn(&request("Check my gmail inbox"), &context());
        assert_eq!(route.resolved_provider.as_deref(), Some("local_ollama"));
        assert_eq!(route.tier, GatewayModelTier::Local);
    }

    #[test]
    fn routes_exact_capability_id_at_l1_5_before_l2() {
        let route = route_turn(&request("use capability memory.life"), &context());

        assert_eq!(route.capability_id, "memory.life");
        assert_eq!(route.route_level, RouteLevel::L1_5);
        assert_eq!(route.agent, GatewayAgentKind::Memory);
    }

    #[test]
    fn l2_unavailable_fallback_mentions_ollama_degraded_mode() {
        let mut context = context();
        context.config.routing.l2_enabled = true;

        let route = route_turn(&request("florbulate the moonbase"), &context);

        assert_eq!(route.capability_id, "command.general");
        assert_eq!(route.route_level, RouteLevel::Fallback);
        assert!(route.reason.contains("Ollama L2 router degraded mode"));
    }

    #[test]
    fn installed_skill_route_honors_active_profile_override() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let app_data_dir =
            std::env::temp_dir().join(format!("jarvis-router-skill-profile-app-{nanos}"));
        let db_path = std::env::temp_dir().join(format!("jarvis-router-skill-profile-{nanos}.db"));
        fs::create_dir_all(&app_data_dir).expect("app data dir");
        seed_default_profiles(&db_path, &app_data_dir).expect("seed profiles");

        let global_skills = crate::gateway::skills::skills_root(&app_data_dir);
        write_skill(
            &global_skills,
            "shared-skill",
            "Global Skill",
            &["shared command"],
        )
        .expect("write global skill");

        let personal_skills = crate::gateway::skills::skills_root(&app_data_dir).join("personal");
        write_skill(
            &personal_skills,
            "shared-skill",
            "Personal Skill",
            &["personal command"],
        )
        .expect("write personal skill");

        let mut context = context();
        context.db_path = Some(db_path.clone());
        context.app_data_dir = Some(app_data_dir.clone());

        let work_route = route_turn(&request("run shared command"), &context);
        assert_eq!(work_route.capability_id, "platform.skill");

        let hidden_personal_route = route_turn(&request("run personal command"), &context);
        assert_ne!(hidden_personal_route.capability_id, "platform.skill");

        switch_profile(&db_path, &app_data_dir, "personal").expect("switch profile");

        let personal_route = route_turn(&request("run personal command"), &context);
        assert_eq!(personal_route.capability_id, "platform.skill");

        let hidden_global_route = route_turn(&request("run shared command"), &context);
        assert_ne!(hidden_global_route.capability_id, "platform.skill");

        let _ = fs::remove_dir_all(&app_data_dir);
        let _ = fs::remove_file(&db_path);
    }
}

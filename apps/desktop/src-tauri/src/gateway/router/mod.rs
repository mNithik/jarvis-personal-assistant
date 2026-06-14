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
            if let Some(route) = l2::route_l2(command, db_path) {
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
    use crate::gateway::types::{
        GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewaySensitivity,
        RouteLevel, TurnSource,
    };

    fn context() -> RouterContext {
        RouterContext {
            db_path: None,
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
        let route = route_turn(&request("Save this API key to the model config"), &context());
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
}

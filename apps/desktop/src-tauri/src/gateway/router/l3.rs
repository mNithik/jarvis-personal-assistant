use crate::gateway::types::{GatewayAgentKind, GatewayRoute, RouteLevel, TurnRequest};

use super::{route_turn, RouterContext};

/// L3: supervisor re-plans a failed sub-step by re-routing the step command.
pub fn replan_supervisor_step(
    failed_command: &str,
    context: &RouterContext,
) -> Option<GatewayRoute> {
    let route = route_turn(
        &TurnRequest {
            session_id: None,
            command: failed_command.to_string(),
            source: None,
            idempotency_key: None,
        },
        context,
    );
    if route.route_level == RouteLevel::Fallback {
        return None;
    }
    Some(route)
}

/// L4: verify step output by routing a lightweight check through Builder when Command failed.
pub fn verify_with_builder(
    original_command: &str,
    context: &RouterContext,
) -> Option<GatewayRoute> {
    let verify_command = format!("debug this repo: {original_command}");
    let route = route_turn(
        &TurnRequest {
            session_id: None,
            command: verify_command,
            source: None,
            idempotency_key: None,
        },
        context,
    );
    if route.agent == GatewayAgentKind::Builder {
        Some(GatewayRoute {
            route_level: RouteLevel::L4,
            ..route
        })
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::config::GatewayConfig;

    #[test]
    fn replans_open_chrome_substep() {
        let context = RouterContext {
            db_path: None,
            config: GatewayConfig::default(),
        };
        let route = replan_supervisor_step("open chrome", &context).expect("route");
        assert_eq!(route.capability_id, "command.desktop");
        assert_eq!(route.route_level, RouteLevel::L0);
    }
}

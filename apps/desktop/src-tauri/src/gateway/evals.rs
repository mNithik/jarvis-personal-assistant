#[cfg(test)]
mod tests {
    use std::fs;

    use serde::Deserialize;

    use crate::gateway::router::{route_turn, RouterContext};
    use crate::gateway::types::TurnRequest;

    #[derive(Debug, Deserialize)]
    struct GoldenEvalCase {
        phrase: String,
        #[serde(rename = "capabilityId")]
        capability_id: String,
    }

    fn eval_path(name: &str) -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("tests")
            .join("evals")
            .join(name)
    }

    fn run_golden_file(file_name: &str) {
        let path = eval_path(file_name);
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
        let cases: Vec<GoldenEvalCase> =
            serde_json::from_str(&raw).expect("golden eval json should parse");
        assert!(
            cases.len() >= 3,
            "{} should contain at least 3 golden cases",
            file_name
        );

        let context = RouterContext {
            db_path: None,
            config: crate::gateway::config::GatewayConfig::default(),
        };

        for case in cases {
            let route = route_turn(
                &TurnRequest {
                    session_id: None,
                    command: case.phrase.clone(),
                    source: None,
                    idempotency_key: None,
                },
                &context,
            );
            assert_eq!(
                route.capability_id, case.capability_id,
                "phrase {:?} expected capability {}",
                case.phrase, case.capability_id
            );
        }
    }

    #[test]
    fn eval_golden_f3_study_routes() {
        run_golden_file("f3_study.json");
    }

    #[test]
    fn eval_golden_f7_screen_routes() {
        run_golden_file("f7_screen.json");
    }

    #[test]
    fn eval_golden_f13_notion_routes() {
        run_golden_file("f13_notion.json");
    }

    #[test]
    fn eval_golden_f14_spotify_routes() {
        run_golden_file("f14_spotify.json");
    }

    #[test]
    fn eval_golden_f10_gmail_routes() {
        run_golden_file("f10_gmail.json");
    }

    #[test]
    fn eval_golden_f12_calendar_routes() {
        run_golden_file("f12_calendar.json");
    }

    #[test]
    fn eval_golden_f8_ocr_notion_routes() {
        run_golden_file("f8_ocr_notion.json");
    }

    #[test]
    fn eval_golden_f11_email_notion_routes() {
        run_golden_file("f11_email_notion.json");
    }

    #[test]
    fn eval_golden_f15_memory_routes() {
        run_golden_file("f15_memory.json");
    }

    #[test]
    fn eval_golden_f16_memory_routes() {
        run_golden_file("f16_memory.json");
    }

    #[test]
    fn eval_golden_f17_memory_routes() {
        run_golden_file("f17_memory.json");
    }

    #[test]
    fn eval_golden_f18_daily_brief_routes() {
        run_golden_file("f18_daily_brief.json");
    }

    #[test]
    fn eval_golden_f18_memory_hardening_routes() {
        run_golden_file("f18_memory_hardening.json");
    }

    #[test]
    fn eval_golden_f22_builder_routes() {
        run_golden_file("f22_builder.json");
    }

    #[test]
    fn eval_golden_f22_debug_repo_routes() {
        run_golden_file("f22_debug_repo.json");
    }

    #[test]
    fn eval_golden_f_memory_recall_routes() {
        run_golden_file("f_memory_recall_routes.json");
    }

    #[test]
    fn eval_golden_f_supervisor_routes() {
        run_golden_file("f_supervisor_routes.json");
    }

    #[test]
    fn eval_golden_f_automation_routes() {
        run_golden_file("f_automation_routes.json");
    }

    #[test]
    fn eval_golden_f_vault_routes() {
        run_golden_file("f_vault_routes.json");
    }

    #[test]
    fn eval_golden_f_mcp_routes() {
        run_golden_file("f_mcp_routes.json");
    }

    #[test]
    fn eval_golden_f_research_routes() {
        run_golden_file("f_research_routes.json");
    }

    #[test]
    fn eval_golden_f_finance_routes() {
        run_golden_file("f_finance_routes.json");
    }

    #[test]
    fn eval_golden_f_writer_routes() {
        run_golden_file("f_writer_routes.json");
    }

    #[test]
    fn eval_golden_f_telegram_routes() {
        run_golden_file("f_telegram.json");
    }

    #[test]
    fn eval_golden_f_obsidian_live_routes() {
        run_golden_file("f_obsidian_live.json");
    }

    #[test]
    fn eval_golden_f_brief_v2_routes() {
        run_golden_file("f_brief_v2.json");
    }

    #[test]
    fn eval_golden_f_l3_supervisor_routes() {
        run_golden_file("f_l3_supervisor.json");
    }

    #[test]
    fn dry_run_mode_routes_study_without_legacy() {
        use crate::gateway::config::{GatewayConfig, GatewayMode};
        use crate::gateway::orchestrator::{GatewayOrchestrator, TurnExecutionEnv};
        use crate::gateway::types::TurnSource;
        use crate::providers::escalation::EscalationTracker;

        let mut bus = crate::gateway::bus::EventBus::default();
        let mut escalation = EscalationTracker::default();
        let db_path = std::env::temp_dir().join(format!("jarvis-eval-dry-run-{}", std::process::id()));
        let _ = std::fs::remove_file(&db_path);
        crate::db::init_database(&db_path).expect("init db");

        let mut config = GatewayConfig::default();
        config.enabled = true;
        config.mode = GatewayMode::DryRun;
        config.features.study_routine = true;

        let app_data_dir = std::env::temp_dir();
        let execution = TurnExecutionEnv {
            db_path: &db_path,
            app_data_dir: &app_data_dir,
            escalation: &mut escalation,
        };
        let response = GatewayOrchestrator::run_turn(
            TurnRequest {
                session_id: Some("eval-session".to_string()),
                command: "launch study setup".to_string(),
                source: Some(TurnSource::Text),
                idempotency_key: None,
            },
            42,
            "eval-session",
            &config,
            &RouterContext {
                db_path: Some(db_path.clone()),
                config: config.clone(),
            },
            &mut bus,
            None,
            Some(execution),
        );
        assert!(!response.result.legacy);
        assert!(response.result.reply.to_lowercase().contains("dry run"));
        let _ = std::fs::remove_file(db_path);
    }

    fn run_dry_run_turn(command: &str, configure: impl FnOnce(&mut crate::gateway::config::GatewayConfig)) -> crate::gateway::orchestrator::GatewayTurnResponse {
        use crate::gateway::config::GatewayConfig;
        use crate::gateway::config::GatewayMode;
        use crate::gateway::orchestrator::{GatewayOrchestrator, TurnExecutionEnv};
        use crate::gateway::types::{TurnRequest, TurnSource};
        use crate::providers::escalation::EscalationTracker;

        let mut bus = crate::gateway::bus::EventBus::default();
        let mut escalation = EscalationTracker::default();
        let db_path = std::env::temp_dir().join(format!(
            "jarvis-eval-dry-run-{}-{}",
            std::process::id(),
            command.len()
        ));
        let _ = std::fs::remove_file(&db_path);
        crate::db::init_database(&db_path).expect("init db");

        let mut config = GatewayConfig::default();
        config.enabled = true;
        config.mode = GatewayMode::DryRun;
        configure(&mut config);

        let app_data_dir = std::env::temp_dir();
        let execution = TurnExecutionEnv {
            db_path: &db_path,
            app_data_dir: &app_data_dir,
            escalation: &mut escalation,
        };
        let response = GatewayOrchestrator::run_turn(
            TurnRequest {
                session_id: Some("eval-session".to_string()),
                command: command.to_string(),
                source: Some(TurnSource::Text),
                idempotency_key: None,
            },
            42,
            "eval-session",
            &config,
            &RouterContext {
                db_path: Some(db_path.clone()),
                config: config.clone(),
            },
            &mut bus,
            None,
            Some(execution),
        );
        let _ = std::fs::remove_file(db_path);
        response
    }

    #[test]
    fn eval_golden_f_dry_run_simulation_routes() {
        run_golden_file("f_dry_run_simulation.json");
    }

    #[test]
    fn dry_run_supervisor_plans_two_steps_without_legacy() {
        let response = run_dry_run_turn("open chrome then read screen", |config| {
            config.features.screen_ocr = true;
        });
        assert!(!response.result.legacy);
        assert!(response.result.reply.to_lowercase().contains("dry run"));
        assert!(response.result.reply.contains("1."));
        assert!(response.result.reply.contains("2."));
    }

    #[test]
    fn dry_run_confirm_route_requires_approval_before_planning() {
        let response = run_dry_run_turn("open chrome", |_| {});
        assert!(response.awaiting_approval);
        assert!(
            !response
                .events
                .iter()
                .any(|event| event.kind == crate::gateway::types::GatewayEventKind::ToolStart)
        );
    }

    #[test]
    fn dry_run_emits_budget_and_quota_trace_events() {
        let response = run_dry_run_turn("launch study setup", |config| {
            config.features.study_routine = true;
        });
        assert!(
            response
                .events
                .iter()
                .any(|event| event.message.contains("Turn budgets"))
        );
        assert!(
            response
                .events
                .iter()
                .any(|event| event.message.contains("Provider quota"))
        );
    }
}

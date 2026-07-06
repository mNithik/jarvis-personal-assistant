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
            app_data_dir: None,
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

    fn run_skill_golden_file(file_name: &str) {
        use crate::db::init_database;
        use crate::gateway::skills::install_fixture_skill;

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

        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let db_path = std::env::temp_dir().join(format!("jarvis-skill-golden-db-{nanos}"));
        let app_data_dir = std::env::temp_dir().join(format!("jarvis-skill-golden-app-{nanos}"));
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_dir_all(&app_data_dir);
        std::fs::create_dir_all(&app_data_dir).expect("skill golden app dir");
        init_database(&db_path).expect("skill golden db");
        install_fixture_skill(&app_data_dir).expect("fixture skill");

        let context = RouterContext {
            db_path: Some(db_path.clone()),
            app_data_dir: Some(app_data_dir.clone()),
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

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(app_data_dir);
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
    fn eval_golden_f_meeting_copilot_routes() {
        run_golden_file("f_meeting_copilot_routes.json");
    }

    #[test]
    fn eval_golden_f_mission_control_routes() {
        run_golden_file("f_mission_control_routes.json");
    }

    #[test]
    fn eval_golden_f_email_copilot_routes() {
        run_golden_file("f_email_copilot_routes.json");
    }

    #[test]
    fn eval_golden_f_planner_copilot_routes() {
        run_golden_file("f_planner_copilot_routes.json");
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
    fn eval_golden_f_builder_terminal_routes() {
        run_golden_file("f_builder_terminal_routes.json");
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
    fn eval_golden_f_clipboard_routes() {
        run_golden_file("f_clipboard_routes.json");
    }

    #[test]
    fn eval_golden_f_pdf_routes() {
        run_golden_file("f_pdf_routes.json");
    }

    #[test]
    fn eval_golden_f_files_routes() {
        run_golden_file("f_files_routes.json");
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

    #[derive(Debug, Deserialize)]
    struct FabricIndexEntry {
        id: String,
        eval: Option<String>,
        #[serde(rename = "executionEval")]
        execution_eval: Option<String>,
    }

    #[test]
    fn eval_golden_f_desktop_gateway_routes() {
        run_golden_file("f_desktop_gateway_routes.json");
    }

    #[test]
    fn eval_golden_f_memory_gateway_routes() {
        run_golden_file("f_memory_gateway_routes.json");
    }

    #[test]
    fn eval_golden_f21_model_router_routes() {
        run_golden_file("f21_model_router_routes.json");
    }

    #[test]
    fn eval_fabric_f1_f2_voice_wake_config_roundtrip() {
        use crate::gateway::config::{GatewayConfig, GatewaySttProvider, GatewayVoiceConfig};

        let mut config = GatewayConfig::default();
        config.voice = GatewayVoiceConfig {
            stt_provider: GatewaySttProvider::Groq,
            talker_enabled: true,
        };
        let dir = std::env::temp_dir().join(format!("jarvis-voice-eval-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        crate::gateway::config::save_gateway_config(&dir, &config).expect("save");
        let loaded = crate::gateway::config::load_gateway_config(&dir);
        assert_eq!(loaded.voice.stt_provider, GatewaySttProvider::Groq);
        assert!(loaded.voice.talker_enabled);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn eval_fabric_f35_proactive_heartbeat_trace() {
        use crate::gateway::state::GatewayState;
        use crate::gateway::types::GatewayEventKind;

        let dir = std::env::temp_dir().join(format!("jarvis-hygiene-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let gateway_state = GatewayState::new(dir.clone());
        {
            let mut config = gateway_state.config.lock().expect("lock config");
            config.enabled = true;
            config.proactive.heartbeat_enabled = true;
        }

        let heartbeat_path = dir.join("HEARTBEAT.md");
        std::fs::write(&heartbeat_path, "# JARVIS Heartbeat\n\n- tick\n").expect("write heartbeat");

        let mut bus = gateway_state.bus.lock().expect("lock bus");
        bus.publish(crate::gateway::types::GatewayEvent {
            id: "heartbeat-eval".to_string(),
            session_id: "proactive-heartbeat".to_string(),
            turn_id: None,
            kind: GatewayEventKind::Reply,
            message: "Heartbeat: # JARVIS Heartbeat".to_string(),
            created_at: chrono::Utc::now().timestamp().to_string(),
            approval: None,
        });
        assert!(
            bus.recent(5)
                .iter()
                .any(|event| event.session_id == "proactive-heartbeat"),
            "heartbeat trace should publish proactive-heartbeat session events"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn eval_golden_f_email_trigger_inbox_routes() {
        run_golden_file("f_email_trigger_inbox.json");
    }

    #[test]
    fn eval_fabric_f21_provider_resolution() {
        use crate::gateway::config::GatewayConfig;
        use crate::gateway::types::{
            GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
            GatewayRoute, GatewaySensitivity, RouteLevel,
        };
        use crate::providers::resolve_provider;

        let config = GatewayConfig::default();
        let route = GatewayRoute {
            capability_id: "command.general".to_string(),
            capability_label: "General".to_string(),
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Talker,
            sensitivity: GatewaySensitivity::Public,
            score: 3,
            confidence: GatewayConfidenceBand::High,
            decision_policy: GatewayDecisionPolicy::Execute,
            decision_reason: "eval".to_string(),
            reason: "eval".to_string(),
            route_level: RouteLevel::L0,
            resolved_provider: None,
        };
        let resolved = resolve_provider(&route, &config);
        assert!(!resolved.provider_id.is_empty());
    }

    #[test]
    fn eval_golden_f_fabric_index() {
        let path = eval_path("f_fabric_index.json");
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
        let entries: Vec<FabricIndexEntry> =
            serde_json::from_str(&raw).expect("fabric index json should parse");
        let fabric_ids = entries
            .iter()
            .map(|entry| {
                entry
                    .id
                    .strip_prefix('F')
                    .and_then(|value| value.parse::<usize>().ok())
                    .unwrap_or_else(|| {
                        panic!("fabric id {} should be formatted like F<number>", entry.id)
                    })
            })
            .collect::<Vec<_>>();
        let mut unique_ids = fabric_ids.clone();
        unique_ids.sort_unstable();
        unique_ids.dedup();
        assert_eq!(
            unique_ids.len(),
            entries.len(),
            "fabric index should not contain duplicate ids"
        );
        assert_eq!(
            unique_ids.first().copied(),
            Some(1),
            "fabric index should start at F1"
        );
        assert_eq!(
            unique_ids.last().copied(),
            Some(entries.len()),
            "fabric index should end at F{}",
            entries.len()
        );
        let expected_ids = (1..=entries.len()).collect::<Vec<_>>();
        assert_eq!(
            unique_ids,
            expected_ids,
            "fabric index should cover every id from F1 to F{} with no gaps",
            entries.len()
        );

        let mut route_files = std::collections::BTreeSet::new();
        let mut execution_files = std::collections::BTreeSet::new();
        for entry in &entries {
            if let Some(file) = &entry.eval {
                route_files.insert(file.clone());
            }
            if let Some(file) = &entry.execution_eval {
                execution_files.insert(file.clone());
            }
        }
        assert!(
            route_files.len() >= 25,
            "expected at least 25 unique route golden files, got {}",
            route_files.len()
        );

        for file in route_files {
            if file == "f_skill_sdk_routes.json" {
                run_skill_golden_file(&file);
            } else {
                run_golden_file(&file);
            }
        }

        for file in execution_files {
            if !file.ends_with("_execution.json") {
                continue;
            }
            match file.as_str() {
                "f10_gmail_execution.json"
                | "f12_calendar_execution.json"
                | "f_email_copilot_execution.json" => {
                    run_execution_file(&file);
                }
                "f_policy_execution.json" => {
                    run_policy_execution_file(&file);
                }
                "f_task_run_execution.json" => {
                    run_mission_execution_file(&file);
                }
                "f_project_bundle_execution.json" => {
                    run_project_bundle_execution_file(&file);
                }
                "f_council_verifier_execution.json" => {
                    run_council_verifier_execution_file(&file);
                }
                "f_world_model_execution.json" => {
                    run_world_model_execution_file(&file);
                }
                "f_clipboard_execution.json"
                | "f_files_execution.json"
                | "f_pdf_execution.json" => {
                    run_command_execution_file(&file);
                }
                _ => {
                    // Automation/OCR/schedule execution evals have dedicated #[test] hooks.
                }
            }
        }
    }

    #[test]
    fn dry_run_mode_routes_study_without_legacy() {
        use crate::gateway::config::{GatewayConfig, GatewayMode};
        use crate::gateway::orchestrator::{GatewayOrchestrator, TurnExecutionEnv};
        use crate::gateway::types::TurnSource;
        use crate::providers::escalation::EscalationTracker;

        let mut bus = crate::gateway::bus::EventBus::default();
        let mut escalation = EscalationTracker::default();
        let db_path =
            std::env::temp_dir().join(format!("jarvis-eval-dry-run-{}", std::process::id()));
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
                app_data_dir: Some(app_data_dir.clone()),
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

    fn run_dry_run_turn(
        command: &str,
        configure: impl FnOnce(&mut crate::gateway::config::GatewayConfig),
    ) -> crate::gateway::orchestrator::GatewayTurnResponse {
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
                app_data_dir: Some(app_data_dir.clone()),
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
        assert!(!response
            .events
            .iter()
            .any(|event| event.kind == crate::gateway::types::GatewayEventKind::ToolStart));
    }

    #[test]
    fn dry_run_emits_budget_and_quota_trace_events() {
        let response = run_dry_run_turn("launch study setup", |config| {
            config.features.study_routine = true;
        });
        assert!(response
            .events
            .iter()
            .any(|event| event.message.contains("Turn budgets")));
        assert!(response
            .events
            .iter()
            .any(|event| event.message.contains("Provider quota")));
    }

    #[derive(Debug, Deserialize)]
    struct ExecutionEvalCase {
        command: String,
        #[serde(rename = "capabilityId")]
        capability_id: String,
        fixture: String,
        #[serde(rename = "expectSuccess")]
        expect_success: bool,
        #[serde(rename = "expectReplyContains")]
        expect_reply_contains: String,
    }

    fn install_google_execution_fixture(fixture: &str) {
        use std::collections::HashMap;

        use crate::gateway::models::{
            clear_all_session_emails, store_session_emails, GmailMessageRecord,
        };
        use crate::integrations::google::{auth, client};

        clear_all_session_emails();
        client::clear_mock_responses();
        auth::clear_test_tokens();

        match fixture {
            "missing_token" => {}
            "gmail_list_unread" => {
                auth::set_test_tokens(HashMap::from([("gmail".to_string(), "token".to_string())]));
                client::set_mock_responses(HashMap::from([
                    (
                        "/users/me/messages?labelIds=INBOX".to_string(),
                        r#"{"messages":[{"id":"msg-1","threadId":"thread-1"}]}"#.to_string(),
                    ),
                    (
                        "/users/me/messages/msg-1?format=full".to_string(),
                        r#"{"id":"msg-1","threadId":"thread-1","payload":{"mimeType":"text/plain","headers":[{"name":"Subject","value":"Invoice due"},{"name":"From","value":"billing@example.com"}],"body":{"data":"SW52b2ljZQ=="}}}"#
                            .to_string(),
                    ),
                ]));
            }
            "gmail_search" => {
                auth::set_test_tokens(HashMap::from([("gmail".to_string(), "token".to_string())]));
                client::set_mock_responses(HashMap::from([
                    (
                        "/users/me/messages?maxResults".to_string(),
                        r#"{"messages":[{"id":"msg-2","threadId":"thread-2"}]}"#.to_string(),
                    ),
                    (
                        "/users/me/messages/msg-2?format=full".to_string(),
                        r#"{"id":"msg-2","threadId":"thread-2","payload":{"mimeType":"text/plain","headers":[{"name":"Subject","value":"Invoice reminder"},{"name":"From","value":"billing@example.com"}],"body":{"data":"SW52b2ljZXM="}}}"#
                            .to_string(),
                    ),
                ]));
            }
            "gmail_session_read" => {
                auth::set_test_tokens(HashMap::from([("gmail".to_string(), "token".to_string())]));
                store_session_emails(
                    "eval-session",
                    vec![GmailMessageRecord {
                        id: "msg-1".into(),
                        thread_id: "thread-1".into(),
                        subject: "Invoice due".into(),
                        from: "billing@example.com".into(),
                        snippet: String::new(),
                        date: String::new(),
                        body: "Invoice body".into(),
                    }],
                );
            }
            "calendar_list_today" => {
                auth::set_test_tokens(HashMap::from([(
                    "calendar".to_string(),
                    "token".to_string(),
                )]));
                client::set_mock_responses(HashMap::from([(
                    "/calendars/primary/events".to_string(),
                    r#"{"items":[{"id":"evt-1","summary":"Standup","start":{"dateTime":"2026-06-14T09:00:00-04:00"},"end":{"dateTime":"2026-06-14T09:30:00-04:00"}}]}"#
                        .to_string(),
                )]));
            }
            "calendar_create_event" => {
                auth::set_test_tokens(HashMap::from([(
                    "calendar".to_string(),
                    "token".to_string(),
                )]));
                client::set_mock_responses(HashMap::from([(
                    "/calendars/primary/events".to_string(),
                    r#"{"id":"evt-2","summary":"gym","htmlLink":"https://calendar.google.com/event?eid=2"}"#
                        .to_string(),
                )]));
            }
            other => panic!("unknown google execution fixture: {other}"),
        }
    }

    fn run_execution_file(file_name: &str) {
        use crate::agents::{integrations::IntegrationsAgent, Agent, AgentContext};
        use crate::gateway::config::GatewayConfig;
        use crate::gateway::models::clear_all_session_emails;
        use crate::gateway::types::{
            GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
            GatewayRoute, GatewaySensitivity, RouteLevel,
        };
        use crate::integrations::google::{auth, client};

        let path = eval_path(file_name);
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
        let cases: Vec<ExecutionEvalCase> =
            serde_json::from_str(&raw).expect("execution eval json should parse");
        assert!(
            cases.len() >= 3,
            "{file_name} should contain at least 3 execution cases"
        );

        for case in cases {
            install_google_execution_fixture(&case.fixture);

            let mut config = GatewayConfig::default();
            config.enabled = true;
            config.features.gmail = true;
            config.features.calendar = true;

            let ctx = AgentContext {
                db_path: std::env::temp_dir().join(format!(
                    "jarvis-eval-exec-{}-{}",
                    file_name,
                    case.command.len()
                )),
                app_data_dir: std::env::temp_dir(),
                config,
                route: GatewayRoute {
                    capability_id: case.capability_id.clone(),
                    capability_label: "Execution".into(),
                    agent: GatewayAgentKind::Integrations,
                    tier: GatewayModelTier::Worker,
                    sensitivity: GatewaySensitivity::Personal,
                    score: 3,
                    confidence: GatewayConfidenceBand::High,
                    decision_policy: GatewayDecisionPolicy::Execute,
                    decision_reason: "test".into(),
                    reason: "test".into(),
                    route_level: RouteLevel::L0,
                    resolved_provider: None,
                },
                session_id: "eval-session".into(),
                turn_id: 1,
                command: case.command.clone(),
                step_description: case.command.clone(),
                step_kind: "integration".into(),
            };

            let result = IntegrationsAgent.run_step(&ctx).expect("integration step");
            assert_eq!(
                result.success, case.expect_success,
                "command {:?} fixture {}",
                case.command, case.fixture
            );
            assert!(
                result.reply.contains(&case.expect_reply_contains),
                "command {:?} expected reply to contain {:?}, got {:?}",
                case.command,
                case.expect_reply_contains,
                result.reply
            );
            assert!(result.integration_handoff.is_none());

            client::clear_mock_responses();
            auth::clear_test_tokens();
            clear_all_session_emails();
        }
    }

    fn run_orchestrator_execution_turn(
        db_path: &std::path::Path,
        app_data_dir: &std::path::Path,
        config: &crate::gateway::config::GatewayConfig,
        command: &str,
    ) -> crate::gateway::orchestrator::GatewayTurnResponse {
        use crate::gateway::orchestrator::{GatewayOrchestrator, TurnExecutionEnv};
        use crate::gateway::router::RouterContext;
        use crate::gateway::types::{TurnRequest, TurnSource};
        use crate::providers::escalation::EscalationTracker;

        let mut bus = crate::gateway::bus::EventBus::default();
        let mut escalation = EscalationTracker::default();
        let execution = TurnExecutionEnv {
            db_path,
            app_data_dir,
            escalation: &mut escalation,
        };
        GatewayOrchestrator::run_turn(
            TurnRequest {
                session_id: Some("eval-session".to_string()),
                command: command.to_string(),
                source: Some(TurnSource::Text),
                idempotency_key: None,
            },
            7,
            "eval-session",
            config,
            &RouterContext {
                db_path: Some(db_path.to_path_buf()),
                app_data_dir: Some(app_data_dir.to_path_buf()),
                config: config.clone(),
            },
            &mut bus,
            None,
            Some(execution),
        )
    }

    fn install_mission_execution_fixture(db_path: &std::path::Path, fixture: &str) {
        use crate::db::{init_database, save_task_state, TaskStateRecord};
        use crate::gateway::task_loop::{StepStatus, TaskStep, TaskStepsPayload};

        let _ = init_database(db_path);
        match fixture {
            "default" | "no_active_task" => {}
            "active_task" => {
                let payload = TaskStepsPayload {
                    failure_count: 0,
                    supervisor_recoveries: 0,
                    steps: vec![TaskStep {
                        id: "step-1".into(),
                        description: "List unread Gmail messages".into(),
                        kind: "list_unread_emails".into(),
                        status: StepStatus::Pending,
                        result: None,
                    }],
                };
                save_task_state(
                    db_path,
                    &TaskStateRecord {
                        id: "eval-active-task".into(),
                        session_id: "eval-session".into(),
                        goal: "check my email".into(),
                        status: "running".into(),
                        current_step: 0,
                        steps_json: serde_json::to_string(&payload).expect("serialize"),
                        updated_at: "2026-06-18T12:00:00Z".into(),
                    },
                )
                .expect("save task");
            }
            other => panic!("unknown mission execution fixture: {other}"),
        }
    }

    fn run_policy_execution_file(file_name: &str) {
        use crate::gateway::config::GatewayConfig;

        let path = eval_path(file_name);
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
        let cases: Vec<ExecutionEvalCase> =
            serde_json::from_str(&raw).expect("execution eval json should parse");

        for case in cases {
            let db_path = std::env::temp_dir().join(format!(
                "jarvis-eval-policy-{}-{}",
                file_name,
                case.command.len()
            ));
            let _ = std::fs::remove_file(&db_path);
            crate::db::init_database(&db_path).expect("init db");

            let mut config = GatewayConfig::default();
            config.enabled = true;
            config.features.gmail = true;
            config.features.calendar = true;

            let app_data_dir = std::env::temp_dir().join(format!(
                "jarvis-eval-policy-app-{}-{}",
                file_name,
                case.command.len()
            ));
            let _ = std::fs::create_dir_all(&app_data_dir);

            let response =
                run_orchestrator_execution_turn(&db_path, &app_data_dir, &config, &case.command);
            if case.expect_success {
                assert!(
                    !response.awaiting_approval,
                    "command {:?} should execute without approval, got {:?}",
                    case.command, response.result.reply
                );
            } else {
                assert!(
                    response.awaiting_approval,
                    "command {:?} should await approval, got {:?}",
                    case.command, response.result.reply
                );
            }
            assert!(
                response
                    .result
                    .reply
                    .to_lowercase()
                    .contains(&case.expect_reply_contains.to_lowercase()),
                "command {:?} expected reply to contain {:?}, got {:?}",
                case.command,
                case.expect_reply_contains,
                response.result.reply
            );
            let _ = std::fs::remove_file(db_path);
        }
    }

    fn run_mission_execution_file(file_name: &str) {
        use crate::gateway::config::GatewayConfig;

        let path = eval_path(file_name);
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
        let cases: Vec<ExecutionEvalCase> =
            serde_json::from_str(&raw).expect("execution eval json should parse");

        for case in cases {
            let db_path = std::env::temp_dir().join(format!(
                "jarvis-eval-mission-{}-{}",
                file_name,
                case.command.len()
            ));
            let _ = std::fs::remove_file(&db_path);
            install_mission_execution_fixture(&db_path, &case.fixture);

            let mut config = GatewayConfig::default();
            config.enabled = true;
            config.features.gmail = true;

            if case.fixture == "active_task" {
                install_google_execution_fixture("gmail_list_unread");
            }

            let app_data_dir = std::env::temp_dir().join(format!(
                "jarvis-eval-mission-app-{}-{}",
                file_name,
                case.command.len()
            ));
            let _ = std::fs::create_dir_all(&app_data_dir);

            let response =
                run_orchestrator_execution_turn(&db_path, &app_data_dir, &config, &case.command);
            assert!(
                response
                    .result
                    .reply
                    .to_lowercase()
                    .contains(&case.expect_reply_contains.to_lowercase()),
                "command {:?} expected reply to contain {:?}, got {:?}",
                case.command,
                case.expect_reply_contains,
                response.result.reply
            );
            let _ = std::fs::remove_file(db_path);
        }
    }

    fn run_project_bundle_execution_file(file_name: &str) {
        use crate::gateway::config::GatewayConfig;
        use crate::gateway::labs::project_bundle_reply;

        let path = eval_path(file_name);
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
        let cases: Vec<ExecutionEvalCase> =
            serde_json::from_str(&raw).expect("execution eval json should parse");

        for case in cases {
            let db_path = std::env::temp_dir().join(format!(
                "jarvis-eval-bundle-{}-{}",
                file_name,
                case.command.len()
            ));
            let mut config = GatewayConfig::default();
            if case.fixture == "lab_enabled" {
                config.labs.project_bundle_pilot = true;
            }
            let (success, reply) =
                project_bundle_reply(&config, &db_path, &std::env::temp_dir(), &case.command);
            assert_eq!(
                success, case.expect_success,
                "command {:?} fixture {}",
                case.command, case.fixture
            );
            assert!(
                reply
                    .to_lowercase()
                    .contains(&case.expect_reply_contains.to_lowercase()),
                "command {:?} expected reply to contain {:?}, got {:?}",
                case.command,
                case.expect_reply_contains,
                reply
            );
        }
    }

    fn install_command_execution_fixture(fixture: &str) {
        match fixture {
            "default" => {}
            other => panic!("unknown command execution fixture: {other}"),
        }
    }

    fn run_command_execution_file(file_name: &str) {
        use crate::agents::{command::CommandAgent, Agent, AgentContext};
        use crate::gateway::config::GatewayConfig;
        use crate::gateway::types::{
            GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
            GatewayRoute, GatewaySensitivity, RouteLevel,
        };

        let path = eval_path(file_name);
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
        let cases: Vec<ExecutionEvalCase> =
            serde_json::from_str(&raw).expect("execution eval json should parse");
        assert!(
            cases.len() >= 3,
            "{file_name} should contain at least 3 execution cases"
        );

        for case in cases {
            install_command_execution_fixture(&case.fixture);

            let mut config = GatewayConfig::default();
            config.enabled = true;

            let ctx = AgentContext {
                db_path: std::env::temp_dir().join(format!(
                    "jarvis-eval-cmd-exec-{}-{}",
                    file_name,
                    case.command.len()
                )),
                app_data_dir: std::env::temp_dir(),
                config,
                route: GatewayRoute {
                    capability_id: case.capability_id.clone(),
                    capability_label: "Execution".into(),
                    agent: GatewayAgentKind::Command,
                    tier: GatewayModelTier::Local,
                    sensitivity: GatewaySensitivity::Public,
                    score: 3,
                    confidence: GatewayConfidenceBand::High,
                    decision_policy: GatewayDecisionPolicy::Execute,
                    decision_reason: "test".into(),
                    reason: "test".into(),
                    route_level: RouteLevel::L0,
                    resolved_provider: None,
                },
                session_id: "eval-session".into(),
                turn_id: 1,
                command: case.command.clone(),
                step_description: case.command.clone(),
                step_kind: "command_execution".into(),
            };

            let result = match CommandAgent.run_step(&ctx) {
                Ok(result) => result,
                Err(message) => crate::agents::StepResult::failed(message),
            };
            assert_eq!(
                result.success, case.expect_success,
                "command {:?} fixture {}",
                case.command, case.fixture
            );
            assert!(
                result
                    .reply
                    .to_lowercase()
                    .contains(&case.expect_reply_contains.to_lowercase()),
                "command {:?} expected reply to contain {:?}, got {:?}",
                case.command,
                case.expect_reply_contains,
                result.reply
            );
            assert!(result.integration_handoff.is_none());
        }
    }

    fn install_memory_execution_fixture(fixture: &str, db_path: &std::path::Path) {
        use std::collections::HashMap;

        use crate::db::init_database;
        use crate::integrations::google::{auth, client};
        use crate::memory::{self, meeting};
        use crate::models::MeetingPrepMemoryRecord;
        use chrono::{Duration, Local};

        init_database(db_path).expect("init db");
        client::clear_mock_responses();
        auth::clear_test_tokens();
        crate::integrations::notion::clear_mock_responses();

        match fixture {
            "missing_token" => {
                memory::ensure_schema(db_path).expect("migrate");
            }
            "meeting_copilot_calendar" | "meeting_copilot_with_saved_prep" => {
                memory::ensure_schema(db_path).expect("migrate");
                auth::set_test_tokens(HashMap::from([(
                    "calendar".to_string(),
                    "token".to_string(),
                )]));
                let start = (Local::now() + Duration::minutes(10)).to_rfc3339();
                let end = (Local::now() + Duration::minutes(40)).to_rfc3339();
                client::set_mock_responses(HashMap::from([(
                    "/calendars/primary/events".to_string(),
                    format!(
                        r#"{{"items":[{{"id":"evt-review","summary":"Product review","start":{{"dateTime":"{start}"}},"end":{{"dateTime":"{end}"}}}}]}}"#
                    ),
                )]));
                if fixture == "meeting_copilot_with_saved_prep" {
                    meeting::upsert_meeting_prep(
                        db_path,
                        &MeetingPrepMemoryRecord {
                            id: "meeting-1".into(),
                            event_title: "Product review".into(),
                            summary_title: "Product review prep".into(),
                            focus_summary: "Review launch checklist".into(),
                            action_items: vec!["Confirm demo flow".into()],
                            related_people: vec!["Alex".into()],
                            changes_since_last_prep: None,
                            summary: "Prep notes".into(),
                            created_at: "2026-01-01T00:00:00Z".into(),
                        },
                    )
                    .expect("seed meeting prep");
                }
            }
            "planner_copilot_tasks" => {
                use crate::db::save_notion_config;
                use crate::integrations::notion;

                memory::ensure_schema(db_path).expect("migrate");
                save_notion_config(db_path, Some("token-eval"), Some("db-eval")).expect("notion");
                let today = Local::now().format("%Y-%m-%d").to_string();
                let query_body = serde_json::json!({
                    "results": [{
                        "id": "task-1",
                        "properties": {
                            "Name": { "title": [{ "plain_text": "Ship planner" }] },
                            "Due": { "date": { "start": today } },
                            "Status": { "select": { "name": "In progress" } }
                        }
                    }]
                })
                .to_string();
                notion::set_mock_responses(HashMap::from([
                    (
                        "/v1/databases/db-eval".to_string(),
                        r#"{"properties":{"Name":{"type":"title"},"Due":{"type":"date"},"Status":{"type":"select"}}}"#.to_string(),
                    ),
                    ("/v1/databases/db-eval/query".to_string(), query_body),
                ]));
            }
            "missing_notion" => {
                memory::ensure_schema(db_path).expect("migrate");
            }
            "meeting_v2_full" => {
                use crate::db::save_notion_config;
                use crate::integrations::notion;

                memory::ensure_schema(db_path).expect("migrate");
                auth::set_test_tokens(HashMap::from([
                    ("calendar".to_string(), "token".to_string()),
                    ("gmail".to_string(), "token".to_string()),
                ]));
                let start = (Local::now() + Duration::minutes(10)).to_rfc3339();
                let end = (Local::now() + Duration::minutes(40)).to_rfc3339();
                client::set_mock_responses(HashMap::from([
                    (
                        "/calendars/primary/events".to_string(),
                        format!(
                            r#"{{"items":[{{"id":"evt-review","summary":"Product review","start":{{"dateTime":"{start}"}},"end":{{"dateTime":"{end}"}}}}]}}"#
                        ),
                    ),
                    (
                        "/users/me/messages?maxResults".to_string(),
                        r#"{"messages":[{"id":"msg-1","threadId":"thread-1"}]}"#.to_string(),
                    ),
                    (
                        "/users/me/messages/msg-1?format=full".to_string(),
                        r#"{"id":"msg-1","threadId":"thread-1","snippet":"Product review thread","payload":{"mimeType":"text/plain","headers":[{"name":"Subject","value":"Product review deck"},{"name":"From","value":"Alex <alex@example.com>"}],"body":{"data":"UHJvZHVjdA=="}}}"#
                            .to_string(),
                    ),
                ]));
                save_notion_config(db_path, Some("token-eval"), Some("db-eval")).expect("notion");
                let today = Local::now().format("%Y-%m-%d").to_string();
                notion::set_mock_responses(HashMap::from([
                    (
                        "/v1/databases/db-eval".to_string(),
                        r#"{"properties":{"Name":{"type":"title"},"Due":{"type":"date"},"Status":{"type":"select"}}}"#.to_string(),
                    ),
                    (
                        "/v1/databases/db-eval/query".to_string(),
                        serde_json::json!({
                            "results": [{
                                "id": "task-1",
                                "properties": {
                                    "Name": { "title": [{ "plain_text": "Product review deck" }] },
                                    "Due": { "date": { "start": today } },
                                    "Status": { "select": { "name": "In progress" } }
                                }
                            }]
                        })
                        .to_string(),
                    ),
                ]));
            }
            "topic_graph" => {
                use crate::memory::{entity_store, topic_graph};

                memory::ensure_schema(db_path).expect("migrate");
                topic_graph::ensure_topic_graph_schema(db_path).expect("topic graph schema");
                let project_id = entity_store::upsert_domain_entity(
                    db_path,
                    "meeting_prep",
                    "Product review",
                    r#"{"title":"Product review"}"#,
                    "Product review prep",
                    &[],
                )
                .expect("project entity");
                let alex_id = entity_store::upsert_domain_entity(
                    db_path,
                    "people",
                    "Alex",
                    r#"{"name":"Alex"}"#,
                    "Alex profile",
                    &[],
                )
                .expect("person entity");
                topic_graph::upsert_relation(db_path, project_id, "related_to", alex_id, "eval")
                    .expect("relation");
            }
            other => panic!("unknown memory execution fixture: {other}"),
        }
    }

    fn run_council_verifier_execution_file(file_name: &str) {
        use crate::gateway::config::GatewayConfig;
        use crate::gateway::types::GatewayPolicyClass;
        use crate::gateway::verifier::council_verify_send;

        #[derive(serde::Deserialize)]
        struct CouncilVerifierCase {
            draft: String,
            #[serde(rename = "expectBlocked")]
            expect_blocked: bool,
        }

        let path = eval_path(file_name);
        let raw = std::fs::read_to_string(&path).expect("read council verifier eval");
        let cases: Vec<CouncilVerifierCase> = serde_json::from_str(&raw).expect("parse");
        let mut config = GatewayConfig::default();
        config.labs.council_verifier = true;
        let mut blocked = 0usize;
        for case in &cases {
            let result =
                council_verify_send(&config, GatewayPolicyClass::Send, "send email", &case.draft);
            let is_blocked = result.is_err();
            if is_blocked == case.expect_blocked {
                if is_blocked {
                    blocked += 1;
                }
            } else {
                panic!(
                    "council verifier mismatch for draft {:?}: blocked={is_blocked} expected={}",
                    case.draft, case.expect_blocked
                );
            }
        }
        let rate = (blocked as f64
            / cases.iter().filter(|c| c.expect_blocked).count().max(1) as f64)
            * 100.0;
        assert!(
            rate >= 80.0,
            "council verifier block rate {rate}% below 80%"
        );
    }

    fn run_world_model_execution_file(file_name: &str) {
        use crate::gateway::config::GatewayConfig;
        use crate::memory::world_model::answer_world_model_query;

        #[derive(serde::Deserialize)]
        struct WorldModelCase {
            command: String,
            fixture: String,
            #[serde(rename = "expectSuccess")]
            expect_success: bool,
            #[serde(rename = "expectReplyContains")]
            expect_reply_contains: Option<String>,
        }

        let path = eval_path(file_name);
        let raw = std::fs::read_to_string(&path).expect("read world model eval");
        let cases: Vec<WorldModelCase> = serde_json::from_str(&raw).expect("parse");
        for case in cases {
            let dir = std::env::temp_dir().join(format!(
                "jarvis-world-model-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|duration| duration.as_nanos())
                    .unwrap_or(0)
            ));
            std::fs::create_dir_all(&dir).expect("dir");
            let db_path = dir.join("test.db");
            install_memory_execution_fixture(&case.fixture, &db_path);
            let mut config = GatewayConfig::default();
            config.labs.world_model_queries = true;
            config.features.memory = true;
            let reply = answer_world_model_query(&db_path, &config, &case.command);
            let success = reply
                .as_ref()
                .map(|text| !text.contains("disabled"))
                .unwrap_or(false);
            assert_eq!(
                success, case.expect_success,
                "world model success for {}",
                case.command
            );
            if let (Ok(text), Some(needle)) = (&reply, &case.expect_reply_contains) {
                assert!(
                    text.to_lowercase().contains(&needle.to_lowercase()),
                    "reply missing {needle}: {text}"
                );
            }
            let _ = std::fs::remove_dir_all(dir);
        }
    }

    fn run_planner_execution_file(file_name: &str) {
        use crate::agents::{Agent, AgentContext, MemoryAgent};
        use crate::gateway::config::GatewayConfig;
        use crate::gateway::types::{
            GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
            GatewayRoute, GatewaySensitivity, RouteLevel,
        };
        use crate::integrations::google::{auth, client};
        use crate::integrations::notion;

        let path = eval_path(file_name);
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
        let cases: Vec<ExecutionEvalCase> =
            serde_json::from_str(&raw).expect("execution eval json should parse");
        assert!(
            cases.len() >= 3,
            "{file_name} should contain at least 3 execution cases"
        );

        for case in cases {
            let db_path = std::env::temp_dir().join(format!(
                "jarvis-eval-planner-exec-{}-{}",
                file_name,
                case.command.len()
            ));
            let _ = std::fs::remove_file(&db_path);
            install_memory_execution_fixture(&case.fixture, &db_path);

            let mut config = GatewayConfig::default();
            config.enabled = true;
            config.features.memory = true;
            config.features.calendar = true;
            config.proactive.planner_copilot_enabled = true;

            let ctx = AgentContext {
                db_path: db_path.clone(),
                app_data_dir: std::env::temp_dir(),
                config,
                route: GatewayRoute {
                    capability_id: case.capability_id.clone(),
                    capability_label: "Execution".into(),
                    agent: GatewayAgentKind::Memory,
                    tier: GatewayModelTier::Embed,
                    sensitivity: GatewaySensitivity::Personal,
                    score: 3,
                    confidence: GatewayConfidenceBand::High,
                    decision_policy: GatewayDecisionPolicy::Execute,
                    decision_reason: "test".into(),
                    reason: "test".into(),
                    route_level: RouteLevel::L0,
                    resolved_provider: None,
                },
                session_id: "eval-session".into(),
                turn_id: 1,
                command: case.command.clone(),
                step_description: case.command.clone(),
                step_kind: "memory".into(),
            };

            let result = MemoryAgent.run_step(&ctx).expect("memory step");
            assert_eq!(
                result.success, case.expect_success,
                "command {:?} fixture {}",
                case.command, case.fixture
            );
            assert!(
                result
                    .reply
                    .to_lowercase()
                    .contains(&case.expect_reply_contains.to_lowercase()),
                "command {:?} expected reply to contain {:?}, got {:?}",
                case.command,
                case.expect_reply_contains,
                result.reply
            );

            client::clear_mock_responses();
            auth::clear_test_tokens();
            notion::clear_mock_responses();
            let _ = std::fs::remove_file(db_path);
        }
    }

    fn run_audit_rollback_execution_file(file_name: &str) {
        use crate::gateway::audit::{
            append_entry, rollback_audit_entry, search_audit_log, AuditOutcome, AuditRecord,
        };
        use crate::gateway::types::GatewayPolicyClass;

        let path = eval_path(file_name);
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
        let cases: Vec<ExecutionEvalCase> =
            serde_json::from_str(&raw).expect("execution eval json should parse");

        for case in cases {
            let app_data_dir = std::env::temp_dir().join(format!(
                "jarvis-eval-audit-{}-{}",
                file_name,
                case.command.len()
            ));
            let db_path = app_data_dir.join("jarvis.db");
            let _ = std::fs::remove_dir_all(&app_data_dir);
            let _ = std::fs::create_dir_all(&app_data_dir);

            match case.fixture.as_str() {
                "audit_notion_rollback" => {
                    use crate::db::{init_database, save_notion_config};
                    use crate::integrations::notion;

                    init_database(&db_path).expect("init db");
                    save_notion_config(&db_path, Some("token-eval"), Some("db-eval"))
                        .expect("notion");
                    notion::set_mock_responses(std::collections::HashMap::from([(
                        "/v1/pages/page-eval".to_string(),
                        r#"{"id":"page-eval","archived":true}"#.to_string(),
                    )]));
                    append_entry(
                        &app_data_dir,
                        AuditRecord {
                            policy_class: GatewayPolicyClass::Write,
                            agent: "memory",
                            capability_id: "memory.planner",
                            session_id: "s1",
                            turn_id: 1,
                            outcome: AuditOutcome::Executed,
                            detail: "saved plan",
                            rollback_ref: Some(r#"{"type":"notion","pageId":"page-eval"}"#),
                        },
                    )
                    .expect("append");
                    let results =
                        search_audit_log(&app_data_dir, Some("plan"), Some("write"), None, 10)
                            .expect("search");
                    assert!(!results.is_empty());
                    let reply =
                        rollback_audit_entry(&app_data_dir, &db_path, results[0].line_index);
                    assert_eq!(case.expect_success, reply.is_ok());
                    if case.expect_success {
                        assert!(reply.unwrap().to_lowercase().contains("archived"));
                    }
                }
                "audit_missing_ref" => {
                    append_entry(
                        &app_data_dir,
                        AuditRecord {
                            policy_class: GatewayPolicyClass::Read,
                            agent: "memory",
                            capability_id: "memory.life",
                            session_id: "s1",
                            turn_id: 1,
                            outcome: AuditOutcome::Executed,
                            detail: "read only",
                            rollback_ref: None,
                        },
                    )
                    .expect("append");
                    let reply = rollback_audit_entry(&app_data_dir, &db_path, 0);
                    assert!(!case.expect_success);
                    assert!(reply.is_err());
                }
                "audit_search" => {
                    append_entry(
                        &app_data_dir,
                        AuditRecord {
                            policy_class: GatewayPolicyClass::Write,
                            agent: "planner",
                            capability_id: "memory.planner",
                            session_id: "s1",
                            turn_id: 2,
                            outcome: AuditOutcome::Executed,
                            detail: "planner saved",
                            rollback_ref: None,
                        },
                    )
                    .expect("append");
                    let results = search_audit_log(&app_data_dir, Some("planner"), None, None, 10)
                        .expect("search");
                    assert_eq!(case.expect_success, !results.is_empty());
                }
                other => panic!("unknown audit execution fixture: {other}"),
            }

            let _ = std::fs::remove_dir_all(app_data_dir);
        }
    }

    fn run_memory_execution_file(file_name: &str) {
        use crate::agents::{Agent, AgentContext, MemoryAgent};
        use crate::gateway::config::GatewayConfig;
        use crate::gateway::types::{
            GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
            GatewayRoute, GatewaySensitivity, RouteLevel,
        };
        use crate::integrations::google::{auth, client};

        let path = eval_path(file_name);
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
        let cases: Vec<ExecutionEvalCase> =
            serde_json::from_str(&raw).expect("execution eval json should parse");
        assert!(
            cases.len() >= 3,
            "{file_name} should contain at least 3 execution cases"
        );

        for case in cases {
            let db_path = std::env::temp_dir().join(format!(
                "jarvis-eval-memory-exec-{}-{}",
                file_name,
                case.command.len()
            ));
            let _ = std::fs::remove_file(&db_path);
            install_memory_execution_fixture(&case.fixture, &db_path);

            let mut config = GatewayConfig::default();
            config.enabled = true;
            config.features.memory = true;
            config.features.calendar = true;
            config.features.gmail = true;

            let ctx = AgentContext {
                db_path: db_path.clone(),
                app_data_dir: std::env::temp_dir(),
                config,
                route: GatewayRoute {
                    capability_id: case.capability_id.clone(),
                    capability_label: "Execution".into(),
                    agent: GatewayAgentKind::Memory,
                    tier: GatewayModelTier::Embed,
                    sensitivity: GatewaySensitivity::Personal,
                    score: 3,
                    confidence: GatewayConfidenceBand::High,
                    decision_policy: GatewayDecisionPolicy::Execute,
                    decision_reason: "test".into(),
                    reason: "test".into(),
                    route_level: RouteLevel::L0,
                    resolved_provider: None,
                },
                session_id: "eval-session".into(),
                turn_id: 1,
                command: case.command.clone(),
                step_description: case.command.clone(),
                step_kind: "memory".into(),
            };

            let result = MemoryAgent.run_step(&ctx).expect("memory step");
            assert_eq!(
                result.success, case.expect_success,
                "command {:?} fixture {}",
                case.command, case.fixture
            );
            assert!(
                result
                    .reply
                    .to_lowercase()
                    .contains(&case.expect_reply_contains.to_lowercase()),
                "command {:?} expected reply to contain {:?}, got {:?}",
                case.command,
                case.expect_reply_contains,
                result.reply
            );

            client::clear_mock_responses();
            auth::clear_test_tokens();
            let _ = std::fs::remove_file(db_path);
        }
    }

    #[test]
    fn eval_golden_f10_gmail_execution() {
        run_execution_file("f10_gmail_execution.json");
    }

    #[test]
    fn eval_golden_f12_calendar_execution() {
        run_execution_file("f12_calendar_execution.json");
    }

    #[test]
    fn eval_golden_f_meeting_copilot_execution() {
        run_memory_execution_file("f_meeting_copilot_execution.json");
    }

    #[test]
    fn eval_golden_f_planner_copilot_execution() {
        run_planner_execution_file("f_planner_copilot_execution.json");
    }

    #[test]
    fn eval_golden_f_meeting_copilot_v2_routes() {
        run_golden_file("f_meeting_copilot_v2_routes.json");
    }

    #[test]
    fn eval_golden_f_meeting_copilot_v2_execution() {
        run_memory_execution_file("f_meeting_copilot_v2_execution.json");
    }

    #[test]
    fn eval_golden_f_trigger_recipe_routes() {
        run_golden_file("f_trigger_recipe_routes.json");
    }

    #[test]
    fn eval_golden_f_audit_rollback_execution() {
        run_audit_rollback_execution_file("f_audit_rollback_execution.json");
    }

    #[test]
    fn eval_golden_f_policy_execution() {
        run_policy_execution_file("f_policy_execution.json");
    }

    #[test]
    fn eval_golden_f_task_run_execution() {
        run_mission_execution_file("f_task_run_execution.json");
    }

    #[test]
    fn eval_golden_f_email_copilot_execution() {
        run_execution_file("f_email_copilot_execution.json");
    }

    #[test]
    fn eval_golden_f_project_bundle_execution() {
        run_project_bundle_execution_file("f_project_bundle_execution.json");
    }

    #[test]
    fn eval_golden_f_council_verifier_execution() {
        run_council_verifier_execution_file("f_council_verifier_execution.json");
    }

    #[test]
    fn eval_golden_f_topic_graph_routes() {
        run_golden_file("f_topic_graph_routes.json");
    }

    #[test]
    fn eval_golden_f_travel_copilot_routes() {
        run_golden_file("f_travel_copilot_routes.json");
    }

    #[test]
    fn eval_golden_f_world_model_execution() {
        run_world_model_execution_file("f_world_model_execution.json");
    }

    #[test]
    fn eval_fabric_f61_profile_memory_isolation() {
        use crate::gateway::profiles::{get_active_profile_id, seed_default_profiles};
        use crate::memory::{recall_text, remember};

        let db_path = std::env::temp_dir().join(format!(
            "jarvis-eval-profile-isolation-{}.db",
            std::process::id()
        ));
        let app_data_dir = std::env::temp_dir().join(format!(
            "jarvis-eval-profile-isolation-app-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_dir_all(&app_data_dir);
        std::fs::create_dir_all(&app_data_dir).expect("app dir");
        crate::db::init_database(&db_path).expect("init db");
        seed_default_profiles(&db_path, &app_data_dir).expect("seed profiles");

        remember(&db_path, "Work launch checklist", "general").expect("remember work");
        let personal_switch =
            crate::gateway::profiles::switch_profile(&db_path, &app_data_dir, "personal");
        assert!(
            personal_switch.is_ok(),
            "direct personal switch should succeed"
        );
        remember(&db_path, "Personal dinner reservation", "general").expect("remember personal");

        let mut config = crate::gateway::config::GatewayConfig::default();
        config.enabled = true;
        config.features.memory = true;

        let response = run_orchestrator_execution_turn(
            &db_path,
            &app_data_dir,
            &config,
            "switch to work profile",
        );
        assert!(
            !response.result.legacy,
            "profile switch should execute via gateway"
        );
        assert!(
            response
                .result
                .reply
                .to_lowercase()
                .contains("work profile"),
            "expected work switch reply, got {:?}",
            response.result.reply
        );
        assert_eq!(
            get_active_profile_id(&db_path)
                .expect("active work")
                .as_deref(),
            Some("work")
        );
        let work_recall = recall_text(&db_path, "launch checklist").expect("work recall");
        assert!(work_recall.contains("Work launch checklist"));
        let hidden_personal =
            recall_text(&db_path, "dinner reservation").expect("hidden personal recall");
        assert!(
            hidden_personal.contains("could not find anything"),
            "expected work profile to hide personal memory, got {:?}",
            hidden_personal
        );

        let response = run_orchestrator_execution_turn(
            &db_path,
            &app_data_dir,
            &config,
            "switch to personal profile",
        );
        assert!(
            !response.result.legacy,
            "profile switch should execute via gateway"
        );
        assert!(
            response
                .result
                .reply
                .to_lowercase()
                .contains("personal profile"),
            "expected personal switch reply, got {:?}",
            response.result.reply
        );
        assert_eq!(
            get_active_profile_id(&db_path)
                .expect("active personal")
                .as_deref(),
            Some("personal")
        );
        let personal_recall = recall_text(&db_path, "dinner reservation").expect("personal recall");
        assert!(personal_recall.contains("Personal dinner reservation"));
        let hidden_work = recall_text(&db_path, "launch checklist").expect("hidden work recall");
        assert!(
            hidden_work.contains("could not find anything"),
            "expected personal profile to hide work memory, got {:?}",
            hidden_work
        );

        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn eval_fabric_f63_skill_handler_execution() {
        use crate::agents::{Agent, AgentContext};
        use crate::gateway::config::GatewayConfig;
        use crate::gateway::profiles::seed_default_profiles;
        use crate::gateway::skills::{SkillHandler, SkillManifest};
        use crate::gateway::types::{
            GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
            GatewayRoute, GatewaySensitivity, RouteLevel,
        };
        use std::io::{Read, Write};
        use std::net::TcpListener;

        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let db_path = std::env::temp_dir().join(format!("jarvis-eval-skill-handler-{nanos}.db"));
        let app_data_dir =
            std::env::temp_dir().join(format!("jarvis-eval-skill-handler-app-{nanos}"));
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_dir_all(&app_data_dir);
        std::fs::create_dir_all(app_data_dir.join("skills")).expect("skills root");
        crate::db::init_database(&db_path).expect("init db");
        seed_default_profiles(&db_path, &app_data_dir).expect("seed profiles");

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().expect("addr").port();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut request = [0_u8; 1024];
            let _ = stream.read(&mut request);
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 9\r\n\r\nskill-ok\n")
                .expect("write");
        });

        let manifests = vec![
            SkillManifest {
                id: "route-skill".into(),
                version: "1.0.0".into(),
                label: "Route Skill".into(),
                keywords: vec!["route skill".into()],
                agent: "command".into(),
                permissions: vec!["read".into()],
                enabled: true,
                handler: SkillHandler::Route {
                    capability_id: "command.general".into(),
                },
            },
            SkillManifest {
                id: "http-skill".into(),
                version: "1.0.0".into(),
                label: "Http Skill".into(),
                keywords: vec!["http skill".into()],
                agent: "command".into(),
                permissions: vec!["read".into()],
                enabled: true,
                handler: SkillHandler::Http {
                    url: format!("http://127.0.0.1:{port}/health"),
                    method: "GET".into(),
                },
            },
            SkillManifest {
                id: "script-skill".into(),
                version: "1.0.0".into(),
                label: "Script Skill".into(),
                keywords: vec!["script skill".into()],
                agent: "command".into(),
                permissions: vec!["execute".into()],
                enabled: true,
                handler: SkillHandler::Script {
                    #[cfg(windows)]
                    command: "cmd /C echo skill-script".into(),
                    #[cfg(not(windows))]
                    command: "sh -c echo skill-script".into(),
                },
            },
            SkillManifest {
                id: "wasm-skill".into(),
                version: "1.0.0".into(),
                label: "Wasm Skill".into(),
                keywords: vec!["wasm skill".into()],
                agent: "command".into(),
                permissions: vec!["execute".into()],
                enabled: true,
                handler: SkillHandler::Wasm {
                    module: "dist/skill.wasm".into(),
                    entrypoint: Some("run".into()),
                },
            },
        ];

        for manifest in &manifests {
            let skill_dir = app_data_dir.join("skills").join(&manifest.id);
            std::fs::create_dir_all(&skill_dir).expect("skill dir");
            if manifest.id == "wasm-skill" {
                let dist = skill_dir.join("dist");
                std::fs::create_dir_all(&dist).expect("wasm dist");
                let wasm_bytes = crate::builder::test_minimal_wasm_with_export("run");
                std::fs::write(dist.join("skill.wasm"), wasm_bytes).expect("write wasm");
            }
            std::fs::write(
                skill_dir.join("skill.json"),
                serde_json::to_string_pretty(manifest).expect("serialize"),
            )
            .expect("write manifest");
        }

        let base_route = GatewayRoute {
            capability_id: "platform.skill".into(),
            capability_label: "Installed Skill".into(),
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            sensitivity: GatewaySensitivity::Public,
            score: 3,
            confidence: GatewayConfidenceBand::High,
            decision_policy: GatewayDecisionPolicy::Execute,
            decision_reason: "eval".into(),
            reason: "eval".into(),
            route_level: RouteLevel::L0,
            resolved_provider: None,
        };
        let ctx_for = |command: &str| AgentContext {
            db_path: db_path.clone(),
            app_data_dir: app_data_dir.clone(),
            config: GatewayConfig::default(),
            route: base_route.clone(),
            session_id: "eval-session".into(),
            turn_id: 1,
            command: command.to_string(),
            step_description: command.to_string(),
            step_kind: "installed_skill".into(),
        };

        let route_result = crate::agents::command::CommandAgent
            .run_step(&ctx_for("run route skill"))
            .expect("route step");
        assert!(route_result.success);
        assert!(route_result.integration_handoff.is_some());

        let http_result = crate::agents::command::CommandAgent
            .run_step(&ctx_for("run http skill"))
            .expect("http step");
        assert!(http_result.success);
        assert!(http_result.reply.contains("skill-ok"));

        let script_result = crate::agents::command::CommandAgent
            .run_step(&ctx_for("run script skill"))
            .expect("script step");
        assert!(script_result.success);
        assert!(script_result.reply.to_lowercase().contains("skill-script"));

        let wasm_result = crate::agents::command::CommandAgent
            .run_step(&ctx_for("run wasm skill"))
            .expect("wasm step");
        assert!(wasm_result.success);
        assert!(wasm_result.reply.contains("run wasm skill"));

        server.join().expect("server join");
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn eval_fabric_f63_profile_scoped_skill_override_execution() {
        use crate::agents::{Agent, AgentContext};
        use crate::gateway::config::GatewayConfig;
        use crate::gateway::profiles::{seed_default_profiles, switch_profile};
        use crate::gateway::skills::{SkillHandler, SkillManifest};
        use crate::gateway::types::{
            GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
            GatewayRoute, GatewaySensitivity, RouteLevel,
        };

        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let db_path = std::env::temp_dir().join(format!("jarvis-eval-skill-override-{nanos}.db"));
        let app_data_dir =
            std::env::temp_dir().join(format!("jarvis-eval-skill-override-app-{nanos}"));
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_dir_all(&app_data_dir);
        std::fs::create_dir_all(app_data_dir.join("skills")).expect("skills root");
        seed_default_profiles(&db_path, &app_data_dir).expect("seed profiles");

        let global_manifest = SkillManifest {
            id: "shared-skill".into(),
            version: "1.0.0".into(),
            label: "Global Shared Skill".into(),
            keywords: vec!["shared command".into()],
            agent: "command".into(),
            permissions: vec!["read".into()],
            enabled: true,
            handler: SkillHandler::Route {
                capability_id: "command.general".into(),
            },
        };
        let personal_manifest = SkillManifest {
            id: "shared-skill".into(),
            version: "1.0.0".into(),
            label: "Personal Shared Skill".into(),
            keywords: vec!["personal command".into()],
            agent: "command".into(),
            permissions: vec!["read".into()],
            enabled: true,
            handler: SkillHandler::Route {
                capability_id: "command.general".into(),
            },
        };

        let global_skill_dir = app_data_dir.join("skills").join(&global_manifest.id);
        std::fs::create_dir_all(&global_skill_dir).expect("global skill dir");
        std::fs::write(
            global_skill_dir.join("skill.json"),
            serde_json::to_string_pretty(&global_manifest).expect("serialize global"),
        )
        .expect("write global manifest");

        let personal_skill_dir = app_data_dir
            .join("skills")
            .join("personal")
            .join(&personal_manifest.id);
        std::fs::create_dir_all(&personal_skill_dir).expect("personal skill dir");
        std::fs::write(
            personal_skill_dir.join("skill.json"),
            serde_json::to_string_pretty(&personal_manifest).expect("serialize personal"),
        )
        .expect("write personal manifest");

        let base_route = GatewayRoute {
            capability_id: "platform.skill".into(),
            capability_label: "Installed Skill".into(),
            agent: GatewayAgentKind::Command,
            tier: GatewayModelTier::Local,
            sensitivity: GatewaySensitivity::Public,
            score: 3,
            confidence: GatewayConfidenceBand::High,
            decision_policy: GatewayDecisionPolicy::Execute,
            decision_reason: "eval".into(),
            reason: "eval".into(),
            route_level: RouteLevel::L0,
            resolved_provider: None,
        };
        let ctx_for = |command: &str| AgentContext {
            db_path: db_path.clone(),
            app_data_dir: app_data_dir.clone(),
            config: GatewayConfig::default(),
            route: base_route.clone(),
            session_id: "eval-session".into(),
            turn_id: 1,
            command: command.to_string(),
            step_description: command.to_string(),
            step_kind: "installed_skill".into(),
        };

        let work_result = crate::agents::command::CommandAgent
            .run_step(&ctx_for("run shared command"))
            .expect("global skill step");
        assert!(work_result.success);
        assert!(work_result.integration_handoff.is_some());
        assert!(crate::agents::command::CommandAgent
            .run_step(&ctx_for("run personal command"))
            .is_err());

        switch_profile(&db_path, &app_data_dir, "personal").expect("switch personal");

        let personal_result = crate::agents::command::CommandAgent
            .run_step(&ctx_for("run personal command"))
            .expect("personal skill step");
        assert!(personal_result.success);
        assert!(personal_result.integration_handoff.is_some());
        assert!(crate::agents::command::CommandAgent
            .run_step(&ctx_for("run shared command"))
            .is_err());

        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn eval_golden_f_profile_switch_routes() {
        run_golden_file("f_profile_switch_routes.json");
    }

    #[test]
    fn eval_golden_f_skill_sdk_routes() {
        run_skill_golden_file("f_skill_sdk_routes.json");
    }

    #[test]
    fn eval_golden_f_ambient_copilot_routes() {
        run_golden_file("f_ambient_copilot_routes.json");
    }

    #[test]
    fn eval_fabric_f64_ambient_signal_execution() {
        use crate::gateway::ambient::{maybe_suggest_from_signal, start_ambient_session};
        use crate::gateway::config::GatewayConfig;
        use crate::gateway::profiles::seed_default_profiles;

        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let db_path = std::env::temp_dir().join(format!("jarvis-eval-ambient-signal-{nanos}.db"));
        let app_data_dir =
            std::env::temp_dir().join(format!("jarvis-eval-ambient-signal-app-{nanos}"));
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_dir_all(&app_data_dir);
        std::fs::create_dir_all(&app_data_dir).expect("app dir");
        seed_default_profiles(&db_path, &app_data_dir).expect("seed profiles");

        let mut config = GatewayConfig::default();
        config.labs.ambient_copilot = true;
        start_ambient_session(&db_path, Some("focus"), None, true).expect("session");

        let suggestion = maybe_suggest_from_signal(
            &db_path,
            &config,
            "voice transcript mentions invoice due tomorrow",
        )
        .expect("signal")
        .expect("suggestion");
        assert!(suggestion.message.contains("Ambient copilot noticed"));
        assert!(!suggestion.message.is_empty());

        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn eval_golden_f_clipboard_execution() {
        run_command_execution_file("f_clipboard_execution.json");
    }

    #[test]
    fn eval_golden_f_files_execution() {
        run_command_execution_file("f_files_execution.json");
    }

    #[test]
    fn eval_golden_f_pdf_execution() {
        run_command_execution_file("f_pdf_execution.json");
    }

    fn install_automation_execution_fixture(db_path: &std::path::Path, fixture: &str) {
        use crate::db::automation_store::{
            save_desktop_schedule, save_ocr_watch, save_saved_workflow, DesktopScheduleRecord,
            OcrWatchRecord, SavedWorkflowRecord,
        };

        let _ = crate::db::init_database(db_path);

        match fixture {
            "default" => {}
            "morning_workflow" => {
                save_saved_workflow(
                    db_path,
                    &SavedWorkflowRecord {
                        id: "wf-eval-morning".into(),
                        name: "eval morning".into(),
                        trigger_phrase: "run workflow eval morning".into(),
                        steps: vec!["open explorer".into()],
                        created_at: "2026-01-01T00:00:00Z".into(),
                        based_on_count: 1,
                    },
                )
                .expect("save workflow");
            }
            "with_watch" => {
                save_ocr_watch(
                    db_path,
                    &OcrWatchRecord {
                        id: "watch-eval".into(),
                        name: "Eval watch".into(),
                        scope: "screen".into(),
                        app_name: None,
                        region: None,
                        rect: None,
                        status: "active".into(),
                        interval_ms: 60_000,
                        log_to_notion: Some(false),
                        create_task_on_match: Some(false),
                        action: None,
                        rule: Some(serde_json::json!({ "type": "any_change" })),
                        last_text: None,
                        last_match_key: None,
                        last_checked_at: None,
                    },
                )
                .expect("save watch");
            }
            "with_schedule" => {
                save_desktop_schedule(
                    db_path,
                    &DesktopScheduleRecord {
                        id: "schedule-eval".into(),
                        project_name: "eval project".into(),
                        action_label: "open explorer".into(),
                        due_at: "2026-01-01T12:00:00Z".into(),
                        created_at: "2026-01-01T00:00:00Z".into(),
                    },
                )
                .expect("save schedule");
            }
            other => panic!("unknown automation execution fixture: {other}"),
        }
    }

    fn run_automation_execution_file(file_name: &str) {
        use crate::agents::{
            automation::AutomationAgent, integrations::IntegrationsAgent, Agent, AgentContext,
        };
        use crate::gateway::config::GatewayConfig;
        use crate::gateway::types::{
            GatewayAgentKind, GatewayConfidenceBand, GatewayDecisionPolicy, GatewayModelTier,
            GatewayRoute, GatewaySensitivity, RouteLevel,
        };

        let path = eval_path(file_name);
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
        let cases: Vec<ExecutionEvalCase> =
            serde_json::from_str(&raw).expect("execution eval json should parse");
        assert!(
            cases.len() >= 3,
            "{file_name} should contain at least 3 execution cases"
        );

        for case in cases {
            let db_path = std::env::temp_dir().join(format!(
                "jarvis-eval-auto-exec-{}-{}",
                file_name,
                case.command.len()
            ));
            let _ = std::fs::remove_file(&db_path);
            install_automation_execution_fixture(&db_path, &case.fixture);

            let mut config = GatewayConfig::default();
            config.enabled = true;
            config.features.ocr_notion = true;

            let agent_kind = if case.capability_id == "integrations.ocr_notion" {
                GatewayAgentKind::Integrations
            } else {
                GatewayAgentKind::Automation
            };

            let ctx = AgentContext {
                db_path: db_path.clone(),
                app_data_dir: std::env::temp_dir(),
                config,
                route: GatewayRoute {
                    capability_id: case.capability_id.clone(),
                    capability_label: "Execution".into(),
                    agent: agent_kind.clone(),
                    tier: GatewayModelTier::Local,
                    sensitivity: GatewaySensitivity::Public,
                    score: 3,
                    confidence: GatewayConfidenceBand::High,
                    decision_policy: GatewayDecisionPolicy::Execute,
                    decision_reason: "test".into(),
                    reason: "test".into(),
                    route_level: RouteLevel::L0,
                    resolved_provider: None,
                },
                session_id: "eval-session".into(),
                turn_id: 1,
                command: case.command.clone(),
                step_description: case.command.clone(),
                step_kind: "automation_execution".into(),
            };

            let result = match agent_kind {
                GatewayAgentKind::Integrations => IntegrationsAgent.run_step(&ctx),
                _ => AutomationAgent.run_step(&ctx),
            }
            .expect("automation step");
            assert_eq!(
                result.success, case.expect_success,
                "command {:?} fixture {}",
                case.command, case.fixture
            );
            assert!(
                result
                    .reply
                    .to_lowercase()
                    .contains(&case.expect_reply_contains.to_lowercase()),
                "command {:?} expected reply to contain {:?}, got {:?}",
                case.command,
                case.expect_reply_contains,
                result.reply
            );
            assert!(result.integration_handoff.is_none());
            let _ = std::fs::remove_file(db_path);
        }
    }

    #[test]
    fn eval_golden_f_automation_execution() {
        run_automation_execution_file("f_automation_execution.json");
    }

    #[test]
    fn eval_golden_f_ocr_watch_execution() {
        run_automation_execution_file("f_ocr_watch_execution.json");
    }

    #[test]
    fn eval_golden_f_schedule_execution() {
        run_automation_execution_file("f_schedule_execution.json");
    }
}

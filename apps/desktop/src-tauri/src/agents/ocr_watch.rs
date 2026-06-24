use super::{AgentContext, StepResult};
use crate::db::automation_store::{
    delete_ocr_watch, list_ocr_watches, save_ocr_watch, OcrWatchRecord,
};
use crate::integrations::{parse_ocr_watch_command, OcrWatchAction};

pub fn run_ocr_watch_terminal(ctx: &AgentContext) -> Result<StepResult, String> {
    let Some(watch_action) = parse_ocr_watch_command(&ctx.command) else {
        return Ok(StepResult::failed(
            "Could not parse an OCR watch command.".to_string(),
        ));
    };

    match watch_action {
        OcrWatchAction::ShowWatches => {
            let watches = list_ocr_watches(&ctx.db_path)?;
            if watches.is_empty() {
                return Ok(StepResult::ok("No OCR watches are saved in SQLite."));
            }
            let summary = watches
                .iter()
                .map(|watch| {
                    format!(
                        "{} [{}] every {}s",
                        watch.name,
                        watch.status,
                        watch.interval_ms / 1000
                    )
                })
                .collect::<Vec<_>>()
                .join("; ");
            Ok(StepResult::ok(format!("OCR watches: {summary}")))
        }
        OcrWatchAction::StopWatch => {
            let watches = list_ocr_watches(&ctx.db_path)?;
            for watch in watches {
                delete_ocr_watch(&ctx.db_path, &watch.id)?;
            }
            Ok(StepResult::ok(
                "Stopped and removed all OCR watches.".to_string(),
            ))
        }
        OcrWatchAction::PauseWatches => {
            let watches = list_ocr_watches(&ctx.db_path)?;
            for mut watch in watches {
                watch.status = "paused".to_string();
                save_ocr_watch(&ctx.db_path, &watch)?;
            }
            Ok(StepResult::ok("Paused all OCR watches.".to_string()))
        }
        OcrWatchAction::ResumeWatches => {
            let watches = list_ocr_watches(&ctx.db_path)?;
            for mut watch in watches {
                watch.status = "active".to_string();
                save_ocr_watch(&ctx.db_path, &watch)?;
            }
            Ok(StepResult::ok("Resumed all OCR watches.".to_string()))
        }
        OcrWatchAction::StartWatch => {
            let id = format!(
                "ocr-watch-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|duration| duration.as_millis())
                    .unwrap_or(0)
            );
            let watch = OcrWatchRecord {
                id,
                name: ctx.command.chars().take(48).collect(),
                scope: "screen".to_string(),
                app_name: None,
                region: None,
                rect: None,
                status: "active".to_string(),
                interval_ms: 60_000,
                log_to_notion: Some(false),
                create_task_on_match: Some(false),
                action: None,
                rule: Some(serde_json::json!({ "type": "any_change" })),
                last_text: None,
                last_match_key: None,
                last_checked_at: None,
            };
            save_ocr_watch(&ctx.db_path, &watch)?;
            Ok(StepResult::ok(format!(
                "Started OCR watch \"{}\" and saved it to SQLite.",
                watch.name
            )))
        }
    }
}

pub fn run_desktop_schedules_terminal(ctx: &AgentContext) -> Result<StepResult, String> {
    use crate::db::automation_store::list_desktop_schedules;

    let normalized = ctx.command.trim().to_lowercase();
    if normalized.contains("schedule") || normalized.contains("schedules") {
        let schedules = list_desktop_schedules(&ctx.db_path)?;
        if schedules.is_empty() {
            return Ok(StepResult::ok("No desktop schedules are saved in SQLite."));
        }
        let summary = schedules
            .iter()
            .map(|schedule| {
                format!(
                    "{} due {} → {}",
                    schedule.project_name, schedule.due_at, schedule.action_label
                )
            })
            .collect::<Vec<_>>()
            .join("; ");
        return Ok(StepResult::ok(format!("Desktop schedules: {summary}")));
    }

    Ok(StepResult::failed(
        "Could not parse a desktop schedule command.".to_string(),
    ))
}

use std::path::Path;

use crate::gateway::config::GatewayConfig;

use super::topic_graph::{get_topic_graph, query_topic_neighbors};
use super::travel::list_travel;

pub fn is_world_model_query(command: &str) -> bool {
    let normalized = command.trim().to_lowercase();
    normalized.contains("who is involved in")
        || normalized.contains("what commitments")
        || normalized.contains("what if i cancel trip")
        || normalized.contains("world model")
        || normalized.contains("topic graph for")
        || normalized.contains("connected to")
}

pub fn answer_world_model_query(
    db_path: &Path,
    config: &GatewayConfig,
    command: &str,
) -> Result<String, String> {
    if !config.labs.world_model_queries {
        return Ok(
            "World model queries are disabled. Enable gateway.labs.worldModelQueries first."
                .to_string(),
        );
    }

    let normalized = command.trim().to_lowercase();
    if normalized.contains("what if i cancel trip") {
        return simulate_trip_cancel(db_path, command);
    }
    if normalized.contains("what commitments") {
        return Ok(list_week_commitments(db_path));
    }
    if let Some(query) = extract_after_phrase(command, "who is involved in") {
        return query_topic_neighbors(db_path, &query);
    }
    if let Some(query) = extract_after_phrase(command, "topic graph for") {
        return query_topic_neighbors(db_path, &query);
    }
    if let Some(query) = extract_after_phrase(command, "connected to") {
        return query_topic_neighbors(db_path, &query);
    }

    let graph = get_topic_graph(db_path, 20)?;
    Ok(format!(
        "World model snapshot: {} entities, {} relations. Ask \"topic graph for <name>\" for neighbors.",
        graph.nodes.len(),
        graph.edges.len()
    ))
}

fn extract_after_phrase(command: &str, phrase: &str) -> Option<String> {
    let lower = command.to_lowercase();
    let index = lower.find(phrase)?;
    let rest = command[index + phrase.len()..].trim();
    if rest.is_empty() {
        None
    } else {
        Some(rest.trim_matches('"').trim_matches('?').trim().to_string())
    }
}

fn list_week_commitments(db_path: &Path) -> String {
    if let Ok(tasks) = crate::integrations::notion::list_planner_tasks(db_path) {
        let today = chrono::Local::now().date_naive();
        let week_end = today + chrono::Duration::days(7);
        let lines: Vec<_> = tasks
            .iter()
            .filter(|task| {
                task.due
                    .as_deref()
                    .and_then(|due| {
                        chrono::NaiveDate::parse_from_str(&due[..10.min(due.len())], "%Y-%m-%d")
                            .ok()
                    })
                    .is_some_and(|due| due >= today && due <= week_end)
            })
            .take(8)
            .map(|task| {
                format!(
                    "- {} (due {})",
                    task.title,
                    task.due.as_deref().unwrap_or("")
                )
            })
            .collect();
        if !lines.is_empty() {
            return format!("Commitments this week:\n{}", lines.join("\n"));
        }
    }
    "No dated commitments found for the next 7 days.".to_string()
}

fn simulate_trip_cancel(db_path: &Path, command: &str) -> Result<String, String> {
    let trips = list_travel(db_path)?;
    let needle = command
        .split_whitespace()
        .skip_while(|word| !word.eq_ignore_ascii_case("trip"))
        .skip(1)
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches('"')
        .to_string();
    let trip = trips
        .iter()
        .find(|trip| {
            if needle.is_empty() {
                true
            } else {
                trip.title.to_lowercase().contains(&needle.to_lowercase())
            }
        })
        .ok_or_else(|| "No matching trip found in travel memory.".to_string())?;

    let mut impacts = vec![
        format!("Trip: {}", trip.title),
        "- Calendar: review and cancel flight/hotel events manually.".to_string(),
        "- Notion: close or reschedule related trip tasks.".to_string(),
        "- Email: notify attendees if meetings were tied to this trip.".to_string(),
    ];
    if let Ok(neighbors) = query_topic_neighbors(db_path, &trip.title) {
        impacts.push(format!("Graph neighbors:\n{neighbors}"));
    }
    Ok(format!(
        "Simulated cancel impact for \"{}\":\n{}",
        trip.title,
        impacts.join("\n")
    ))
}

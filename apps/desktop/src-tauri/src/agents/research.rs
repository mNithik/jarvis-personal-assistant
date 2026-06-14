use super::{extract_google_search_query, Agent, AgentContext, StepResult};
use crate::commands::desktop::open_named_target;
use crate::gateway::types::GatewayAgentKind;

pub struct ResearchAgent;

impl Agent for ResearchAgent {
    fn kind(&self) -> GatewayAgentKind {
        GatewayAgentKind::Research
    }

    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String> {
        let query = extract_research_query(&ctx.command).or_else(|| {
            extract_google_search_query(&ctx.command).map(|value| value.trim().to_string())
        });

        let Some(query) = query.filter(|value| !value.is_empty()) else {
            return Ok(StepResult::failed(
                "Research agent needs a topic. Try \"research rust async patterns\" or \"look up quantum computing\".",
            ));
        };

        let encoded = query.replace(' ', "+");
        let search_url = format!("https://www.google.com/search?q={encoded}");
        if open_named_target(&ctx.db_path, &search_url).is_ok() {
            return Ok(StepResult::ok(format!(
                "Research (local): opened browser search for \"{query}\". Ask for a deeper summary if you want synthesis."
            )));
        }

        Ok(StepResult::handoff(
            "research.web",
            "search_google",
            Some(query.clone()),
            format!(
                "Research handoff: searching the web for \"{query}\" via the desktop bridge."
            ),
        ))
    }
}

pub fn extract_research_query(command: &str) -> Option<String> {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();
    const PREFIXES: &[&str] = &["research ", "look up ", "investigate "];
    for prefix in PREFIXES {
        if normalized.starts_with(prefix) {
            let query = trimmed[prefix.len()..].trim();
            if !query.is_empty() {
                return Some(query.to_string());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_research_topic() {
        assert_eq!(
            extract_research_query("research rust ownership"),
            Some("rust ownership".to_string())
        );
    }
}

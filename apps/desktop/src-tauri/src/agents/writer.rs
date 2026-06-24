use super::{Agent, AgentContext, StepResult};

pub struct WriterAgent;

impl Agent for WriterAgent {
    fn kind(&self) -> crate::gateway::types::GatewayAgentKind {
        crate::gateway::types::GatewayAgentKind::Writer
    }

    fn run_step(&self, ctx: &AgentContext) -> Result<StepResult, String> {
        let draft = extract_draft_body(&ctx.command);
        if draft.is_empty() {
            return Ok(StepResult::failed(
                "Writer agent needs content. Try \"draft a note about ...\" or \"summarize this for Notion\".",
            ));
        }

        Ok(StepResult::handoff(
            "integrations.notion",
            "create_note",
            Some(draft.clone()),
            format!(
                "Writer draft ready for Notion handoff ({} chars). Approve before sending.",
                draft.len()
            ),
        ))
    }
}

pub fn extract_draft_body(command: &str) -> String {
    let trimmed = command.trim();
    let normalized = trimmed.to_lowercase();
    const PREFIXES: &[&str] = &["draft ", "write ", "summarize for notion ", "compose "];
    for prefix in PREFIXES {
        if normalized.starts_with(prefix) {
            let body = trimmed[prefix.len()..].trim();
            if !body.is_empty() {
                return body.to_string();
            }
        }
    }
    String::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_draft_prefix() {
        assert_eq!(
            extract_draft_body("draft meeting follow-up email"),
            "meeting follow-up email"
        );
    }
}

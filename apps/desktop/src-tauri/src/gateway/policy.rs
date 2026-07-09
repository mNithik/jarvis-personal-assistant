use super::types::{GatewayAgentKind, GatewayPolicyClass, GatewayRoute};

pub fn resolve_policy_class(capability_id: &str, agent: &GatewayAgentKind) -> GatewayPolicyClass {
    let id = capability_id.to_lowercase();

    if id.contains("delete") || id.ends_with(".delete") {
        return GatewayPolicyClass::Delete;
    }
    if id.contains("pay") || id.contains("x402") {
        return GatewayPolicyClass::Pay;
    }
    if id.starts_with("integrations.gmail") || id.starts_with("integrations.google") {
        return GatewayPolicyClass::Send;
    }
    if id.starts_with("integrations.slack_send") {
        return GatewayPolicyClass::Send;
    }
    if id.starts_with("integrations.calendar") {
        return GatewayPolicyClass::Schedule;
    }
    if id.starts_with("integrations.notion") || id.starts_with("integrations.spotify") {
        return GatewayPolicyClass::Write;
    }
    if id.starts_with("memory.") {
        return GatewayPolicyClass::Write;
    }
    if matches!(
        agent,
        GatewayAgentKind::Builder | GatewayAgentKind::Automation | GatewayAgentKind::Command
    ) && (id.starts_with("command.desktop")
        || id.starts_with("command.study")
        || id.starts_with("command.shell")
        || id.starts_with("builder."))
    {
        return GatewayPolicyClass::Execute;
    }
    if id.starts_with("command.files") || id.starts_with("command.clipboard") {
        return GatewayPolicyClass::Read;
    }
    if id.starts_with("vision.") {
        return GatewayPolicyClass::Read;
    }

    GatewayPolicyClass::Read
}

pub fn route_policy_class(route: &GatewayRoute) -> GatewayPolicyClass {
    resolve_policy_class(&route.capability_id, &route.agent)
}

pub fn requires_preview(class: GatewayPolicyClass) -> bool {
    matches!(
        class,
        GatewayPolicyClass::Send | GatewayPolicyClass::Schedule
    )
}

pub fn requires_explicit_confirm(class: GatewayPolicyClass) -> bool {
    matches!(class, GatewayPolicyClass::Delete | GatewayPolicyClass::Pay)
}

pub fn requires_confirmation(class: GatewayPolicyClass) -> bool {
    requires_preview(class)
        || requires_explicit_confirm(class)
        || matches!(class, GatewayPolicyClass::Execute)
}

pub fn policy_class_label(class: GatewayPolicyClass) -> &'static str {
    match class {
        GatewayPolicyClass::Read => "read",
        GatewayPolicyClass::Write => "write",
        GatewayPolicyClass::Send => "send",
        GatewayPolicyClass::Schedule => "schedule",
        GatewayPolicyClass::Delete => "delete",
        GatewayPolicyClass::Execute => "execute",
        GatewayPolicyClass::Pay => "pay",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::types::GatewayAgentKind;

    #[test]
    fn gmail_maps_to_send() {
        assert_eq!(
            resolve_policy_class("integrations.gmail", &GatewayAgentKind::Integrations),
            GatewayPolicyClass::Send
        );
        assert_eq!(
            resolve_policy_class("integrations.google", &GatewayAgentKind::Integrations),
            GatewayPolicyClass::Send
        );
    }

    #[test]
    fn slack_send_maps_to_send() {
        assert_eq!(
            resolve_policy_class("integrations.slack_send", &GatewayAgentKind::Integrations),
            GatewayPolicyClass::Send
        );
    }

    #[test]
    fn calendar_maps_to_schedule() {
        assert_eq!(
            resolve_policy_class("integrations.calendar", &GatewayAgentKind::Integrations),
            GatewayPolicyClass::Schedule
        );
    }

    #[test]
    fn desktop_maps_to_execute() {
        assert_eq!(
            resolve_policy_class("command.desktop", &GatewayAgentKind::Command),
            GatewayPolicyClass::Execute
        );
    }

    #[test]
    fn files_maps_to_read() {
        assert_eq!(
            resolve_policy_class("command.files", &GatewayAgentKind::Command),
            GatewayPolicyClass::Read
        );
    }
}

import type { GatewayConfig, GatewayFeatures } from "../../services/jarvisApi";
import type { CommandRouterDeps } from "./commandRouterDepTypes";

type ResolvedCommandRouterDeps = Required<CommandRouterDeps>;

export function isGatewayFeatureActive(
  config: GatewayConfig | null | undefined,
  feature: keyof GatewayFeatures,
): boolean {
  return Boolean(config?.enabled && config.features[feature]);
}

export function blockLegacyGatewayFeature(
  deps: ResolvedCommandRouterDeps,
  feature: keyof GatewayFeatures,
  label: string,
): boolean {
  if (!isGatewayFeatureActive(deps.gatewayConfig, feature)) {
    return false;
  }

  const detail = `${label} runs through the JARVIS gateway when it is enabled. Say the command again or check gateway settings.`;
  deps.setCommandResult({
    title: `${label} (gateway)`,
    detail,
  });
  deps.setStatusMessage(detail);
  deps.setVoiceSessionPhase("ready");
  deps.appendConversationTurn("jarvis", detail);
  deps.speakIfEnabled(detail);
  return true;
}

import * as J from "../../legacy/appHelpers";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import { createNotionNote, writeClipboardText } from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";

export async function handleModelIntent(
  deps: ResolvedCommandRouterDeps,
  intent: import("../jarvisCommandTypes").CommandIntent,
  executeIntent: ExecuteIntentFn,
): Promise<ExecuteIntentResult> {
  if (intent.kind === "test_model_provider") {
        await deps.handleTestModelProvider(intent.providerId);
        deps.setStatusMessage("Model provider test completed through the router.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn(
          "jarvis",
          `I tested ${J.MODEL_PROVIDER_LABELS[intent.providerId]} through the zero-cost model router.`,
        );
        deps.speakIfEnabled(`I tested ${J.MODEL_PROVIDER_LABELS[intent.providerId]}.`);
    return { status: "handled" };
  } else if (intent.kind === "explain_model_route") {
        const route = deps.resolveModelRoute(intent.prompt);
        deps.setCommandResult({
          title: "Model route decision",
          detail: `${intent.prompt}\n\nTask: ${route.taskType}\nProvider: ${J.MODEL_PROVIDER_LABELS[route.providerId]}\nModel: ${route.model || "not set"}\nStatus: ${route.blocked ? "blocked" : "ready"}\nReason: ${route.reason}`,
          routeLabel: "Model Router",
        });
        deps.setStatusMessage("Model route explained without calling a model.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `I would route that to ${J.MODEL_PROVIDER_LABELS[route.providerId]} for ${route.taskType}.`);
        deps.speakIfEnabled(`I would route that to ${J.MODEL_PROVIDER_LABELS[route.providerId]}.`);
    return { status: "handled" };
  } else if (intent.kind === "generate_model_draft") {
        const route = deps.resolveModelRoute(intent.prompt, intent.taskType);
        if (
          !intent.confirmedCloud &&
          J.CLOUD_MODEL_PROVIDERS.has(route.providerId) &&
          deps.isSensitiveModelPrompt(intent.prompt, route.taskType)
        ) {
          deps.setPendingClarification({
            prompt: `This draft may include private context and would use ${J.MODEL_PROVIDER_LABELS[route.providerId]}. Send it to cloud for drafting?`,
            choices: [
              {
                label: `Use ${J.MODEL_PROVIDER_LABELS[route.providerId]}`,
                intent: { ...intent, confirmedCloud: true },
              },
            ],
            originalPhrase: intent.prompt,
          });
          deps.setCommandResult({
            title: "Cloud confirmation needed",
            detail: `JARVIS is protecting this prompt because it looks sensitive. Say yes to use ${J.MODEL_PROVIDER_LABELS[route.providerId]}, or switch the route to local first.`,
            routeLabel: "Model Router Safety",
          });
          deps.setStatusMessage("Waiting for cloud model confirmation.");
          deps.setVoiceSessionPhase("ready");
          deps.appendConversationTurn("jarvis", `This may include private context. Should I use ${J.MODEL_PROVIDER_LABELS[route.providerId]} for the draft?`);
          deps.speakIfEnabled(`This may include private context. Should I use ${J.MODEL_PROVIDER_LABELS[route.providerId]}?`);
          deps.openFollowUpWindow("clarification");
        return { status: "return", completed: false };
        return { status: "return", completed: true };
        }
        await deps.generateSafeModelDraft(intent.prompt, intent.taskType);
        deps.setStatusMessage("Model draft generated safely.");
        deps.setVoiceSessionPhase("ready");
  } else if (intent.kind === "copy_latest_model_draft") {
        if (!deps.latestGeneratedDraft) {
          throw new Error("There is no generated draft yet.");
        }
        await writeClipboardText(deps.latestGeneratedDraft.text);
        deps.setCommandResult({
          title: "Draft copied",
          detail: "Copied the latest generated draft to your clipboard. Nothing was sent or saved elsewhere.",
        });
        deps.setStatusMessage("Latest generated draft copied to clipboard.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I copied the latest draft to your clipboard.");
        deps.speakIfEnabled("I copied the latest draft to your clipboard.");
    return { status: "handled" };
  } else if (intent.kind === "save_latest_model_draft_to_notion") {
        if (!deps.latestGeneratedDraft) {
          throw new Error("There is no generated draft yet.");
        }
        const note = await createNotionNote(
          `Generated Draft\n\nPrompt: ${deps.latestGeneratedDraft.prompt}\nProvider: ${J.MODEL_PROVIDER_LABELS[deps.latestGeneratedDraft.providerId]}\nModel: ${deps.latestGeneratedDraft.model}\nCreated: ${new Date(deps.latestGeneratedDraft.createdAt).toLocaleString()}\n\n${deps.latestGeneratedDraft.text}`,
        );
        deps.setRecentNotes((current) => [note, ...current].slice(0, 5));
        deps.setCommandResult({
          title: "Draft saved to Notion",
          detail: `Saved the latest generated draft to Notion as "${note.title}".`,
        });
        deps.setStatusMessage("Latest generated draft saved to Notion after approval.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I saved the approved draft to Notion.");
        deps.speakIfEnabled("I saved the approved draft to Notion.");
    return { status: "handled" };
  } else if (intent.kind === "run_model_benchmark") {
        await deps.runModelBenchmark();
        deps.setStatusMessage("Model benchmark completed.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I finished the model benchmark.");
        deps.speakIfEnabled("I finished the model benchmark.");
    return { status: "handled" };
  } else if (intent.kind === "compare_model_responses") {
        await deps.compareModelResponses(intent.prompt);
        deps.setStatusMessage("Model comparison completed.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I compared the available model responses.");
        deps.speakIfEnabled("I compared the available model responses.");
    return { status: "handled" };
  } else if (intent.kind === "choose_model_comparison_winner") {
        deps.chooseModelComparisonWinner(intent.providerId, intent.taskType);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `${J.MODEL_PROVIDER_LABELS[intent.providerId]} is now the preferred model route.`);
        deps.speakIfEnabled(`${J.MODEL_PROVIDER_LABELS[intent.providerId]} is now preferred.`);
    return { status: "handled" };
  } else if (intent.kind === "recommend_model_routes") {
        deps.recommendModelRoutesFromHistory();
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I recommended model routes from the latest benchmark and usage history.");
        deps.speakIfEnabled("I recommended model routes from the latest benchmark and usage history.");
    return { status: "handled" };
  } else if (intent.kind === "set_model_provider_for_task") {
        deps.setPreferredModelProvider(intent.taskType, intent.providerId);
        deps.setCommandResult({
          title: "Model preference updated",
          detail: `${J.MODEL_PROVIDER_LABELS[intent.providerId]} is now preferred for ${intent.taskType}.`,
        });
        deps.setStatusMessage("Model provider preference updated.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", `${J.MODEL_PROVIDER_LABELS[intent.providerId]} is now preferred for ${intent.taskType}.`);
        deps.speakIfEnabled(`${J.MODEL_PROVIDER_LABELS[intent.providerId]} is now preferred for ${intent.taskType}.`);
    return { status: "handled" };
  } else if (intent.kind === "set_private_model_mode") {
        deps.updateModelRouterConfig({ allowCloudForPrivateMemory: !intent.localOnly });
        deps.setCommandResult({
          title: intent.localOnly ? "Local-only model mode on" : "Cloud private mode allowed",
          detail: intent.localOnly
            ? "Sensitive and private-memory prompts will stay on local providers unless you manually switch this off."
            : "JARVIS may use cloud providers for private prompts after the safety confirmation.",
        });
        deps.setStatusMessage(intent.localOnly ? "Local-only model mode enabled." : "Cloud private model mode allowed.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", intent.localOnly ? "Local-only model mode is on." : "Cloud private model mode is allowed.");
        deps.speakIfEnabled(intent.localOnly ? "Local-only model mode is on." : "Cloud private model mode is allowed.");
    return { status: "handled" };
  }
  return { status: "unhandled" };
}

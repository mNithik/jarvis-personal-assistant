import * as J from "../../legacy/appHelpers";
import type { ResolvedCommandRouterDeps } from "../commandRouterTypes";
import { openBrowserUrl } from "../../../services/jarvisApi";
import type { ExecuteIntentFn, ExecuteIntentResult } from "./types";

/** Gateway-owned panel/window intents stripped in Wave R2; shell UX controls remain. */
export async function handleShellIntent(
  deps: ResolvedCommandRouterDeps,
  intent: import("../jarvisCommandTypes").CommandIntent,
  _executeIntent: ExecuteIntentFn,
): Promise<ExecuteIntentResult> {
  if (intent.kind === "set_shell_bar") {
    deps.dispatchUi({ type: "setQuickBarVisibility", visible: intent.visible });
    deps.setCommandResult({
      title: intent.visible ? "Command bar shown" : "Command bar hidden",
      detail: intent.visible
        ? "The floating JARVIS command bar is back."
        : "The floating JARVIS command bar is hidden. Use the small J button to bring it back.",
    });
    deps.setStatusMessage(intent.visible ? "JARVIS quick bar shown." : "JARVIS quick bar hidden.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn(
      "jarvis",
      intent.visible ? "I brought the command bar back." : "I hid the command bar.",
    );
    deps.speakIfEnabled(intent.visible ? "I brought the command bar back." : "I hid the command bar.");
    return { status: "handled" };
  }

  if (intent.kind === "set_cockpit_mode") {
    deps.dispatchUi({ type: intent.active ? "openCockpit" : "closeCockpit" });
    if (intent.active) {
      deps.dispatchUi({ type: "setQuickBarVisibility", visible: true });
    }
    deps.setCommandResult({
      title: intent.active ? "Cockpit mode online" : "Cockpit mode closed",
      detail: intent.active
        ? "JARVIS cockpit mode is now focused around missions, modules, and live system state."
        : "Returned to the standard command center layout.",
    });
    deps.setStatusMessage(intent.active ? "JARVIS cockpit mode online." : "JARVIS cockpit mode closed.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", intent.active ? "Cockpit mode is online." : "Cockpit mode is closed.");
    deps.speakIfEnabled(intent.active ? "Cockpit mode is online." : "Cockpit mode is closed.");
    return { status: "handled" };
  }

  if (intent.kind === "set_home_app") {
    deps.dispatchUi({ type: "setWorkspace", workspaceId: intent.app });
    const label =
      intent.app === "connections" ? "Connections" : intent.app.charAt(0).toUpperCase() + intent.app.slice(1);
    deps.setCommandResult({
      title: "JARVIS app opened",
      detail: `Switched the main assistant launchpad to ${label}.`,
    });
    deps.setStatusMessage(`${label} app selected.`);
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", `I opened the ${label} app.`);
    deps.speakIfEnabled(`I opened the ${label} app.`);
    return { status: "handled" };
  }

  if (intent.kind === "set_conversation_backend") {
    deps.setConversationBackend(intent.backend);
    const label =
      intent.backend === "ollama" ? "Ollama" : intent.backend === "auto" ? "Auto" : "Heuristics";
    deps.setCommandResult({
      title: "Conversation brain updated",
      detail:
        intent.backend === "auto"
          ? "JARVIS will now prefer heuristics for exact commands and use Ollama for fuzzier requests."
          : `JARVIS is now using ${label} as the active conversation brain.`,
    });
    deps.setStatusMessage(`Conversation brain set to ${label}.`);
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", `I switched the conversation brain to ${label}.`);
    deps.speakIfEnabled(`I switched the conversation brain to ${label}.`);
    return { status: "handled" };
  }

  if (intent.kind === "open_current_browser_target") {
    const browserContext = J.resolveActiveBrowserContext(deps.activeConversationContext);
    if (!browserContext) {
      throw new Error(
        "There is no active browser target in the conversation yet. Open or search something first.",
      );
    }

    await openBrowserUrl(browserContext.url);
    const reply = J.buildOpenSiteReply(browserContext.label);
    deps.setCommandResult({
      title: "Website opened",
      detail: `Opened ${browserContext.label}.`,
    });
    deps.setStatusMessage("Active browser target opened through JARVIS.");
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "set_voice_reply_mode") {
    deps.setVoiceReplyMode(intent.mode);
    const reply = J.buildVoiceReplyModeReply(intent.mode);
    deps.setCommandResult({
      title: "Voice reply mode updated",
      detail: J.buildVoiceReplyModeDetail(intent.mode),
    });
    deps.setStatusMessage(`Voice reply mode set to ${J.formatVoiceReplyModeLabel(intent.mode)}.`);
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    if (intent.mode !== "quiet") {
      deps.speakIfEnabled(reply);
    }
    return { status: "handled" };
  }

  if (intent.kind === "report_voice_reply_mode") {
    const label = J.formatVoiceReplyModeLabel(deps.voiceReplyMode);
    const reply = `I'm currently using ${label} voice mode.`;
    deps.setCommandResult({
      title: "Voice reply mode",
      detail: J.buildVoiceReplyModeDetail(deps.voiceReplyMode),
    });
    deps.setStatusMessage(`Voice reply mode is ${label}.`);
    deps.setVoiceSessionPhase("ready");
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "standby_mode") {
    deps.returnToArmedWakeMode();
    deps.setWakeModeStatus({
      assistantName: deps.assistantName,
      wakeModeEnabled: true,
      message: `${deps.assistantName} is standing by and waiting for the wake phrase.`,
    });
    const reply = J.buildStandbyReply(deps.assistantName);
    deps.setCommandResult({
      title: "JARVIS is standing by",
      detail: "Wake mode stays on, and the assistant has returned to the armed standby state.",
    });
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "sleep_mode") {
    deps.stopHandsFreeSession();
    deps.setWakeModeEnabled(false);
    deps.setWakeModeStatus({
      assistantName: deps.assistantName,
      wakeModeEnabled: false,
      message: `${deps.assistantName} is sleeping for this session.`,
    });
    const reply = J.buildSleepReply(deps.assistantName);
    deps.setCommandResult({
      title: "JARVIS is sleeping",
      detail: "Wake mode is off for this session. Turn it back on when you want hands-free listening again.",
    });
    deps.setStatusMessage(`${deps.assistantName} is sleeping. Wake mode is off for this session.`);
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    return { status: "handled" };
  }

  if (intent.kind === "shutdown_app") {
    deps.stopHandsFreeSession();
    const reply = J.buildShutdownReply(deps.assistantName);
    deps.setCommandResult({
      title: "Shutting down JARVIS",
      detail: "Closing the app now.",
    });
    deps.setStatusMessage(`Shutting down ${deps.assistantName}.`);
    deps.appendConversationTurn("jarvis", reply);
    deps.speakIfEnabled(reply);
    window.setTimeout(() => {
      void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().close());
    }, 300);
    return { status: "handled" };
  }

  return { status: "unhandled" };
}

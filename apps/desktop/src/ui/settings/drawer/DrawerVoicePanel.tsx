import AdvancedConfigPanel from "../AdvancedConfigPanel";
import { useJarvisSystemDrawer } from "./JarvisSystemDrawerContext";

export default function DrawerVoicePanel() {
  const {
    assistantName,
    conversationBackend,
    handleSaveLocalSpeechConfig,
    handleSaveLocalVoiceConfig,
    handleSaveOllamaConfig,
    handleSaveWakeMode,
    handleWakeActivation,
    localExecutablePath,
    localModelPath,
    localTtsExecutablePath,
    localTtsModelPath,
    ollamaBaseUrl,
    ollamaModelName,
    resetToRecommendedAssistantDefaults,
    restoreSavedAssistantDefaults,
    saveCurrentAssistantDefaults,
    setAssistantName,
    setConversationBackend,
    setLocalExecutablePath,
    setLocalModelPath,
    setLocalTtsExecutablePath,
    setLocalTtsModelPath,
    setOllamaBaseUrl,
    setOllamaModelName,
    setWakeModeEnabled,
    speechOutputBackend,
    voiceBackend,
    wakeModeEnabled,
  } = useJarvisSystemDrawer();

  return (
    <AdvancedConfigPanel
      title="Voice and conversation"
      summary="Conversation brain, speech I/O, Ollama, and wake settings."
    >
      <div className="local-config-card">
        <span className="memory-meta">Current conversation brain: {conversationBackend}</span>
        <div className="workflow-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setConversationBackend("heuristics")}
            disabled={conversationBackend === "heuristics"}
          >
            Switch to heuristics
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setConversationBackend("auto")}
            disabled={conversationBackend === "auto"}
          >
            Switch to auto
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setConversationBackend("ollama")}
            disabled={conversationBackend === "ollama"}
          >
            Switch to Ollama
          </button>
        </div>
      </div>
      <div className="local-config-card">
        <span className="memory-meta">
          Save the current voice, speech, auto-route, reply mode, and conversation brain as your assistant defaults.
        </span>
        <div className="workflow-actions">
          <button className="secondary-button" type="button" onClick={saveCurrentAssistantDefaults}>
            Save current defaults
          </button>
          <button className="secondary-button" type="button" onClick={restoreSavedAssistantDefaults}>
            Restore saved defaults
          </button>
          <button className="secondary-button" type="button" onClick={resetToRecommendedAssistantDefaults}>
            Reset to recommended defaults
          </button>
        </div>
      </div>
      {voiceBackend === "local" ? (
        <div className="local-config-card">
          <input
            value={localExecutablePath}
            onChange={(event) => setLocalExecutablePath(event.target.value)}
            placeholder="Path to whisper-cli.exe"
          />
          <input
            value={localModelPath}
            onChange={(event) => setLocalModelPath(event.target.value)}
            placeholder="Path to ggml model file (.bin)"
          />
          <button className="secondary-button" type="button" onClick={handleSaveLocalVoiceConfig}>
            Save local config
          </button>
        </div>
      ) : null}
      {speechOutputBackend === "local" ? (
        <div className="local-config-card">
          <input
            value={localTtsExecutablePath}
            onChange={(event) => setLocalTtsExecutablePath(event.target.value)}
            placeholder="Path to piper.exe"
          />
          <input
            value={localTtsModelPath}
            onChange={(event) => setLocalTtsModelPath(event.target.value)}
            placeholder="Path to Piper voice model (.onnx)"
          />
          <button className="secondary-button" type="button" onClick={handleSaveLocalSpeechConfig}>
            Save local speech config
          </button>
        </div>
      ) : null}
      <div className="local-config-card">
        <input
          value={ollamaBaseUrl}
          onChange={(event) => setOllamaBaseUrl(event.target.value)}
          placeholder="Ollama base URL"
        />
        <input
          value={ollamaModelName}
          onChange={(event) => setOllamaModelName(event.target.value)}
          placeholder="Ollama model name"
        />
        <button className="secondary-button" type="button" onClick={handleSaveOllamaConfig}>
          Save Ollama config
        </button>
      </div>
      <div className="local-config-card">
        <input
          value={assistantName}
          onChange={(event) => setAssistantName(event.target.value)}
          placeholder="Assistant name"
        />
        <div className="wake-row">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setWakeModeEnabled((current) => !current)}
          >
            {wakeModeEnabled ? "Wake mode on" : "Wake mode off"}
          </button>
          <button className="secondary-button" type="button" onClick={handleSaveWakeMode}>
            Save wake settings
          </button>
          <button className="secondary-button" type="button" onClick={handleWakeActivation}>
            Wake {assistantName}
          </button>
        </div>
      </div>
    </AdvancedConfigPanel>
  );
}

import {
  MODEL_PROVIDER_LABELS,
  MODEL_PROVIDER_PRESETS,
  type ModelProviderId,
} from "../../../features/legacy/appHelpers";
import AdvancedConfigPanel from "../AdvancedConfigPanel";
import { useJarvisSystemDrawer } from "./JarvisSystemDrawerContext";

export default function DrawerModelsPanel() {
  const {
    applyModelProviderPreset,
    createDefaultModelRouterConfig,
    deleteSavedProviderApiKey,
    embeddingBackend,
    embeddingModelName,
    embeddingStatusMessage,
    executeIntent,
    handleTestModelProvider,
    isBenchmarkingModels,
    isComparingModels,
    isTestingModelRouter,
    modelBenchmarkResults,
    modelComparisonPrompt,
    modelComparisonRun,
    modelProviderKeyPreview,
    modelProviderKeyStatus,
    modelProviderUsage,
    modelRouterConfig,
    modelRouterStatusMessage,
    saveProviderApiKey,
    setEmbeddingBackend,
    setEmbeddingModelName,
    setModelComparisonPrompt,
    setModelRouterConfig,
    testSavedProviderApiKey,
    updateModelProviderConfig,
    updateModelRouterConfig,
  } = useJarvisSystemDrawer();

  return (
    <AdvancedConfigPanel
      title="Models and embeddings"
      summary="Model router, provider keys, benchmarks, and embedding backend."
    >
      <div className="local-config-card">
        <span className="memory-meta">
          Model router: local-first, NVIDIA first for hosted coding/reasoning, paid providers blocked unless
          explicitly enabled.
        </span>
        <select
          value={modelRouterConfig.defaultProvider}
          onChange={(event) => updateModelRouterConfig({ defaultProvider: event.target.value as ModelProviderId })}
        >
          {(Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[]).map((providerId) => (
            <option key={providerId} value={providerId}>
              {MODEL_PROVIDER_LABELS[providerId]}
            </option>
          ))}
        </select>
        <select
          value={modelRouterConfig.codingProvider}
          onChange={(event) => updateModelRouterConfig({ codingProvider: event.target.value as ModelProviderId })}
        >
          {(Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[]).map((providerId) => (
            <option key={providerId} value={providerId}>
              Coding: {MODEL_PROVIDER_LABELS[providerId]}
            </option>
          ))}
        </select>
        <select
          value={modelRouterConfig.reasoningProvider}
          onChange={(event) => updateModelRouterConfig({ reasoningProvider: event.target.value as ModelProviderId })}
        >
          {(Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[]).map((providerId) => (
            <option key={providerId} value={providerId}>
              Reasoning: {MODEL_PROVIDER_LABELS[providerId]}
            </option>
          ))}
        </select>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={modelRouterConfig.enablePaidProviders}
            onChange={(event) => updateModelRouterConfig({ enablePaidProviders: event.target.checked })}
          />
          Enable paid providers
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={modelRouterConfig.allowCloudForPrivateMemory}
            onChange={(event) => updateModelRouterConfig({ allowCloudForPrivateMemory: event.target.checked })}
          />
          Allow cloud for private memory requests
        </label>
        <input
          type="number"
          min="0"
          value={modelRouterConfig.maxMonthlyApiSpend}
          onChange={(event) => updateModelRouterConfig({ maxMonthlyApiSpend: Number(event.target.value) || 0 })}
          placeholder="Max monthly API spend"
        />
        <input
          value={modelRouterConfig.experimentalLocalReasoningModel}
          onChange={(event) => updateModelRouterConfig({ experimentalLocalReasoningModel: event.target.value })}
          placeholder="Experimental local reasoning model"
        />
        <input
          value={modelRouterConfig.providers.local_ollama.baseUrl}
          onChange={(event) => updateModelProviderConfig("local_ollama", { baseUrl: event.target.value })}
          placeholder="Local Ollama OpenAI-compatible base URL"
        />
        <input
          value={modelRouterConfig.providers.local_ollama.chatModel}
          onChange={(event) =>
            updateModelProviderConfig("local_ollama", {
              chatModel: event.target.value,
              codingModel: event.target.value,
              reasoningModel: event.target.value,
            })
          }
          placeholder="Local Ollama chat model"
        />
        <input
          value={modelRouterConfig.providers.nvidia_nim.apiKey}
          onChange={(event) => updateModelProviderConfig("nvidia_nim", { apiKey: event.target.value })}
          onBlur={(event) => void saveProviderApiKey("nvidia_nim", event.target.value)}
          placeholder={
            modelProviderKeyStatus.nvidia_nim
              ? `Saved: ${modelProviderKeyPreview.nvidia_nim || "Windows Credential Manager"}`
              : "NVIDIA API key"
          }
        />
        <input
          value={modelRouterConfig.providers.nvidia_nim.baseUrl}
          onChange={(event) => updateModelProviderConfig("nvidia_nim", { baseUrl: event.target.value })}
          placeholder="NVIDIA base URL"
        />
        <input
          value={modelRouterConfig.providers.nvidia_nim.chatModel}
          onChange={(event) => updateModelProviderConfig("nvidia_nim", { chatModel: event.target.value })}
          placeholder="NVIDIA chat model"
        />
        <input
          value={modelRouterConfig.providers.nvidia_nim.codingModel}
          onChange={(event) => updateModelProviderConfig("nvidia_nim", { codingModel: event.target.value })}
          placeholder="NVIDIA coding model"
        />
        <input
          value={modelRouterConfig.providers.nvidia_nim.reasoningModel}
          onChange={(event) => updateModelProviderConfig("nvidia_nim", { reasoningModel: event.target.value })}
          placeholder="NVIDIA reasoning model"
        />
        <input
          value={modelRouterConfig.providers.gemini.apiKey}
          onChange={(event) => updateModelProviderConfig("gemini", { apiKey: event.target.value })}
          onBlur={(event) => void saveProviderApiKey("gemini", event.target.value)}
          placeholder={
            modelProviderKeyStatus.gemini
              ? `Saved: ${modelProviderKeyPreview.gemini || "Windows Credential Manager"}`
              : "Gemini API key"
          }
        />
        <input
          value={modelRouterConfig.providers.gemini.baseUrl}
          onChange={(event) => updateModelProviderConfig("gemini", { baseUrl: event.target.value })}
          placeholder="Gemini base URL"
        />
        <input
          value={modelRouterConfig.providers.gemini.chatModel}
          onChange={(event) =>
            updateModelProviderConfig("gemini", {
              chatModel: event.target.value,
              codingModel: event.target.value,
              reasoningModel: event.target.value,
            })
          }
          placeholder="Gemini model, e.g. gemini-2.5-flash"
        />
        <input
          value={modelRouterConfig.providers.groq.apiKey}
          onChange={(event) => updateModelProviderConfig("groq", { apiKey: event.target.value })}
          onBlur={(event) => void saveProviderApiKey("groq", event.target.value)}
          placeholder={
            modelProviderKeyStatus.groq
              ? `Saved: ${modelProviderKeyPreview.groq || "Windows Credential Manager"}`
              : "Groq API key"
          }
        />
        <input
          value={modelRouterConfig.providers.openrouter.apiKey}
          onChange={(event) => updateModelProviderConfig("openrouter", { apiKey: event.target.value })}
          onBlur={(event) => void saveProviderApiKey("openrouter", event.target.value)}
          placeholder={
            modelProviderKeyStatus.openrouter
              ? `Saved: ${modelProviderKeyPreview.openrouter || "Windows Credential Manager"}`
              : "OpenRouter API key"
          }
        />
        <div className="workflow-actions">
          {(["nvidia_nim", "gemini", "groq", "openrouter"] as ModelProviderId[]).map((providerId) => (
            <button
              className="secondary-button"
              type="button"
              key={`key-test-${providerId}`}
              onClick={() => void testSavedProviderApiKey(providerId)}
            >
              Check {MODEL_PROVIDER_LABELS[providerId]} key
            </button>
          ))}
          {(["nvidia_nim", "gemini", "groq", "openrouter"] as ModelProviderId[]).map((providerId) => (
            <button
              className="secondary-button"
              type="button"
              key={`key-delete-${providerId}`}
              onClick={() => void deleteSavedProviderApiKey(providerId)}
            >
              Delete {MODEL_PROVIDER_LABELS[providerId]} key
            </button>
          ))}
        </div>
        <div className="workflow-actions">
          {MODEL_PROVIDER_PRESETS.map((preset) => (
            <button
              className="secondary-button"
              type="button"
              key={preset.id}
              onClick={() => applyModelProviderPreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="workflow-actions">
          {(Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[]).map((providerId) => (
            <button
              className="secondary-button"
              type="button"
              key={`chat-${providerId}`}
              onClick={() => void executeIntent({ kind: "set_model_provider_for_task", taskType: "chat", providerId })}
            >
              Chat: {MODEL_PROVIDER_LABELS[providerId]}
            </button>
          ))}
        </div>
        <div className="workflow-actions">
          {(["local_ollama", "lm_studio", "nvidia_nim", "gemini", "groq", "openrouter"] as ModelProviderId[]).map(
            (providerId) => (
              <button
                className="secondary-button"
                type="button"
                key={`coding-${providerId}`}
                onClick={() =>
                  void executeIntent({ kind: "set_model_provider_for_task", taskType: "coding", providerId })
                }
              >
                Coding: {MODEL_PROVIDER_LABELS[providerId]}
              </button>
            ),
          )}
        </div>
        <div className="workflow-actions">
          {(["local_ollama", "lm_studio", "nvidia_nim", "gemini", "groq", "openrouter"] as ModelProviderId[]).map(
            (providerId) => (
              <button
                className="secondary-button"
                type="button"
                key={`reasoning-${providerId}`}
                onClick={() =>
                  void executeIntent({ kind: "set_model_provider_for_task", taskType: "reasoning", providerId })
                }
              >
                Reasoning: {MODEL_PROVIDER_LABELS[providerId]}
              </button>
            ),
          )}
        </div>
        <div className="workflow-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => void handleTestModelProvider("local_ollama")}
            disabled={isTestingModelRouter}
          >
            Test local router
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void handleTestModelProvider("nvidia_nim")}
            disabled={isTestingModelRouter}
          >
            Test NVIDIA router
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void handleTestModelProvider("gemini")}
            disabled={isTestingModelRouter}
          >
            Test Gemini router
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void handleTestModelProvider("groq")}
            disabled={isTestingModelRouter}
          >
            Test Groq router
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void handleTestModelProvider("openrouter")}
            disabled={isTestingModelRouter}
          >
            Test OpenRouter router
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void executeIntent({ kind: "run_model_benchmark" })}
            disabled={isBenchmarkingModels}
          >
            {isBenchmarkingModels ? "Benchmarking..." : "Run benchmark"}
          </button>
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "recommend_model_routes" })}>
            Recommend routes
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              void executeIntent({
                kind: "set_private_model_mode",
                localOnly: !modelRouterConfig.allowCloudForPrivateMemory,
              })
            }
          >
            {modelRouterConfig.allowCloudForPrivateMemory ? "Disable private cloud" : "Local-only private mode"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setModelRouterConfig(createDefaultModelRouterConfig())}
          >
            Reset router defaults
          </button>
        </div>
        <div className="voice-correction-box">
          <input
            value={modelComparisonPrompt}
            onChange={(event) => setModelComparisonPrompt(event.target.value)}
            placeholder="Compare models for a prompt..."
          />
          <button
            className="secondary-button"
            type="button"
            onClick={() => void executeIntent({ kind: "compare_model_responses", prompt: modelComparisonPrompt })}
            disabled={isComparingModels}
          >
            {isComparingModels ? "Comparing..." : "Compare models"}
          </button>
        </div>
        {modelComparisonRun ? (
          <div className="memory-list">
            {modelComparisonRun.results.map((result) => (
              <div className="memory-card" key={result.id}>
                <h4>{MODEL_PROVIDER_LABELS[result.providerId]}</h4>
                <span className="memory-meta">
                  {result.model} | {result.ok ? `${result.latencyMs}ms` : "failed"}
                </span>
                <p>{result.ok ? result.text : result.errorMessage}</p>
                {result.ok ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      void executeIntent({
                        kind: "choose_model_comparison_winner",
                        providerId: result.providerId,
                        taskType: modelComparisonRun.taskType,
                      })
                    }
                  >
                    Choose as winner
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {modelBenchmarkResults.length > 0 ? (
          <div className="memory-list">
            {modelBenchmarkResults.map((result) => (
              <div className="memory-card" key={result.id}>
                <h4>{MODEL_PROVIDER_LABELS[result.providerId]} benchmark</h4>
                <span className="memory-meta">
                  {result.model} | {result.ok ? "reachable" : "failed"}
                  {result.latencyMs ? ` | ${result.latencyMs}ms` : ""}
                </span>
                <p>{result.message}</p>
              </div>
            ))}
          </div>
        ) : null}
        {modelProviderUsage.length > 0 ? (
          <div className="memory-list">
            {modelProviderUsage.slice(0, 6).map((usage) => (
              <div className="memory-card" key={usage.id}>
                <h4>{MODEL_PROVIDER_LABELS[usage.providerId]} usage</h4>
                <span className="memory-meta">
                  {usage.model} | {usage.taskType} | {usage.ok ? "ok" : "failed"}
                  {usage.latencyMs ? ` | ${usage.latencyMs}ms` : ""}
                  {usage.totalTokens ? ` | ${usage.totalTokens} tokens` : ""}
                </span>
                {usage.errorMessage ? <p>{usage.errorMessage}</p> : <p>{usage.prompt.slice(0, 160)}</p>}
              </div>
            ))}
          </div>
        ) : null}
        <span className="memory-meta">{modelRouterStatusMessage}</span>
      </div>
      <div className="local-config-card">
        <span className="memory-meta">
          Embeddings:{" "}
          {embeddingBackend === "ollama"
            ? `Ollama (${embeddingModelName || "nomic-embed-text"})`
            : embeddingBackend === "transformers"
              ? `Transformers.js (${embeddingModelName || "Xenova/all-MiniLM-L6-v2"})`
              : "local fallback"}
        </span>
        <div className="workflow-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setEmbeddingBackend("local")}
            disabled={embeddingBackend === "local"}
          >
            Use local embeddings
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setEmbeddingBackend("ollama");
              if (!embeddingModelName || embeddingModelName.startsWith("Xenova/")) {
                setEmbeddingModelName("nomic-embed-text");
              }
            }}
            disabled={embeddingBackend === "ollama"}
          >
            Use Ollama embeddings
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setEmbeddingBackend("transformers");
              if (!embeddingModelName || embeddingModelName === "nomic-embed-text") {
                setEmbeddingModelName("Xenova/all-MiniLM-L6-v2");
              }
            }}
            disabled={embeddingBackend === "transformers"}
          >
            Use Transformers.js
          </button>
        </div>
        <input
          value={embeddingModelName}
          onChange={(event) => setEmbeddingModelName(event.target.value)}
          placeholder={
            embeddingBackend === "ollama"
              ? "Embedding model, e.g. nomic-embed-text"
              : "Embedding model, e.g. Xenova/all-MiniLM-L6-v2"
          }
        />
        <span className="memory-meta">{embeddingStatusMessage}</span>
      </div>
    </AdvancedConfigPanel>
  );
}

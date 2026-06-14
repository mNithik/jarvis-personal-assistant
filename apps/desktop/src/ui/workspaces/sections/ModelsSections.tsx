import { ReactNode } from "react";
import { MODEL_PROVIDER_LABELS, type ModelProviderId } from "../../../features/legacy/appHelpers";
import type { ModelsSectionProps } from "./sectionTypes";

export function buildModelsWorkspaceSections({
  dispatchUi,
  executeIntent,
  isBenchmarkingModels,
  isComparingModels,
  latestGeneratedDraft,
  modelBenchmarkResults,
  modelComparisonPrompt,
  modelComparisonRun,
  modelRouterConfig,
  modelRouterStatusMessage,
  setModelComparisonPrompt,
  streamingModelText,
}: ModelsSectionProps): ReactNode[] {
  return [
    <section className="grid-layout single-column" key="models-main">
      <div className="result-card">
        <p className="section-kicker">Router State</p>
        <h3>
          Chat: {MODEL_PROVIDER_LABELS[modelRouterConfig.defaultProvider]} | Coding:{" "}
          {MODEL_PROVIDER_LABELS[modelRouterConfig.codingProvider]} | Reasoning:{" "}
          {MODEL_PROVIDER_LABELS[modelRouterConfig.reasoningProvider]}
        </h3>
        <p className="result-meta">
          Private prompts: {modelRouterConfig.allowCloudForPrivateMemory ? "cloud allowed with confirmation" : "local-only"} | Paid providers:{" "}
          {modelRouterConfig.enablePaidProviders ? "enabled" : "blocked"}
        </p>
        <p>{modelRouterStatusMessage}</p>
        <div className="workflow-actions">
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "run_model_benchmark" })} disabled={isBenchmarkingModels}>
            {isBenchmarkingModels ? "Benchmarking..." : "Run benchmark"}
          </button>
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "recommend_model_routes" })}>
            Recommend routes
          </button>
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "set_private_model_mode", localOnly: !modelRouterConfig.allowCloudForPrivateMemory })}>
            {modelRouterConfig.allowCloudForPrivateMemory ? "Disable private cloud" : "Local-only private mode"}
          </button>
          <button className="secondary-button" type="button" onClick={() => dispatchUi({ type: "setSystemDrawerOpen", open: true })}>
            Advanced model settings
          </button>
        </div>
      </div>
      <div className="result-card">
        <p className="section-kicker">Preferred Providers</p>
        <h3>One-click routing</h3>
        <div className="workflow-actions">
          {(["local_ollama", "lm_studio", "nvidia_nim", "gemini", "groq", "openrouter"] as ModelProviderId[]).map((providerId) => (
            <button className="secondary-button" type="button" key={`models-chat-${providerId}`} onClick={() => void executeIntent({ kind: "set_model_provider_for_task", taskType: "chat", providerId })}>
              Chat: {MODEL_PROVIDER_LABELS[providerId]}
            </button>
          ))}
        </div>
        <div className="workflow-actions">
          {(["local_ollama", "lm_studio", "nvidia_nim", "gemini", "groq", "openrouter"] as ModelProviderId[]).map((providerId) => (
            <button className="secondary-button" type="button" key={`models-coding-${providerId}`} onClick={() => void executeIntent({ kind: "set_model_provider_for_task", taskType: "coding", providerId })}>
              Coding: {MODEL_PROVIDER_LABELS[providerId]}
            </button>
          ))}
        </div>
        <div className="workflow-actions">
          {(["local_ollama", "lm_studio", "nvidia_nim", "gemini", "groq", "openrouter"] as ModelProviderId[]).map((providerId) => (
            <button className="secondary-button" type="button" key={`models-reasoning-${providerId}`} onClick={() => void executeIntent({ kind: "set_model_provider_for_task", taskType: "reasoning", providerId })}>
              Reasoning: {MODEL_PROVIDER_LABELS[providerId]}
            </button>
          ))}
        </div>
      </div>
      <div className="result-card">
        <p className="section-kicker">Compare</p>
        <h3>Ask multiple models before choosing</h3>
        <div className="voice-correction-box">
          <input
            value={modelComparisonPrompt}
            onChange={(event) => setModelComparisonPrompt(event.target.value)}
            placeholder="Compare models for a prompt..."
          />
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "compare_model_responses", prompt: modelComparisonPrompt })} disabled={isComparingModels}>
            {isComparingModels ? "Comparing..." : "Compare models"}
          </button>
        </div>
        {modelComparisonRun ? (
          <div className="memory-list">
            {modelComparisonRun.results.map((result) => (
              <div className="memory-card" key={result.id}>
                <h4>{MODEL_PROVIDER_LABELS[result.providerId]}</h4>
                <span className="memory-meta">{result.model} | {result.ok ? `${result.latencyMs}ms` : "failed"}</span>
                <p>{result.ok ? result.text : result.errorMessage}</p>
                {result.ok ? (
                  <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "choose_model_comparison_winner", providerId: result.providerId, taskType: modelComparisonRun.taskType })}>
                    Choose as winner
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="result-card">
        <p className="section-kicker">Safe Draft Stream</p>
        <h3>{latestGeneratedDraft ? latestGeneratedDraft.prompt : "No draft generated yet"}</h3>
        {streamingModelText ? <p>{streamingModelText}</p> : <p className="empty-state">Generate a draft to see it reveal here. Drafts are never saved, sent, or run automatically.</p>}
        {latestGeneratedDraft ? (
          <div className="workflow-actions">
            <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "copy_latest_model_draft" })}>
              Copy draft
            </button>
            <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "save_latest_model_draft_to_notion" })}>
              Save to Notion
            </button>
          </div>
        ) : null}
      </div>
      {modelBenchmarkResults.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">Benchmark</p>
          <h3>Latest provider health</h3>
          <div className="memory-grid">
            {modelBenchmarkResults.map((result) => (
              <div className="memory-card" key={result.id}>
                <h4>{MODEL_PROVIDER_LABELS[result.providerId]}</h4>
                <p>{result.model}</p>
                <span className="memory-meta">{result.ok ? `${result.latencyMs}ms` : result.message}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>,
  ];
}


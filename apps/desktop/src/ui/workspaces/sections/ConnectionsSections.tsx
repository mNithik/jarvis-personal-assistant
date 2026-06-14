import { ReactNode } from "react";
import { MODEL_PROVIDER_LABELS } from "../../../features/legacy/appHelpers";
import type { ConnectionsSectionProps } from "./sectionTypes";

export function buildConnectionsWorkspaceSections({
  backendComparePrompt,
  backendComparison,
  conversationBackend,
  setBackendComparePrompt,
  setConversationBackend,
  dispatchUi,
  executeIntent,
  gmailAccessToken,
  googleCalendarAccessToken,
  handleCompareConversationBackends,
  handleTestModelProvider,
  isBenchmarkingModels,
  isComparingBackends,
  isTestingModelRouter,
  latestGeneratedDraft,
  modelBenchmarkResults,
  modelComparisonRun,
  modelProviderUsage,
  modelRouterConfig,
  modelRouterStatusMessage,
  modelRouterTestResult,
  notionStatus,
  ollamaStatus,
  runCommand,
  shouldAutoRouteVoice,
  spotifyAccessToken,
}: ConnectionsSectionProps): ReactNode[] {
  return [
    <section className="grid-layout single-column" key="connections-main">
      <div className="result-card">
        <p className="section-kicker">Conversation Brain</p>
        <h3>
          {conversationBackend === "ollama"
            ? "Ollama active"
            : conversationBackend === "auto"
            ? "Auto active"
            : "Heuristics active"}
        </h3>
        <p>
          {conversationBackend === "ollama"
            ? "Natural-language interpretation is currently using Ollama first."
            : conversationBackend === "auto"
            ? "JARVIS is using heuristics first for exact commands and Ollama for fuzzier requests."
            : "Natural-language interpretation is currently using the built-in heuristics parser first."}
        </p>
        <p className="result-meta">
          Ollama configured: {ollamaStatus?.configured ? "yes" : "no"} | Auto-route voice: {shouldAutoRouteVoice ? "on" : "off"}
        </p>
        <p className="result-meta">
          Auto routing: exact actions like open, search, play, read, or switch stay on heuristics first; fuzzy requests, planning, or missing-skill help try Ollama first and fall back if needed.
        </p>
        <div className="workflow-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setConversationBackend("heuristics")}
            disabled={conversationBackend === "heuristics"}
          >
            Use heuristics
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setConversationBackend("auto")}
            disabled={conversationBackend === "auto"}
          >
            Use auto
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setConversationBackend("ollama")}
            disabled={conversationBackend === "ollama"}
          >
            Use Ollama
          </button>
        </div>
      </div>
      <div className="result-card">
        <p className="section-kicker">Connection Health</p>
        <h3>External systems</h3>
        <p className="result-meta">Google Calendar: {googleCalendarAccessToken ? "connected" : "not connected"}</p>
        <p className="result-meta">Gmail: {gmailAccessToken ? "connected" : "not connected"}</p>
        <p className="result-meta">Notion: {notionStatus?.hasToken ? "configured" : "not configured"}</p>
        <p className="result-meta">Spotify: {spotifyAccessToken ? "connected" : "not connected"}</p>
        <p className="result-meta">Ollama: {ollamaStatus?.configured ? "configured" : "not configured"}</p>
        <div className="workflow-actions">
          <button className="secondary-button" type="button" onClick={() => dispatchUi({ type: "setSystemDrawerOpen", open: true })}>
            Open system drawer
          </button>
        </div>
      </div>
      <div className="result-card">
        <p className="section-kicker">Zero-Cost Model Router</p>
        <h3>
          Default: {MODEL_PROVIDER_LABELS[modelRouterConfig.defaultProvider]} | Coding:{" "}
          {MODEL_PROVIDER_LABELS[modelRouterConfig.codingProvider]}
        </h3>
        <p className="result-meta">
          Paid providers: {modelRouterConfig.enablePaidProviders ? "enabled" : "blocked"} | Monthly spend cap: $
          {modelRouterConfig.maxMonthlyApiSpend} | Private memory cloud:{" "}
          {modelRouterConfig.allowCloudForPrivateMemory ? "allowed" : "local-only"}
        </p>
        <p className="result-meta">{modelRouterStatusMessage}</p>
        <p className="result-meta">
          Experimental local reasoning GGUF: {modelRouterConfig.experimentalLocalReasoningModel}
        </p>
        <div className="workflow-actions">
          <button className="secondary-button" type="button" onClick={() => void handleTestModelProvider("local_ollama")} disabled={isTestingModelRouter}>
            Test local
          </button>
          <button className="secondary-button" type="button" onClick={() => void handleTestModelProvider("nvidia_nim")} disabled={isTestingModelRouter}>
            Test NVIDIA
          </button>
          <button className="secondary-button" type="button" onClick={() => void runCommand("what model would you use for debug this repo")} disabled={isTestingModelRouter}>
            Explain route
          </button>
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "run_model_benchmark" })} disabled={isBenchmarkingModels}>
            {isBenchmarkingModels ? "Benchmarking..." : "Benchmark"}
          </button>
          <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "recommend_model_routes" })}>
            Recommend routes
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void executeIntent({ kind: "set_private_model_mode", localOnly: !modelRouterConfig.allowCloudForPrivateMemory })}
          >
            {modelRouterConfig.allowCloudForPrivateMemory ? "Private cloud on" : "Local-only private"}
          </button>
          <button className="secondary-button" type="button" onClick={() => dispatchUi({ type: "setSystemDrawerOpen", open: true })}>
            Configure router
          </button>
        </div>
        {modelRouterTestResult ? (
          <div className="memory-card">
            <h4>{MODEL_PROVIDER_LABELS[modelRouterTestResult.providerId]} test</h4>
            <span className="memory-meta">
              {modelRouterTestResult.ok ? "OK" : "Failed"} | {modelRouterTestResult.model}
              {modelRouterTestResult.latencyMs ? ` | ${modelRouterTestResult.latencyMs}ms` : ""}
            </span>
            <p>{modelRouterTestResult.message}</p>
          </div>
        ) : null}
        {latestGeneratedDraft ? (
          <div className="memory-card">
            <h4>Latest safe draft</h4>
            <span className="memory-meta">
              {MODEL_PROVIDER_LABELS[latestGeneratedDraft.providerId]} | {latestGeneratedDraft.model} | not saved or sent
            </span>
            <p>{latestGeneratedDraft.text.slice(0, 600)}</p>
            <div className="workflow-actions">
              <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "copy_latest_model_draft" })}>
                Copy draft
              </button>
              <button className="secondary-button" type="button" onClick={() => void executeIntent({ kind: "save_latest_model_draft_to_notion" })}>
                Save to Notion
              </button>
            </div>
          </div>
        ) : null}
        {modelProviderUsage.length > 0 ? (
          <div className="memory-card">
            <h4>Recent model usage</h4>
            {modelProviderUsage.slice(0, 5).map((usage) => (
              <p className="result-meta" key={usage.id}>
                {MODEL_PROVIDER_LABELS[usage.providerId]} | {usage.taskType} | {usage.ok ? "ok" : "failed"}
                {usage.latencyMs ? ` | ${usage.latencyMs}ms` : ""}
                {usage.totalTokens ? ` | ${usage.totalTokens} tokens` : ""}
              </p>
            ))}
          </div>
        ) : null}
        {modelBenchmarkResults.length > 0 ? (
          <div className="memory-card">
            <h4>Latest benchmark</h4>
            {modelBenchmarkResults.map((result) => (
              <p className="result-meta" key={result.id}>
                {MODEL_PROVIDER_LABELS[result.providerId]} | {result.model} | {result.ok ? `${result.latencyMs}ms` : result.message}
              </p>
            ))}
          </div>
        ) : null}
        {modelComparisonRun ? (
          <div className="memory-card">
            <h4>Latest model comparison</h4>
            <span className="memory-meta">
              {modelComparisonRun.taskType} | {modelComparisonRun.prompt}
            </span>
            {modelComparisonRun.results.map((result) => (
              <div className="workflow-actions" key={result.id}>
                <span className="result-meta">
                  {MODEL_PROVIDER_LABELS[result.providerId]} | {result.model} | {result.ok ? `${result.latencyMs}ms` : result.errorMessage}
                </span>
                {result.ok ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void executeIntent({ kind: "choose_model_comparison_winner", providerId: result.providerId, taskType: modelComparisonRun.taskType })}
                  >
                    Choose winner
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="result-card">
        <p className="section-kicker">Brain Compare</p>
        <h3>Test one prompt across modes</h3>
        <div className="voice-correction-box">
          <input
            value={backendComparePrompt}
            onChange={(event) => setBackendComparePrompt(event.target.value)}
            placeholder="Try: what should I focus on today"
          />
          <button
            className="secondary-button"
            type="button"
            onClick={() => void handleCompareConversationBackends()}
            disabled={isComparingBackends}
          >
            {isComparingBackends ? "Comparing..." : "Compare"}
          </button>
        </div>
        {backendComparison ? (
          <div className="memory-list">
            <div className="memory-card">
              <h4>Prompt</h4>
              <p>{backendComparison.prompt}</p>
            </div>
            <div className="memory-card">
              <h4>Heuristics</h4>
              <span className="result-route-badge">Heuristics</span>
              <span className="memory-meta">Action type: {backendComparison.heuristicsAction}</span>
              <p>{backendComparison.heuristics}</p>
            </div>
            <div className="memory-card">
              <h4>Ollama</h4>
              <span className="result-route-badge">Ollama</span>
              <span className="memory-meta">Action type: {backendComparison.ollamaAction}</span>
              <p>{backendComparison.ollama}</p>
            </div>
            <div className="memory-card">
              <h4>Auto</h4>
              <span className="result-route-badge">{backendComparison.autoRouteLabel}</span>
              <p>{backendComparison.autoDecision}</p>
              <p className="result-meta">{backendComparison.autoReason}</p>
            </div>
          </div>
        ) : (
          <p className="result-meta">
            Compare how the same request would route before changing your active brain.
          </p>
        )}
      </div>
    </section>,
  ];
}


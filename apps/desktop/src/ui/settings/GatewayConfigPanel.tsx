import { useCallback, useEffect, useState } from "react";

import { MCP_HOST_PRESETS, presetToHostEntry } from "../../features/gateway/mcpPresets";
import {
  GatewayCapabilityRecord,
  GatewayConfig,
  anonymizeTrainingExport,
  applyGatewayEasyPreset,
  getGatewayConfig,
  listGatewayCapabilities,
  listMcpHostRegistry,
  McpHostEntry,
  runTrainingEvalGate,
  saveGatewayConfig,
  testMcpHostConnection,
  type TrainingEvalGateResult,
} from "../../services/jarvisApi";
import ObsidianSetupWizard from "./ObsidianSetupWizard";
import GatewayOnboardingBanner from "./GatewayOnboardingBanner";
import TriggerRecipePanel from "./TriggerRecipePanel";
import SyncPanel from "./SyncPanel";

export default function GatewayConfigPanel() {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [capabilities, setCapabilities] = useState<GatewayCapabilityRecord[]>([]);
  const [mcpHosts, setMcpHosts] = useState<McpHostEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evalGate, setEvalGate] = useState<TrainingEvalGateResult | null>(null);
  const [trainingMessage, setTrainingMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [next, capabilityRows, hostRows] = await Promise.all([
        getGatewayConfig(),
        listGatewayCapabilities(),
        listMcpHostRegistry(),
      ]);
      setConfig({
        ...next,
        proactive: next.proactive ?? {
          heartbeatEnabled: false,
          heartbeatIntervalMinutes: 30,
          morningBriefEnabled: false,
          morningBriefTime: "07:30",
          ocrWatchTickEnabled: false,
          plannerCopilotEnabled: false,
          dayReplanOnCalendarChange: false,
        },
        budgets: next.budgets ?? {
          maxStepsPerTurn: 12,
          maxWallTimeSeconds: 120,
          maxRetriesPerStep: 2,
          maxMcpPayloadBytes: 262144,
        },
        mcpHosts: next.mcpHosts ?? [],
        channels: next.channels ?? {
          localWsEnabled: false,
          localWsPort: 18789,
          telegramEnabled: false,
          discordEnabled: false,
        },
        training: next.training ?? { exportEnabled: false, evalMinAccuracyPct: 95 },
      });
      setCapabilities(capabilityRows);
      setMcpHosts(hostRows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function persist(next: GatewayConfig) {
    setSaving(true);
    setError(null);
    try {
      await saveGatewayConfig(next);
      setConfig(next);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <div className="local-config-card">
        <span className="memory-meta">{error ?? "Loading gateway configuration…"}</span>
      </div>
    );
  }

  return (
    <div className="local-config-card">
      <p className="section-kicker">Agent gateway</p>
      <p className="memory-meta">
        Enable the gateway to route study setup, screen reading, file search, and integrations
        through the Ralph task loop. Notion runs in Rust; Spotify, Gmail, Calendar, and email→Notion
        chains use a hybrid handoff (OAuth tokens stay in the browser). Set JARVIS_NOTION_TOKEN in
        .env for local Notion keys. Defaults stay off for legacy App routing.
      </p>
      {error ? <span className="gateway-preview-reason warning">{error}</span> : null}
      <GatewayOnboardingBanner onApplied={(next) => setConfig(next)} />
      <div className="workflow-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={saving}
          onClick={() =>
            void applyGatewayEasyPreset()
              .then((preset) => setConfig(preset))
              .catch((presetError) =>
                setError(presetError instanceof Error ? presetError.message : String(presetError)),
              )
          }
        >
          Apply easy mode (dry-run + proactive)
        </button>
      </div>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(event) => void persist({ ...config, enabled: event.target.checked })}
          disabled={saving}
        />
        <span>Gateway enabled</span>
      </label>
      <label className="gateway-field">
        <span>Gateway mode</span>
        <select
          value={config.mode ?? "execute"}
          onChange={(event) =>
            void persist({
              ...config,
              mode: event.target.value as GatewayConfig["mode"],
            })
          }
          disabled={saving}
        >
          <option value="execute">Execute</option>
          <option value="dry_run">Dry run</option>
          <option value="plan_only">Plan only</option>
        </select>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.features.studyRoutine}
          onChange={(event) =>
            void persist({
              ...config,
              features: { ...config.features, studyRoutine: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>Study routine (F3)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.features.screenOcr}
          onChange={(event) =>
            void persist({
              ...config,
              features: { ...config.features, screenOcr: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>Screen read / UIA (F7)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.features.notion}
          onChange={(event) =>
            void persist({
              ...config,
              features: { ...config.features, notion: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>Notion notes (F13)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.features.spotify}
          onChange={(event) =>
            void persist({
              ...config,
              features: { ...config.features, spotify: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>Spotify playback (F14)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.features.gmail}
          onChange={(event) =>
            void persist({
              ...config,
              features: { ...config.features, gmail: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>Gmail inbox (F10)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.features.calendar}
          onChange={(event) =>
            void persist({
              ...config,
              features: { ...config.features, calendar: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>Google Calendar (F12)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.features.ocrNotion}
          onChange={(event) =>
            void persist({
              ...config,
              features: { ...config.features, ocrNotion: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>OCR → Notion (F8)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.features.emailNotion}
          onChange={(event) =>
            void persist({
              ...config,
              features: { ...config.features, emailNotion: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>Email → Notion (F11)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.features.memory}
          onChange={(event) =>
            void persist({
              ...config,
              features: { ...config.features, memory: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>Memory spine (F15–F17)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.features.builder}
          onChange={(event) =>
            void persist({
              ...config,
              features: { ...config.features, builder: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>Builder / coding handoffs (F22)</span>
      </label>
      <p className="section-kicker">Turn budgets</p>
      <label className="gateway-field">
        <span>Max steps</span>
        <input
          type="number"
          min={1}
          value={config.budgets.maxStepsPerTurn}
          onChange={(event) =>
            void persist({
              ...config,
              budgets: { ...config.budgets, maxStepsPerTurn: Number(event.target.value) || 1 },
            })
          }
          disabled={saving}
        />
      </label>
      <label className="gateway-field">
        <span>Wall time seconds</span>
        <input
          type="number"
          min={1}
          value={config.budgets.maxWallTimeSeconds}
          onChange={(event) =>
            void persist({
              ...config,
              budgets: { ...config.budgets, maxWallTimeSeconds: Number(event.target.value) || 1 },
            })
          }
          disabled={saving}
        />
      </label>
      <label className="gateway-field">
        <span>Retries per step</span>
        <input
          type="number"
          min={0}
          value={config.budgets.maxRetriesPerStep}
          onChange={(event) =>
            void persist({
              ...config,
              budgets: { ...config.budgets, maxRetriesPerStep: Number(event.target.value) || 0 },
            })
          }
          disabled={saving}
        />
      </label>
      <label className="gateway-field">
        <span>MCP payload bytes</span>
        <input
          type="number"
          min={1024}
          step={1024}
          value={config.budgets.maxMcpPayloadBytes}
          onChange={(event) =>
            void persist({
              ...config,
              budgets: { ...config.budgets, maxMcpPayloadBytes: Number(event.target.value) || 1024 },
            })
          }
          disabled={saving}
        />
      </label>
      <p className="section-kicker">Proactive jobs</p>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.proactive.heartbeatEnabled}
          onChange={(event) =>
            void persist({
              ...config,
              proactive: { ...config.proactive, heartbeatEnabled: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>Heartbeat ({config.proactive.heartbeatIntervalMinutes}m)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.proactive.morningBriefEnabled}
          onChange={(event) =>
            void persist({
              ...config,
              proactive: { ...config.proactive, morningBriefEnabled: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>Morning brief at {config.proactive.morningBriefTime}</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.proactive.plannerCopilotEnabled ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              proactive: { ...config.proactive, plannerCopilotEnabled: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>Planner copilot (morning plan + replan via Notion tasks)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.proactive.dayReplanOnCalendarChange ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              proactive: {
                ...config.proactive,
                dayReplanOnCalendarChange: event.target.checked,
              },
            })
          }
          disabled={saving}
        />
        <span>Replan when calendar changes (experimental)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.proactive.ocrWatchTickEnabled}
          onChange={(event) =>
            void persist({
              ...config,
              proactive: { ...config.proactive, ocrWatchTickEnabled: event.target.checked },
            })
          }
          disabled={saving}
        />
        <span>OCR watch tick (Rust scheduler)</span>
      </label>
      <TriggerRecipePanel />
      <p className="section-kicker">Labs</p>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.labs?.projectBundlePilot ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              labs: {
                projectBundlePilot: event.target.checked,
                councilVerifier: config.labs?.councilVerifier ?? false,
                councilRuntime: config.labs?.councilRuntime ?? false,
                proactiveAnomaly: config.labs?.proactiveAnomaly ?? false,
                worldModelQueries: config.labs?.worldModelQueries ?? false,
              },
            })
          }
          disabled={saving}
        />
        <span>Project bundle pilot (meeting follow-up lab)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.labs?.councilVerifier ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              labs: {
                projectBundlePilot: config.labs?.projectBundlePilot ?? false,
                councilVerifier: event.target.checked,
                councilRuntime: config.labs?.councilRuntime ?? false,
                proactiveAnomaly: config.labs?.proactiveAnomaly ?? false,
                worldModelQueries: config.labs?.worldModelQueries ?? false,
              },
            })
          }
          disabled={saving}
        />
        <span>Council verifier on send (lab)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.labs?.councilRuntime ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              labs: {
                projectBundlePilot: config.labs?.projectBundlePilot ?? false,
                councilVerifier: config.labs?.councilVerifier ?? false,
                councilRuntime: event.target.checked,
                proactiveAnomaly: config.labs?.proactiveAnomaly ?? false,
                worldModelQueries: config.labs?.worldModelQueries ?? false,
              },
            })
          }
          disabled={saving}
        />
        <span>Council runtime (multi-agent lab)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.labs?.proactiveAnomaly ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              labs: {
                projectBundlePilot: config.labs?.projectBundlePilot ?? false,
                councilVerifier: config.labs?.councilVerifier ?? false,
                councilRuntime: config.labs?.councilRuntime ?? false,
                proactiveAnomaly: event.target.checked,
                worldModelQueries: config.labs?.worldModelQueries ?? false,
              },
            })
          }
          disabled={saving}
        />
        <span>Proactive anomaly detection (lab)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.labs?.worldModelQueries ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              labs: {
                projectBundlePilot: config.labs?.projectBundlePilot ?? false,
                councilVerifier: config.labs?.councilVerifier ?? false,
                councilRuntime: config.labs?.councilRuntime ?? false,
                proactiveAnomaly: config.labs?.proactiveAnomaly ?? false,
                worldModelQueries: event.target.checked,
              },
            })
          }
          disabled={saving}
        />
        <span>World model queries (lab L5)</span>
      </label>
      <SyncPanel />
      <p className="section-kicker">Channels</p>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.channels?.localWsEnabled ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              channels: {
                localWsEnabled: event.target.checked,
                localWsPort: config.channels?.localWsPort ?? 18789,
                localWsToken: config.channels?.localWsToken,
                telegramEnabled: config.channels?.telegramEnabled ?? false,
                telegramBotToken: config.channels?.telegramBotToken,
                discordEnabled: config.channels?.discordEnabled ?? false,
                discordBotToken: config.channels?.discordBotToken,
              },
            })
          }
          disabled={saving}
        />
        <span>Local turn API (POST /turn on 127.0.0.1)</span>
      </label>
      <label className="gateway-field">
        <span>Local API port</span>
        <input
          type="number"
          min={1024}
          max={65535}
          value={config.channels?.localWsPort ?? 18789}
          onChange={(event) =>
            void persist({
              ...config,
              channels: {
                localWsEnabled: config.channels?.localWsEnabled ?? false,
                localWsPort: Number(event.target.value) || 18789,
                localWsToken: config.channels?.localWsToken,
                telegramEnabled: config.channels?.telegramEnabled ?? false,
                telegramBotToken: config.channels?.telegramBotToken,
                discordEnabled: config.channels?.discordEnabled ?? false,
                discordBotToken: config.channels?.discordBotToken,
              },
            })
          }
          disabled={saving}
        />
      </label>
      <label className="gateway-field">
        <span>Local API token (optional Bearer)</span>
        <input
          type="password"
          value={config.channels?.localWsToken ?? ""}
          onChange={(event) =>
            void persist({
              ...config,
              channels: {
                localWsEnabled: config.channels?.localWsEnabled ?? false,
                localWsPort: config.channels?.localWsPort ?? 18789,
                localWsToken: event.target.value || undefined,
                telegramEnabled: config.channels?.telegramEnabled ?? false,
                telegramBotToken: config.channels?.telegramBotToken,
                discordEnabled: config.channels?.discordEnabled ?? false,
                discordBotToken: config.channels?.discordBotToken,
              },
            })
          }
          placeholder="Optional shared secret"
          disabled={saving}
        />
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.channels?.mobileApproveEnabled ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              channels: {
                localWsEnabled: config.channels?.localWsEnabled ?? false,
                localWsPort: config.channels?.localWsPort ?? 18789,
                localWsToken: config.channels?.localWsToken,
                mobileApproveEnabled: event.target.checked,
                telegramEnabled: config.channels?.telegramEnabled ?? false,
                telegramBotToken: config.channels?.telegramBotToken,
                discordEnabled: config.channels?.discordEnabled ?? false,
                discordBotToken: config.channels?.discordBotToken,
              },
            })
          }
          disabled={saving}
        />
        <span>Mobile approve PWA (GET /mobile/brief + approvals)</span>
      </label>
      {config.channels?.mobileApproveEnabled ? (
        <p className="result-meta">
          Open approve UI: /approve/index.html · API http://127.0.0.1:
          {config.channels?.localWsPort ?? 18789}
        </p>
      ) : null}
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.channels?.telegramEnabled ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              channels: {
                localWsEnabled: config.channels?.localWsEnabled ?? false,
                localWsPort: config.channels?.localWsPort ?? 18789,
                localWsToken: config.channels?.localWsToken,
                telegramEnabled: event.target.checked,
                telegramBotToken: config.channels?.telegramBotToken,
                discordEnabled: config.channels?.discordEnabled ?? false,
                discordBotToken: config.channels?.discordBotToken,
              },
            })
          }
          disabled={saving}
        />
        <span>Telegram bot (long-poll)</span>
      </label>
      <label className="gateway-field">
        <span>Telegram bot token</span>
        <input
          type="password"
          value={config.channels?.telegramBotToken ?? ""}
          onChange={(event) =>
            void persist({
              ...config,
              channels: {
                localWsEnabled: config.channels?.localWsEnabled ?? false,
                localWsPort: config.channels?.localWsPort ?? 18789,
                localWsToken: config.channels?.localWsToken,
                telegramEnabled: config.channels?.telegramEnabled ?? false,
                telegramBotToken: event.target.value || undefined,
                discordEnabled: config.channels?.discordEnabled ?? false,
                discordBotToken: config.channels?.discordBotToken,
              },
            })
          }
          placeholder="From @BotFather"
          disabled={saving}
        />
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.channels?.discordEnabled ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              channels: {
                localWsEnabled: config.channels?.localWsEnabled ?? false,
                localWsPort: config.channels?.localWsPort ?? 18789,
                localWsToken: config.channels?.localWsToken,
                telegramEnabled: config.channels?.telegramEnabled ?? false,
                telegramBotToken: config.channels?.telegramBotToken,
                discordEnabled: event.target.checked,
                discordBotToken: config.channels?.discordBotToken,
              },
            })
          }
          disabled={saving}
        />
        <span>Discord bot (Phase 2 token prep)</span>
      </label>
      <label className="gateway-field">
        <span>Discord bot token</span>
        <input
          type="password"
          value={config.channels?.discordBotToken ?? ""}
          onChange={(event) =>
            void persist({
              ...config,
              channels: {
                localWsEnabled: config.channels?.localWsEnabled ?? false,
                localWsPort: config.channels?.localWsPort ?? 18789,
                localWsToken: config.channels?.localWsToken,
                telegramEnabled: config.channels?.telegramEnabled ?? false,
                telegramBotToken: config.channels?.telegramBotToken,
                discordEnabled: config.channels?.discordEnabled ?? false,
                discordBotToken: event.target.value || undefined,
              },
            })
          }
          placeholder="Discord application token"
          disabled={saving}
        />
      </label>
      <p className="section-kicker">Training export</p>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.routing?.jarvisRouterEnabled ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              routing: {
                l2Enabled: config.routing?.l2Enabled ?? false,
                preferLocalForPersonal: config.routing?.preferLocalForPersonal ?? true,
                jarvisRouterEnabled: event.target.checked,
              },
            })
          }
          disabled={saving}
        />
        <span>Prefer jarvis-router Ollama model for L2 (run create-jarvis-router.ps1 first)</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={config.training?.exportEnabled ?? false}
          onChange={(event) =>
            void persist({
              ...config,
              training: {
                exportEnabled: event.target.checked,
                evalMinAccuracyPct: config.training?.evalMinAccuracyPct ?? 95,
              },
            })
          }
          disabled={saving}
        />
        <span>Opt-in JSONL export on gateway turns</span>
      </label>
      <label className="gateway-field">
        <span>Eval gate minimum accuracy (%)</span>
        <input
          type="number"
          min={50}
          max={100}
          value={config.training?.evalMinAccuracyPct ?? 95}
          onChange={(event) =>
            void persist({
              ...config,
              training: {
                exportEnabled: config.training?.exportEnabled ?? false,
                evalMinAccuracyPct: Number(event.target.value) || 95,
              },
            })
          }
          disabled={saving}
        />
      </label>
      <div className="workflow-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={saving}
          onClick={() => {
            void (async () => {
              try {
                const result = await runTrainingEvalGate();
                setEvalGate(result);
                setTrainingMessage(
                  result.passed
                    ? `Eval gate passed: ${result.accuracyPct.toFixed(1)}% (${result.correctCases}/${result.totalCases})`
                    : `Eval gate failed: ${result.accuracyPct.toFixed(1)}% vs baseline ${result.baselinePct.toFixed(1)}%`,
                );
              } catch (gateError) {
                setTrainingMessage(
                  gateError instanceof Error ? gateError.message : String(gateError),
                );
              }
            })();
          }}
        >
          Run eval gate
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={saving}
          onClick={() => {
            void (async () => {
              try {
                const message = await anonymizeTrainingExport();
                setTrainingMessage(message);
              } catch (anonymizeError) {
                setTrainingMessage(
                  anonymizeError instanceof Error ? anonymizeError.message : String(anonymizeError),
                );
              }
            })();
          }}
        >
          Anonymize export
        </button>
      </div>
      {trainingMessage ? <p className="memory-meta">{trainingMessage}</p> : null}
      {evalGate ? (
        <p className="memory-meta">
          Scanned {evalGate.evalFilesScanned} eval files · export records {evalGate.exportRecordCount}
        </p>
      ) : null}
      <p className="section-kicker">Capability registry</p>
      <div className="memory-list">
        {capabilities.map((capability) => (
          <p className="memory-meta" key={capability.id}>
            {capability.id} · {capability.label} · {capability.agent}
          </p>
        ))}
      </div>
      <p className="section-kicker">Knowledge connectors</p>
      <label className="gateway-field">
        <span>Local vault path</span>
        <input
          type="text"
          value={config.knowledge?.localVaultPath ?? ""}
          onChange={(event) =>
            void persist({
              ...config,
              knowledge: {
                ...config.knowledge,
                localVaultPath: event.target.value,
                obsidianHostId: config.knowledge?.obsidianHostId,
              },
            })
          }
          placeholder="C:\Users\you\Documents\vault"
          disabled={saving}
        />
      </label>
      <label className="gateway-field">
        <span>Obsidian MCP host id</span>
        <input
          type="text"
          value={config.knowledge?.obsidianHostId ?? ""}
          onChange={(event) =>
            void persist({
              ...config,
              knowledge: {
                ...config.knowledge,
                localVaultPath: config.knowledge?.localVaultPath,
                obsidianHostId: event.target.value,
              },
            })
          }
          placeholder="obsidian-local"
          disabled={saving}
        />
      </label>
      <label className="gateway-field">
        <span>Readwise CSV path</span>
        <input
          type="text"
          value={config.knowledge?.readwiseCsvPath ?? ""}
          onChange={(event) =>
            void persist({
              ...config,
              knowledge: {
                ...config.knowledge,
                readwiseCsvPath: event.target.value || undefined,
              },
            })
          }
          placeholder="C:\exports\readwise.csv"
          disabled={saving}
        />
      </label>
      <label className="gateway-field">
        <span>Zotero bib path</span>
        <input
          type="text"
          value={config.knowledge?.zoteroBibPath ?? ""}
          onChange={(event) =>
            void persist({
              ...config,
              knowledge: {
                ...config.knowledge,
                zoteroBibPath: event.target.value || undefined,
              },
            })
          }
          placeholder="C:\Zotero\library.bib"
          disabled={saving}
        />
      </label>
      <p className="section-kicker">MCP hosts</p>
      <ObsidianSetupWizard config={config} saving={saving} onPersist={(next) => void persist(next)} />
      <div className="memory-list">
        {MCP_HOST_PRESETS.map((preset) => (
          <div className="memory-card" key={preset.id}>
            <h4>{preset.label}</h4>
            <p className="memory-meta">{preset.description}</p>
            <span className="memory-meta">{preset.capabilityFamily}</span>
            <div className="workflow-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={() => {
                  const entry = presetToHostEntry(preset);
                  const hosts = (config.mcpHosts ?? []).filter((host) => host.id !== entry.id);
                  void persist({ ...config, mcpHosts: [...hosts, entry] });
                }}
              >
                Add preset
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={() => {
                  void testMcpHostConnection(preset.id)
                    .then((reply) => setError(null))
                    .catch((probeError) =>
                      setError(probeError instanceof Error ? probeError.message : String(probeError)),
                    );
                }}
              >
                Test connection
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="memory-list">
        {mcpHosts.map((host) => (
          <p className="memory-meta" key={host.id}>
            {host.label} · {host.transport}
            {host.command ? ` · ${host.command}` : ""}
          </p>
        ))}
      </div>
      <label className="gateway-field">
        <span>External host id</span>
        <input
          type="text"
          id="mcp-host-id"
          placeholder="obsidian-local"
          disabled={saving}
        />
      </label>
      <label className="gateway-field">
        <span>External host label</span>
        <input
          type="text"
          id="mcp-host-label"
          placeholder="Obsidian MCP"
          disabled={saving}
        />
      </label>
      <label className="gateway-field">
        <span>Launch command</span>
        <input
          type="text"
          id="mcp-host-command"
          placeholder="npx -y obsidian-mcp-server"
          disabled={saving}
        />
      </label>
      <div className="workflow-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={saving}
          onClick={() => {
            const id = (document.getElementById("mcp-host-id") as HTMLInputElement | null)?.value.trim();
            const label = (document.getElementById("mcp-host-label") as HTMLInputElement | null)?.value.trim();
            const command = (document.getElementById("mcp-host-command") as HTMLInputElement | null)?.value.trim();
            if (!id || !label || !command) {
              setError("MCP host id, label, and command are required.");
              return;
            }
            const entry: McpHostEntry = {
              id,
              label,
              transport: "stdio",
              command,
              readOnly: false,
              external: true,
            };
            void persist({
              ...config,
              mcpHosts: [...(config.mcpHosts ?? []), entry],
            });
          }}
        >
          Add MCP host
        </button>
      </div>
      <div className="workflow-actions">
        <button className="secondary-button" type="button" onClick={() => void refresh()} disabled={saving}>
          Reload gateway config
        </button>
      </div>
    </div>
  );
}

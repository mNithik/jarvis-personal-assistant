import AdvancedConfigPanel from "../AdvancedConfigPanel";
import { useCallback, useEffect, useState } from "react";
import {
  DESKTOP_SCHEDULES_STORAGE_KEY,
  OCR_WATCHES_STORAGE_KEY,
  SAVED_WORKFLOWS_STORAGE_KEY,
} from "../../../features/command/parsers/explicitIntent";
import type {
  DesktopScheduleRecord,
  OcrWatchTarget,
  SavedWorkflowRecord,
} from "../../../features/command/jarvisCommandTypes";
import { useJarvisObsidianKnowledge } from "../../../hooks/useJarvisObsidianKnowledge";
import {
  importAutomationFromLocalStorage,
  prepareDatabaseMigrations,
  getDiscordBotStatus,
  type DiscordBotStatus,
} from "../../../services/jarvisApi";
import { useJarvisSystemDrawer } from "./JarvisSystemDrawerContext";

function DiscordStatusLine() {
  const [status, setStatus] = useState<DiscordBotStatus | null>(null);

  useEffect(() => {
    void getDiscordBotStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  return (
    <>
      <p className="result-meta">
        Discord bot: {status?.running ? "running" : "stopped"}
      </p>
      {status?.lastError ? <p className="result-meta">{status.lastError}</p> : null}
      {status?.lastChannelId ? (
        <p className="result-meta">Last channel: {status.lastChannelId}</p>
      ) : null}
      <button
        className="secondary-button"
        type="button"
        onClick={() => void getDiscordBotStatus().then(setStatus)}
      >
        Refresh Discord status
      </button>
    </>
  );
}

export default function DrawerIntegrationsPanel() {
  const {
    executorCommandPath,
    executorWorkingDirectory,
    gmailAccessToken,
    googleCalendarAccessToken,
    googleCalendarApiKey,
    googleCalendarClientId,
    handleConnectGmail,
    handleConnectGoogleCalendar,
    handleConnectSpotify,
    handleSaveExecutorConfig,
    handleSaveGoogleCalendarConfig,
    handleSaveNotionConfig,
    handleSaveSpotifyConfig,
    notionDatabaseId,
    notionStatus,
    notionTokenInput,
    setExecutorCommandPath,
    setExecutorWorkingDirectory,
    setGoogleCalendarApiKey,
    setGoogleCalendarClientId,
    setNotionDatabaseId,
    setNotionTokenInput,
    setSpotifyClientId,
    spotifyAccessToken,
    spotifyClientId,
  } = useJarvisSystemDrawer();
  const {
    gatewayEnabled,
    loading: knowledgeLoading,
    obsidianHostId,
    refresh: refreshKnowledge,
    vaultConfigured,
  } = useJarvisObsidianKnowledge();
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const handleImportAutomation = useCallback(async () => {
    setImportBusy(true);
    setImportStatus(null);
    try {
      await prepareDatabaseMigrations();
      const readJson = <T,>(key: string): T[] => {
        try {
          const raw = window.localStorage.getItem(key);
          if (!raw) return [];
          const parsed = JSON.parse(raw) as T[];
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };
      const ocrWatches = readJson<OcrWatchTarget>(OCR_WATCHES_STORAGE_KEY).map((watch) => ({
        id: watch.id,
        name: watch.name,
        scope: watch.scope,
        appName: watch.appName,
        region: watch.region,
        rect: watch.rect,
        status: watch.status,
        intervalMs: watch.intervalMs,
        logToNotion: watch.logToNotion,
        createTaskOnMatch: watch.createTaskOnMatch,
        action: watch.action,
        rule: watch.rule,
        lastText: watch.lastText,
        lastMatchKey: watch.lastMatchKey,
        lastCheckedAt: watch.lastCheckedAt,
      }));
      const desktopSchedules = readJson<DesktopScheduleRecord>(DESKTOP_SCHEDULES_STORAGE_KEY).map(
        (schedule) => ({
          id: schedule.id,
          projectName: schedule.projectName,
          actionLabel: schedule.actionLabel,
          dueAt: schedule.dueAt,
          createdAt: schedule.createdAt,
        }),
      );
      const savedWorkflows = readJson<SavedWorkflowRecord>(SAVED_WORKFLOWS_STORAGE_KEY).map(
        (workflow) => ({
          id: workflow.id,
          name: workflow.name,
          triggerPhrase: workflow.triggerPhrase,
          steps: workflow.steps,
          createdAt: workflow.createdAt,
          basedOnCount: workflow.basedOnCount,
        }),
      );
      const result = await importAutomationFromLocalStorage({
        ocrWatches,
        desktopSchedules,
        savedWorkflows,
      });
      setImportStatus(
        `Imported ${result.ocrWatchesImported} OCR watches, ${result.desktopSchedulesImported} schedules, and ${result.savedWorkflowsImported} workflows into SQLite.`,
      );
    } catch (error) {
      setImportStatus(
        error instanceof Error ? error.message : "Automation import failed.",
      );
    } finally {
      setImportBusy(false);
    }
  }, []);

  return (
    <AdvancedConfigPanel
      title="Integrations and bridges"
      summary="Google, Spotify, Notion, Obsidian knowledge, and the executor bridge."
    >
      <div className="local-config-card">
        <p className="section-kicker">Channel ingress</p>
        <DiscordStatusLine />
      </div>
      <div className="local-config-card">
        <p className="section-kicker">Always-on automation data</p>
        <p className="result-meta">
          One-time import from browser localStorage into SQLite (OCR watches, desktop schedules, saved workflows).
        </p>
        <button
          className="secondary-button"
          type="button"
          disabled={importBusy}
          onClick={() => void handleImportAutomation()}
        >
          {importBusy ? "Importing…" : "Import automation from browser storage"}
        </button>
        {importStatus ? <p className="result-meta">{importStatus}</p> : null}
      </div>
      <div className="local-config-card">
        <p className="section-kicker">Obsidian knowledge</p>
        <p className="result-meta">
          Gateway: {knowledgeLoading ? "loading…" : gatewayEnabled ? "enabled" : "disabled"}
        </p>
        <p className="result-meta">
          Vault path: {vaultConfigured ? "configured" : "not configured"}
        </p>
        <p className="result-meta">
          Obsidian host: {obsidianHostId ?? "not set"}
        </p>
        <button className="secondary-button" type="button" onClick={() => void refreshKnowledge()}>
          Refresh knowledge status
        </button>
      </div>
      <div className="local-config-card">
        <input
          value={googleCalendarClientId}
          onChange={(event) => setGoogleCalendarClientId(event.target.value)}
          placeholder="Google Calendar client ID"
        />
        <input
          value={googleCalendarApiKey}
          onChange={(event) => setGoogleCalendarApiKey(event.target.value)}
          placeholder="Google Calendar API key"
        />
        <button className="secondary-button" type="button" onClick={() => void handleSaveGoogleCalendarConfig()}>
          Save Google Calendar config
        </button>
        <button className="secondary-button" type="button" onClick={() => void handleConnectGoogleCalendar()}>
          {googleCalendarAccessToken ? "Google Calendar connected" : "Connect Google Calendar"}
        </button>
        <button className="secondary-button" type="button" onClick={() => void handleConnectGmail()}>
          {gmailAccessToken ? "Gmail connected" : "Connect Gmail"}
        </button>
      </div>
      <div className="local-config-card">
        <input
          value={spotifyClientId}
          onChange={(event) => setSpotifyClientId(event.target.value)}
          placeholder="Spotify client ID"
        />
        <button className="secondary-button" type="button" onClick={handleSaveSpotifyConfig}>
          Save Spotify config
        </button>
        <button className="secondary-button" type="button" onClick={() => void handleConnectSpotify()}>
          {spotifyAccessToken ? "Spotify connected" : "Connect Spotify"}
        </button>
      </div>
      <div className="local-config-card">
        <input
          value={notionTokenInput}
          onChange={(event) => setNotionTokenInput(event.target.value)}
          placeholder={
            notionStatus?.hasToken
              ? "Notion token saved locally. Re-enter only if you want to replace it."
              : "Notion integration token"
          }
        />
        <input
          value={notionDatabaseId}
          onChange={(event) => setNotionDatabaseId(event.target.value)}
          placeholder="Notion database ID"
        />
        <button className="secondary-button" type="button" onClick={handleSaveNotionConfig}>
          Save Notion config
        </button>
      </div>
      <div className="local-config-card">
        <input
          value={executorCommandPath}
          onChange={(event) => setExecutorCommandPath(event.target.value)}
          placeholder="Executor command path"
        />
        <input
          value={executorWorkingDirectory}
          onChange={(event) => setExecutorWorkingDirectory(event.target.value)}
          placeholder="Executor working directory"
        />
        <button className="secondary-button" type="button" onClick={handleSaveExecutorConfig}>
          Save executor bridge
        </button>
      </div>
    </AdvancedConfigPanel>
  );
}

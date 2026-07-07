import { useEffect, useState } from "react";

import { ACTIVE_PROFILE_CHANGED_EVENT } from "../../features/gateway/profileEvents";
import {
  connectRemoteSync,
  exportSyncBundle,
  importSyncBundle,
  listPendingSyncConflicts,
  listUserGoals,
  pullRemoteSync,
  pushRemoteSync,
  registerRemoteSync,
  remoteSyncStatus,
  saveUserGoal,
  type RemoteSyncStatus,
  type SyncConflict,
  type UserGoalRecord,
} from "../../services/jarvisApi";

export default function SyncPanel() {
  const [passphrase, setPassphrase] = useState("");
  const [bundlePath, setBundlePath] = useState("");
  const [goals, setGoals] = useState<UserGoalRecord[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [remoteEndpoint, setRemoteEndpoint] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [remoteStatus, setRemoteStatus] = useState<RemoteSyncStatus | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, string>>({});

  async function refreshRemote() {
    try {
      setRemoteStatus(await remoteSyncStatus());
      setConflicts(await listPendingSyncConflicts());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function refreshGoals() {
    try {
      setGoals(await listUserGoals());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleExport() {
    setStatus(null);
    try {
      const path = await exportSyncBundle(passphrase || "jarvis");
      setStatus(`Exported sync bundle to ${path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleImport() {
    setStatus(null);
    try {
      const summary = await importSyncBundle(bundlePath, passphrase || "jarvis");
      setStatus(summary);
      await refreshGoals();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function addGoal() {
    if (!newGoalTitle.trim()) {
      return;
    }
    const now = new Date().toISOString();
    await saveUserGoal({
      id: `goal-${Date.now()}`,
      title: newGoalTitle.trim(),
      description: "",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    setNewGoalTitle("");
    await refreshGoals();
  }

  useEffect(() => {
    void refreshGoals();
    void refreshRemote();
  }, []);

  useEffect(() => {
    function handleProfileChanged() {
      void refreshGoals();
    }
    window.addEventListener(ACTIVE_PROFILE_CHANGED_EVENT, handleProfileChanged);
    return () => {
      window.removeEventListener(ACTIVE_PROFILE_CHANGED_EVENT, handleProfileChanged);
    };
  }, []);

  return (
    <div className="result-card" data-testid="sync-panel">
      <p className="section-kicker">Sync beta</p>
      <h3>Encrypted profiles, memory, and settings export</h3>
      <p className="result-meta">
        Local-first sync bundle for gateway settings, profiles, active-profile restore, goals,
        graph relations, and recall memory slices. Hosted sync (T17-D) adds encrypted push/pull with
        conflict detection.
      </p>
      <p className="section-kicker">Hosted sync</p>
      <label className="gateway-field">
        <span>Remote endpoint (optional HTTP; empty uses local mirror)</span>
        <input
          type="text"
          data-testid="remote-sync-endpoint"
          value={remoteEndpoint}
          onChange={(event) => setRemoteEndpoint(event.target.value)}
          placeholder="https://sync.example.com"
        />
      </label>
      <label className="gateway-field">
        <span>Device token</span>
        <input
          type="password"
          data-testid="remote-sync-token"
          value={deviceToken}
          onChange={(event) => setDeviceToken(event.target.value)}
          placeholder="device-token"
        />
      </label>
      <div className="inline-actions">
        <button
          type="button"
          className="ghost-button"
          data-testid="remote-sync-register"
          onClick={() => {
            void (async () => {
              setStatus(null);
              try {
                const account = await registerRemoteSync(remoteEndpoint, "jarvis-desktop");
                setDeviceToken(account.deviceToken);
                await refreshRemote();
                setStatus(`Registered device ${account.deviceId} with hosted sync.`);
              } catch (error) {
                setStatus(error instanceof Error ? error.message : String(error));
              }
            })();
          }}
        >
          Register device
        </button>
        <button
          type="button"
          className="secondary-button"
          data-testid="remote-sync-connect"
          onClick={() => {
            void (async () => {
              setStatus(null);
              try {
                await connectRemoteSync(remoteEndpoint, deviceToken);
                await refreshRemote();
                setStatus("Connected hosted sync account.");
              } catch (error) {
                setStatus(error instanceof Error ? error.message : String(error));
              }
            })();
          }}
        >
          Connect account
        </button>
        <button
          type="button"
          className="ghost-button"
          data-testid="remote-sync-push"
          onClick={() => {
            void (async () => {
              setStatus(null);
              try {
                const result = await pushRemoteSync(passphrase || "jarvis");
                setStatus(result.summary);
                await refreshRemote();
              } catch (error) {
                setStatus(error instanceof Error ? error.message : String(error));
              }
            })();
          }}
        >
          Push now
        </button>
        <button
          type="button"
          className="ghost-button"
          data-testid="remote-sync-pull"
          onClick={() => {
            void (async () => {
              setStatus(null);
              try {
                const resolutions =
                  conflicts.length > 0
                    ? conflicts.map(
                        (conflict) =>
                          conflictResolutions[`${conflict.kind}-${conflict.id}`] ??
                          "newestWins",
                      )
                    : undefined;
                const result = await pullRemoteSync(passphrase || "jarvis", resolutions);
                setStatus(result.summary);
                setConflicts(result.conflicts);
                setConflictResolutions({});
                await refreshGoals();
                await refreshRemote();
              } catch (error) {
                setStatus(error instanceof Error ? error.message : String(error));
              }
            })();
          }}
        >
          Pull now
        </button>
        {conflicts.length > 0 ? (
          <button
            type="button"
            className="secondary-button"
            data-testid="remote-sync-apply-resolutions"
            onClick={() => {
              void (async () => {
                setStatus(null);
                try {
                  const resolutions = conflicts.map(
                    (conflict) =>
                      conflictResolutions[`${conflict.kind}-${conflict.id}`] ?? "newestWins",
                  );
                  const result = await pullRemoteSync(passphrase || "jarvis", resolutions);
                  setStatus(result.summary);
                  setConflicts(result.conflicts);
                  setConflictResolutions({});
                  await refreshGoals();
                  await refreshRemote();
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : String(error));
                }
              })();
            }}
          >
            Apply conflict resolutions
          </button>
        ) : null}
      </div>
      {remoteStatus ? (
        <p className="result-meta" data-testid="remote-sync-status">
          Device {remoteStatus.deviceId || "not connected"} · last sync{" "}
          {remoteStatus.lastSyncAt ?? "never"} · pending conflicts {remoteStatus.pendingConflicts}
        </p>
      ) : null}
      {conflicts.length > 0 ? (
        <ul className="memory-list" data-testid="remote-sync-conflicts">
          {conflicts.map((conflict) => {
            const key = `${conflict.kind}-${conflict.id}`;
            return (
              <li key={key}>
                {conflict.kind}: {conflict.localSummary} vs {conflict.remoteSummary}
                <div className="inline-actions">
                  {(["keepLocal", "keepRemote", "newestWins"] as const).map((resolution) => (
                    <button
                      key={resolution}
                      type="button"
                      className="ghost-button"
                      data-testid={`sync-resolve-${conflict.id}-${resolution}`}
                      onClick={() =>
                        setConflictResolutions((current) => ({
                          ...current,
                          [key]: resolution,
                        }))
                      }
                    >
                      {resolution === conflictResolutions[key] ? `✓ ${resolution}` : resolution}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="section-kicker">Local bundle</p>
      <label className="gateway-field">
        <span>Passphrase</span>
        <input
          type="password"
          data-testid="sync-passphrase-input"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          placeholder="jarvis"
        />
      </label>
      <div className="inline-actions">
        <button
          type="button"
          className="secondary-button"
          data-testid="sync-export-button"
          onClick={() => void handleExport()}
        >
          Export bundle
        </button>
        <input
          type="text"
          placeholder="Path to bundle file"
          value={bundlePath}
          onChange={(event) => setBundlePath(event.target.value)}
        />
        <button type="button" className="ghost-button" onClick={() => void handleImport()}>
          Import bundle
        </button>
        <button type="button" className="ghost-button" onClick={() => void refreshGoals()}>
          Refresh goals
        </button>
      </div>
      <div className="inline-actions">
        <input
          type="text"
          placeholder="New goal title"
          value={newGoalTitle}
          onChange={(event) => setNewGoalTitle(event.target.value)}
        />
        <button type="button" className="ghost-button" onClick={() => void addGoal()}>
          Add goal
        </button>
      </div>
      {goals.length > 0 ? (
        <ul className="memory-list">
          {goals.map((goal) => (
            <li key={goal.id} className="memory-meta">
              {goal.title} - {goal.status}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="result-meta">Displayed goals follow the active profile.</p>
      {status ? <p className="result-meta">{status}</p> : null}
    </div>
  );
}

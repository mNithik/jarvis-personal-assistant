import { useState } from "react";

import { exportSyncBundle, importSyncBundle, listUserGoals, saveUserGoal, type UserGoalRecord } from "../../services/jarvisApi";

export default function SyncPanel() {
  const [passphrase, setPassphrase] = useState("");
  const [bundlePath, setBundlePath] = useState("");
  const [goals, setGoals] = useState<UserGoalRecord[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [newGoalTitle, setNewGoalTitle] = useState("");

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

  return (
    <div className="result-card">
      <p className="section-kicker">Sync beta</p>
      <h3>Encrypted settings + goals export</h3>
      <p className="result-meta">Local-first sync bundle (no hosted backend in v1).</p>
      <label className="gateway-field">
        <span>Passphrase</span>
        <input
          type="password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          placeholder="jarvis"
        />
      </label>
      <div className="inline-actions">
        <button type="button" className="secondary-button" onClick={() => void handleExport()}>
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
              {goal.title} · {goal.status}
            </li>
          ))}
        </ul>
      ) : null}
      {status ? <p className="result-meta">{status}</p> : null}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";

import {
  deleteTriggerRecipe,
  listTriggerRecipes,
  saveTriggerRecipe,
  type TriggerRecipeRecord,
} from "../../services/jarvisApi";

const PRESET_KINDS = [
  { kind: "morning_brief", name: "Morning brief / plan", schedule: "07:30" },
  { kind: "gmail_label_inbox", name: "Morning inbox triage", schedule: "08:00" },
  { kind: "calendar_event_soon", name: "Meeting prep (minutes before)", schedule: "15" },
  { kind: "ocr_watch", name: "OCR watch tick", schedule: "" },
] as const;

function defaultPayloadForKind(kind: string) {
  if (kind === "calendar_event_soon") {
    return JSON.stringify({ command: "prep me for my next meeting" });
  }
  if (kind === "gmail_label_inbox") {
    return JSON.stringify({ command: "triage my inbox", label: "inbox" });
  }
  return "{}";
}

export default function TriggerRecipePanel() {
  const [recipes, setRecipes] = useState<TriggerRecipeRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftSchedule, setDraftSchedule] = useState("");
  const [draftPayload, setDraftPayload] = useState("{}");

  const refresh = useCallback(async () => {
    try {
      setRecipes(await listTriggerRecipes());
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggleRecipe(recipe: TriggerRecipeRecord) {
    setIsBusy(true);
    try {
      await saveTriggerRecipe({
        ...recipe,
        enabled: !recipe.enabled,
        updatedAt: new Date().toISOString(),
      });
      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function removeRecipe(id: string) {
    setIsBusy(true);
    try {
      await deleteTriggerRecipe(id);
      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  function startEdit(recipe: TriggerRecipeRecord) {
    setEditingId(recipe.id);
    setDraftSchedule(recipe.scheduleValue ?? "");
    setDraftPayload(recipe.payloadJson);
  }

  async function saveEdit(recipe: TriggerRecipeRecord) {
    setIsBusy(true);
    try {
      await saveTriggerRecipe({
        ...recipe,
        scheduleValue: draftSchedule.trim() || null,
        payloadJson: draftPayload.trim() || "{}",
        updatedAt: new Date().toISOString(),
      });
      setEditingId(null);
      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function addPreset(kind: string, name: string, schedule: string) {
    setIsBusy(true);
    try {
      const now = new Date().toISOString();
      await saveTriggerRecipe({
        id: `recipe-${kind}-${Date.now()}`,
        name,
        enabled: true,
        kind,
        scheduleValue: schedule || null,
        payloadJson: defaultPayloadForKind(kind),
        createdAt: now,
        updatedAt: now,
      });
      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="result-card">
      <p className="section-kicker">Trigger recipes</p>
      <h3>Proactive automations</h3>
      <p className="result-meta">
        Configure when JARVIS enqueues morning brief, inbox triage, meeting prep, and OCR ticks.
      </p>
      <div className="inline-actions">
        {PRESET_KINDS.map((preset) => (
          <button
            key={preset.kind}
            type="button"
            className="ghost-button"
            disabled={isBusy}
            onClick={() => void addPreset(preset.kind, preset.name, preset.schedule)}
          >
            Add {preset.name}
          </button>
        ))}
      </div>
      {statusMessage ? <p className="result-meta">{statusMessage}</p> : null}
      {recipes.length > 0 ? (
        <div className="memory-list">
          {recipes.map((recipe) => (
            <div className="memory-card" key={recipe.id}>
              <h4>{recipe.name}</h4>
              <p className="result-meta">
                {recipe.kind}
                {recipe.scheduleValue ? ` · ${recipe.scheduleValue}` : ""}
              </p>
              {editingId === recipe.id ? (
                <div className="inline-actions">
                  <input
                    type="text"
                    placeholder="Schedule (HH:MM or minutes)"
                    value={draftSchedule}
                    onChange={(event) => setDraftSchedule(event.target.value)}
                  />
                  <textarea
                    rows={3}
                    value={draftPayload}
                    onChange={(event) => setDraftPayload(event.target.value)}
                  />
                  <button
                    type="button"
                    className="primary-button"
                    disabled={isBusy}
                    onClick={() => void saveEdit(recipe)}
                  >
                    Save
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="inline-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={isBusy}
                    onClick={() => toggleRecipe(recipe)}
                  >
                    {recipe.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={isBusy}
                    onClick={() => startEdit(recipe)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={isBusy}
                    onClick={() => void removeRecipe(recipe.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">No trigger recipes yet.</p>
      )}
    </div>
  );
}

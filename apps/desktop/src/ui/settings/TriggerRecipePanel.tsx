import { useCallback, useEffect, useState } from "react";

import {
  deleteTriggerRecipe,
  listTriggerRecipes,
  saveTriggerRecipe,
  type TriggerRecipeRecord,
} from "../../services/jarvisApi";

export default function TriggerRecipePanel() {
  const [recipes, setRecipes] = useState<TriggerRecipeRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

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

  return (
    <div className="result-card">
      <p className="section-kicker">Trigger recipes</p>
      <h3>Proactive automations</h3>
      <p className="result-meta">
        Configure when JARVIS enqueues morning brief, inbox triage, meeting prep, and OCR ticks.
      </p>
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
              <div className="inline-actions">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={isBusy}
                  onClick={() => void toggleRecipe(recipe)}
                >
                  {recipe.enabled ? "Disable" : "Enable"}
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
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">No trigger recipes yet.</p>
      )}
    </div>
  );
}

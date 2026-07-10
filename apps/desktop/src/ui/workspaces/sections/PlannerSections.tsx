import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import {
  composeDayPlan,
  getDayPlan,
  replanDay,
  saveDayPlanToNotion,
  type DayPlanRecord,
} from "../../../services/jarvisApi";
import type { PlannerSectionProps } from "./sectionTypes";

function suggestedActionToCommand(action: string): string | null {
  const moveMatch = action.match(/^Move overdue task "(.+)" to tomorrow$/i);
  if (moveMatch) {
    return `move task ${moveMatch[1]} to tomorrow`;
  }
  const completeMatch = action.match(/^Complete task "(.+)"$/i);
  if (completeMatch) {
    return `complete task ${completeMatch[1]}`;
  }
  return null;
}

export function buildPlannerCopilotCard({
  googleCalendarAccessToken,
  notionStatus,
  runCommand,
}: PlannerSectionProps) {
  const notionConfigured =
    notionStatus?.configured === true || notionStatus?.hasToken === true;

  if (!notionConfigured) {
    return (
      <div className="result-card" key="planner-copilot">
        <p className="section-kicker">Planner Copilot</p>
        <h3>Day planner</h3>
        <p className="result-meta">
          Connect Notion with a database ID in the system drawer to plan your day from tasks and calendar.
        </p>
      </div>
    );
  }

  return (
    <PlannerCopilotCardInner
      googleCalendarAccessToken={googleCalendarAccessToken}
      runCommand={runCommand}
    />
  );
}

function PlannerCopilotCardInner({
  googleCalendarAccessToken,
  runCommand,
}: {
  googleCalendarAccessToken?: string | null;
  runCommand?: (command: string) => void | Promise<unknown>;
}) {
  const [dayPlan, setDayPlan] = useState<DayPlanRecord | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const refreshPlan = useCallback(async () => {
    try {
      const plan = await getDayPlan();
      setDayPlan(plan);
    } catch {
      setDayPlan(null);
    }
  }, []);

  useEffect(() => {
    void refreshPlan();
  }, [refreshPlan]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen("planner-day-plan-changed", () => {
      void refreshPlan();
    }).then((dispose) => {
      unlisten = dispose;
    });
    void listen("gateway-turn-complete", () => {
      void refreshPlan();
    }).then((dispose) => {
      if (!unlisten) {
        unlisten = dispose;
      }
    });
    return () => {
      unlisten?.();
    };
  }, [refreshPlan]);

  const runPlannerAction = useCallback(
    async (action: () => Promise<DayPlanRecord>, successMessage: string) => {
      setIsBusy(true);
      setStatusMessage(null);
      try {
        const plan = await action();
        setDayPlan(plan);
        setStatusMessage(successMessage);
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsBusy(false);
      }
    },
    [],
  );

  return (
    <div className="result-card" key="planner-copilot">
      <p className="section-kicker">Planner Copilot</p>
      <h3>Day planner</h3>
      <p className="result-meta">
        Morning plan and replan from Notion tasks
        {googleCalendarAccessToken ? ", calendar," : ""} and memory.
      </p>
      {!googleCalendarAccessToken ? (
        <p className="result-meta planner-calendar-banner">
          Calendar is not connected — connect in Settings → Integrations. Plans still use Notion
          tasks and memory.
        </p>
      ) : null}
      {dayPlan ? (
        <div className="planner-plan-preview">
          <p className="result-meta">Plan for {dayPlan.planDate}</p>
          {dayPlan.topThree.length > 0 ? (
            <ol className="planner-top-three">
              {dayPlan.topThree.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          ) : (
            <p className="empty-state">No Top 3 priorities yet.</p>
          )}
          {dayPlan.suggestedActions.length > 0 ? (
            <div className="planner-suggested-actions">
              <p className="section-kicker">Suggested actions</p>
              <ul>
                {dayPlan.suggestedActions.map((action) => {
                  const command = suggestedActionToCommand(action);
                  return (
                    <li key={action}>
                      {action}
                      {command ? (
                        <button
                          type="button"
                          className="ghost-button planner-action-button"
                          disabled={isBusy}
                          onClick={() => {
                            void (async () => {
                              await runCommand?.(command);
                              refreshPlan();
                            })();
                          }}
                        >
                          Confirm
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="empty-state">No plan saved for today yet.</p>
      )}
      {statusMessage ? <p className="result-meta">{statusMessage}</p> : null}
      <div className="inline-actions">
        <button
          type="button"
          className="ghost-button"
          disabled={isBusy}
          onClick={() => void runPlannerAction(composeDayPlan, "Morning plan ready.")}
        >
          Plan my day
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={isBusy}
          onClick={() => void runPlannerAction(replanDay, "Day plan replanned.")}
        >
          Replan
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={isBusy || !dayPlan}
          onClick={() =>
            void runPlannerAction(saveDayPlanToNotion, "Plan saved to Notion.")
          }
        >
          Save to Notion
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={isBusy}
          onClick={() => void runCommand?.("open cockpit")}
        >
          Open Mission Control
        </button>
      </div>
    </div>
  );
}

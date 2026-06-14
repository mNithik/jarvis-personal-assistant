import { ReactNode } from "react";
import { describeOcrWatchRule } from "../../../features/legacy/appHelpers";
import type { VisionSectionProps } from "./sectionTypes";

export function buildVisionWorkspaceSections({
  activeOcrWatches,
  isRoutingCommand,
  ocrHistory,
  ocrWatchMatches,
  ocrWatchTargets,
  primaryOcrWatch,
  runCommand,
}: VisionSectionProps): ReactNode[] {
  return [
    <section className="grid-layout single-column" key="vision-main">
      {primaryOcrWatch ? (
        <div className="result-card">
          <p className="section-kicker">OCR Watch</p>
          <h3>{activeOcrWatches.length} active watch{activeOcrWatches.length === 1 ? "" : "es"}</h3>
          <p>
            Latest: {primaryOcrWatch.name} every {Math.round(primaryOcrWatch.intervalMs / 1000)} seconds.
          </p>
          <p className="result-meta">Rule: {describeOcrWatchRule(primaryOcrWatch.rule)}</p>
        </div>
      ) : null}
      <div className="result-card">
        <p className="section-kicker">OCR Command Deck</p>
        <h3>Screen intelligence controls</h3>
        <div className="workflow-actions">
          {[
            "select ocr area",
            "summarize screen",
            "explain this error",
            "make study notes from this screen",
            "turn this screen into flashcards",
            "copy latest ocr",
            "export ocr history",
          ].map((command) => (
            <button
              className="secondary-button"
              type="button"
              key={command}
              onClick={() => {
                void runCommand(command);
              }}
              disabled={isRoutingCommand}
            >
              {command}
            </button>
          ))}
        </div>
      </div>
      {(ocrWatchTargets.length > 0 || ocrWatchMatches.length > 0) ? (
        <div className="result-card">
          <p className="section-kicker">Watch Dashboard</p>
          <h3>{activeOcrWatches.length} active, {ocrWatchTargets.length - activeOcrWatches.length} paused</h3>
          {ocrWatchMatches.length > 0 ? (
            <div className="memory-grid">
              {ocrWatchMatches.slice(0, 3).map((match) => (
                <div className="memory-card" key={match.id}>
                  <h4>{match.matchType ?? "OCR match"}</h4>
                  <p>{match.target}</p>
                  <p className="result-meta">{match.summary.slice(0, 180)}</p>
                </div>
              ))}
            </div>
          ) : <p className="result-meta">No watch matches yet.</p>}
        </div>
      ) : null}
      {ocrHistory.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">OCR History</p>
          <h3>{ocrHistory.length} remembered screen read{ocrHistory.length === 1 ? "" : "s"}</h3>
          <p className="result-meta">
            {ocrHistory.slice(0, 3).map((entry) => `${entry.target}: ${entry.summary.slice(0, 140)}`).join(" | ")}
          </p>
        </div>
      ) : null}
    </section>,
  ];
}

